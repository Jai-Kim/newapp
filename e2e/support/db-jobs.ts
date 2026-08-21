import { literal, sql } from './db';

/**
 * Queue-row surgery the app itself must never be able to do.
 *
 * `chapter_queue` has SELECT and INSERT policies and deliberately no UPDATE
 * policy: a client that could write `status = 'done'` could fabricate a chapter
 * that was never generated, and a client that could reset a job could replay
 * generation at the project's expense. So these go through the privileged path,
 * which is also a small proof that the restriction is real — if a plain client
 * could do it, none of this file would need to exist.
 */

export function closeJob(jobId: string, chapterId: string): void {
  sql(`
    update chapter_queue
       set status = 'done', chapter_id = ${literal(chapterId)},
           finished_at = now()
     where id = ${literal(jobId)};
  `);
}

/**
 * Makes a live job look like one whose worker died: still 'running', started
 * long enough ago that no generation could still be in flight. This is the
 * exact state the sweep exists to rescue, and it cannot be reached honestly
 * without waiting for a real crash.
 */
export function strandJob(jobId: string, minutesAgo = 30): void {
  sql(`
    update chapter_queue
       set status = 'running',
           started_at = now() - interval '${Number(minutesAgo)} minutes',
           chapter_id = null,
           finished_at = null
     where id = ${literal(jobId)};
  `);
}

export function jobStatus(jobId: string): string | null {
  const rows = sql(`select status from chapter_queue where id = ${literal(jobId)};`);
  return (rows[0]?.status as string) ?? null;
}

/**
 * How many times a job has actually been run.
 *
 * This is what separates a job the sweep genuinely re-ran from one that simply
 * looks finished: `runJob` increments it, so a revived job comes back with a
 * higher count. Without checking it, a stranded job whose own worker was still
 * alive would close itself out and the sweep would get the credit.
 */
export function jobAttempts(jobId: string): number {
  const rows = sql(`select attempts from chapter_queue where id = ${literal(jobId)};`);
  return Number(rows[0]?.attempts ?? 0);
}
