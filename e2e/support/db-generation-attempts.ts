import { literal, sql } from './db';

/**
 * generation_attempts (issue #6) has no policy at all for `authenticated` —
 * every read and write happens server-side, under the service role, via
 * reserve_generation_attempt() (see 0010_generation_quota.sql). The stub for
 * that guard in stubs.ts needs the same privileged path real generation never
 * touches directly, mirroring db-print-orders.ts's role for print_orders and
 * db-jobs.ts's role for chapter_queue.
 */

/** Seeds `count` reserved slots for a child, as if a month had already been spent. */
export function seedGenerationAttempts(userId: string, childId: string, count: number): void {
  if (count <= 0) {
    return;
  }
  sql(`
    insert into generation_attempts (user_id, child_id)
    select ${literal(userId)}, ${literal(childId)}
    from generate_series(1, ${Number(count)});
  `);
}

/**
 * Chapters already reserved for this child within the current UTC calendar
 * month — what CHAPTER_MONTHLY_ALLOWANCE (supabase/functions/_shared/
 * quota.ts) is compared against. `Number(...)` matters here: under the table
 * parser (see db.ts), every cell — including a `count(*)` — arrives as a
 * string, not a number.
 */
export function monthlyAttemptCount(childId: string): number {
  const rows = sql(`
    select count(*) as n from generation_attempts
    where child_id = ${literal(childId)}
      and created_at >= (date_trunc('month', now() at time zone 'utc') at time zone 'utc');
  `);
  return Number(rows[0]?.n ?? 0);
}
