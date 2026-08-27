// Storyloom — the pre-generation worker (issue #9).
//
// A chapter takes ~93s to write and ~9s per illustration. Nobody watches that
// at bedtime, and if a provider is down at 8pm there is no story at all. So the
// work happens the night before: the parent chooses what tomorrow is about at
// the end of tonight's read, and this runs while they are putting the child to
// bed.
//
// Authorization: there is no user session in a background task, so the job row
// IS the authorization record. `enqueue-chapter` proved the caller owns the
// child before inserting it; RLS forbids a client from creating a job for
// anyone else's child, or from creating one in any state but 'queued'.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";

import { generateChapterFor } from "./generate.ts";
import { isRevivable } from "./revivable.ts";
import { ChapterBlockedError, illustrateChapter } from "./illustrate-run.ts";

/** Give up after this many tries rather than burning money on a bad job. */
const MAX_ATTEMPTS = 3;

export interface QueueJob {
  id: string;
  child_id: string;
  lesson: string;
  situation: string | null;
  attempts: number;
}

/**
 * Claims a queued job.
 *
 * The update is conditional on the row still being 'queued', so two concurrent
 * workers cannot both take the same job — the loser's update matches nothing.
 * Generation costs money at two paid providers; "probably only once" is not
 * good enough.
 */
export async function claimJob(
  supabase: SupabaseClient,
  jobId: string,
): Promise<QueueJob | null> {
  const { data } = await supabase
    .from("chapter_queue")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("id,child_id,lesson,situation,attempts")
    .maybeSingle();

  return (data as QueueJob | null) ?? null;
}

/**
 * Generates and illustrates one chapter, then closes the job out.
 *
 * Never throws: it is called from a background task whose rejection nobody is
 * listening for, so a failure has to land in the row or it is invisible.
 */
export async function runJob(
  supabase: SupabaseClient,
  job: QueueJob,
): Promise<void> {
  const attempts = job.attempts + 1;

  try {
    const result = await generateChapterFor(
      supabase,
      job.child_id,
      job.lesson,
      job.situation ?? undefined,
    );

    // Illustrate in the same task. A pre-generated chapter that still needs a
    // second wait for pictures has not actually moved the wait off bedtime.
    // Art failing does not fail the job — the chapter reads without it.
    let illustrationError: string | null = null;
    try {
      await illustrateChapter(supabase, result.chapter_id);
    }
    catch (err) {
      if (!(err instanceof ChapterBlockedError)) {
        illustrationError = err instanceof Error ? err.message : String(err);
      }
    }

    await supabase
      .from("chapter_queue")
      .update({
        status: "done",
        attempts,
        chapter_id: result.chapter_id,
        error: illustrationError,
        finished_at: new Date().toISOString(),
      })
      .eq("id", job.id);
  }
  catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Back to 'queued' while retries remain, so the next sweep picks it up.
    // Terminal failures stay visible rather than disappearing — a parent who
    // was promised a chapter needs to be told there isn't one.
    const exhausted = attempts >= MAX_ATTEMPTS;
    await supabase
      .from("chapter_queue")
      .update({
        status: exhausted ? "failed" : "queued",
        attempts,
        error: message,
        started_at: null,
        ...(exhausted ? { finished_at: new Date().toISOString() } : {}),
      })
      .eq("id", job.id);
  }
}

/**
 * Picks up jobs left behind — a worker that hit the function's wall-clock
 * limit, or a retry after a provider outage. Called when the app opens, so a
 * stalled queue heals on the parent's next visit rather than staying stuck
 * until someone notices.
 */
export async function sweepStuckJobs(
  supabase: SupabaseClient,
  childIds: string[],
  staleAfterMs = 10 * 60 * 1000,
): Promise<string[]> {
  if (childIds.length === 0) {
    return [];
  }

  const staleBefore = new Date(Date.now() - staleAfterMs).toISOString();
  const { data } = await supabase
    .from("chapter_queue")
    .select("id,child_id,lesson,situation,attempts,status,started_at")
    .in("child_id", childIds)
    .in("status", ["queued", "running"]);

  const revivable = (data ?? []).filter((j) =>
    isRevivable(
      { status: j.status as string, started_at: j.started_at as string | null },
      staleBefore,
    )
  );

  const revived: string[] = [];
  for (const j of revivable) {
    if (j.attempts >= MAX_ATTEMPTS) {
      continue;
    }
    // Reset to 'queued' first so claimJob's conditional update still applies.
    await supabase
      .from("chapter_queue")
      .update({ status: "queued", started_at: null })
      .eq("id", j.id);
    revived.push(j.id as string);
  }
  return revived;
}
