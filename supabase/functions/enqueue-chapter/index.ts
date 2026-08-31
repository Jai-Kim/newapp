// Storyloom — enqueue-chapter Edge Function (issue #9).
//
// The point of this function is what it does NOT do: it does not wait. It
// validates, writes a job row, hands the actual generation to a background
// task, and returns in well under a second. The ~93s of writing and ~9s per
// illustration happen while the parent is putting the child to bed, so the
// chapter is finished, illustrated and waiting for review long before anyone
// wants it.
//
// Two actions:
//   enqueue  queue tomorrow's chapter and start it now
//   sweep    revive jobs a dead worker left behind (called when the app opens)
//
// Deploy: supabase functions deploy enqueue-chapter

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { assertOwnsChild, requireUser, statusFor } from '../_shared/auth.ts';
import { handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { CrisisDetectedError, screenParentInput } from '../_shared/crisis.ts';
import { pickFallbackLesson } from '../_shared/lessons.ts';
import { claimJob, runJob, sweepStuckJobs } from '../_shared/queue.ts';
import { QuotaExceededError, reserveGenerationSlot } from '../_shared/quota.ts';

type Req = {
  action?: 'enqueue' | 'sweep';
  child_id: string;
  /** What tomorrow is about. Omitted means "you choose" — see lessons.ts. */
  lesson?: string;
  situation?: string;
};

/**
 * Supabase Edge Functions keep running after the response when work is handed
 * to waitUntil. Typed loosely because the global is runtime-provided.
 */
declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void } | undefined;

function runInBackground(promise: Promise<unknown>): void {
  if (typeof EdgeRuntime !== 'undefined') {
    EdgeRuntime.waitUntil(promise);
    return;
  }
  // Local `supabase functions serve` has no EdgeRuntime; the floating promise
  // is fine there because the process stays alive.
  void promise;
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) {
    return preflight;
  }

  try {
    const { action = 'enqueue', child_id, lesson, situation } =
      (await req.json()) as Req;
    if (!child_id) {
      return jsonResponse({ ok: false, error: 'child_id required' }, { status: 400 });
    }

    // Queuing a job spends money the moment the worker starts, so it is gated
    // exactly like the functions it triggers (issue #6).
    const user = await requireUser(req);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    await assertOwnsChild(supabase, child_id, user.id);

    if (action === 'sweep') {
      const revived = await sweepStuckJobs(supabase, [child_id]);
      for (const id of revived) {
        const job = await claimJob(supabase, id);
        if (job) {
          runInBackground(runJob(supabase, job));
        }
      }
      return jsonResponse({ ok: true, revived: revived.length });
    }

    // Screen what the parent typed before anything else — before the
    // live-job check, before the quota reservation, before a job row exists
    // at all (issue #13). A crisis-shaped situation should never queue.
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY not set');
    }
    await screenParentInput(anthropicKey, { lesson, situation });

    // A double-tap or a retry against an already-running job doesn't need
    // (and must not burn) a fresh reservation — this is a best-effort
    // pre-check to avoid paying for the common case. It is not atomic: a
    // fully concurrent race can still slip past it and consume a reservation
    // that the insert's own unique index then rejects anyway (23505, below)
    // — the same class of race that index already accepts elsewhere in this
    // function.
    const { data: liveJob } = await supabase
      .from('chapter_queue')
      .select('id')
      .eq('child_id', child_id)
      .in('status', ['queued', 'running'])
      .maybeSingle();

    if (liveJob) {
      return jsonResponse({
        ok: true,
        already_queued: true,
        message: 'a chapter is already being written for this child',
      });
    }

    // The spend guard (issue #6): a per-user rate limit and a per-child
    // month-to-date quota, reserved before the worker below costs money.
    await reserveGenerationSlot(supabase, user.id, child_id);

    const auto = !lesson;
    const chosen = lesson ?? await pickFallbackLesson(supabase, child_id);

    const { data: job, error } = await supabase
      .from('chapter_queue')
      .insert({
        child_id,
        lesson: chosen,
        situation: situation ?? null,
        auto_chosen: auto,
        requested_by: user.id,
      })
      .select('id,child_id,lesson,situation,attempts')
      .single();

    if (error) {
      // The one-live-job-per-child index. Not an error worth alarming anyone
      // about — it means the thing they asked for is already happening.
      if (error.code === '23505') {
        return jsonResponse({
          ok: true,
          already_queued: true,
          message: 'a chapter is already being written for this child',
        });
      }
      throw error;
    }

    const claimed = await claimJob(supabase, job.id as string);
    if (claimed) {
      runInBackground(runJob(supabase, claimed));
    }

    return jsonResponse({
      ok: true,
      job_id: job.id,
      lesson: chosen,
      auto_chosen: auto,
      // The caller should not wait on this. It is being written now.
      status: 'running',
    });
  }
  catch (err) {
    if (err instanceof QuotaExceededError) {
      return jsonResponse(err.toBody(), { status: err.status });
    }
    if (err instanceof CrisisDetectedError) {
      return jsonResponse(err.toBody(), { status: err.status });
    }
    return jsonResponse(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: statusFor(err) },
    );
  }
});
