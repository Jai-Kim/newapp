// Storyloom — is a left-behind job ours to pick up again?

/**
 * Whether a job the worker left behind should be picked up again.
 *
 * In its own file with no imports on purpose: `queue.ts` pulls in the
 * storyteller, which uses Deno-only `npm:` and `jsr:` specifiers that jest
 * cannot resolve, so a test importing it could never run.
 *
 * It compares timestamps, and
 * the two sides come from different places: `staleBefore` is a JavaScript
 * `toISOString()` ending in `Z`, while `started_at` arrives from PostgREST
 * ending in `+00:00`. Comparing those as strings is the kind of thing that
 * works in every test you think to write and then fails on a boundary at 2am,
 * so both are parsed to milliseconds instead.
 */
export function isRevivable(
  job: { status: string; started_at: string | null },
  staleBefore: string,
): boolean {
  // Queued means nothing has claimed it — always ours to take.
  if (job.status === "queued") {
    return true;
  }
  if (job.status !== "running" || job.started_at === null) {
    return false;
  }
  // A 'running' job whose worker died holds the one-live-job lock forever, so
  // anything running longer than a generation could possibly take is dead.
  const started = Date.parse(job.started_at);
  const threshold = Date.parse(staleBefore);
  return Number.isFinite(started) && Number.isFinite(threshold)
    && started < threshold;
}
