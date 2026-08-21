// Storyloom — what tonight's chapter is about.
//
// The parent chooses this at the end of the previous night's read. This file is
// only the FALLBACK for the night they didn't: pre-generation cannot wait for a
// choice that was never made, and a family that skips the prompt should still
// wake up to a chapter rather than to nothing.
//
// Deliberately a small, plain rotation rather than anything clever. An
// auto-chosen lesson is marked as such on the job, so the app can say "we
// picked this one" instead of pretending the parent did.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";

/** Everyday, age-neutral, and none of them frightening. */
const FALLBACK_LESSONS = [
  "trying again after something goes wrong",
  "sharing something you don't want to share",
  "being brave about something new",
  "saying sorry and meaning it",
  "noticing when someone else is sad",
  "waiting for your turn",
  "telling the truth when it's hard",
  "asking for help",
  "being kind to someone left out",
  "finishing something you started",
];

/**
 * The least-recently-used lesson this child hasn't had lately.
 *
 * Repetition is the failure mode that matters here — a child who gets "being
 * brave" four nights running notices, and the parent stops trusting the app to
 * choose.
 */
export async function pickFallbackLesson(
  supabase: SupabaseClient,
  childId: string,
): Promise<string> {
  const { data } = await supabase
    .from("lessons_taught")
    .select("lesson,created_at")
    .eq("child_id", childId)
    .order("created_at", { ascending: false })
    .limit(50);

  const seen = new Set((data ?? []).map((r) => r.lesson as string));
  const unused = FALLBACK_LESSONS.filter((l) => !seen.has(l));
  if (unused.length > 0) {
    return unused[0];
  }

  // All of them have been used: take the one used longest ago. `data` is
  // newest-first, so the last occurrence of each is its most recent use.
  const mostRecent = new Map<string, string>();
  for (const row of data ?? []) {
    if (!mostRecent.has(row.lesson as string)) {
      mostRecent.set(row.lesson as string, row.created_at as string);
    }
  }
  return [...FALLBACK_LESSONS]
    .sort((a, b) => (mostRecent.get(a) ?? "").localeCompare(mostRecent.get(b) ?? ""))[0];
}
