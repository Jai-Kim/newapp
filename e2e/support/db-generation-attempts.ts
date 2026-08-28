import { literal, sql } from './db';

/**
 * Privileged access to the generation_attempts ledger (issue #6).
 *
 * The table has no client-facing policy at all (0008_generation_quota.sql) —
 * every real row is written by reserve_generation_attempt() under the service
 * role — so seeding "this child already used this month's allowance", and
 * the enqueue stub's own quota check, can only happen over this privileged
 * path, exactly like chapter_queue's own db-jobs.ts helpers.
 */

/** Seeds `count` attempts for a child, spread across the current UTC month. */
export function seedMonthlyAttempts(userId: string, childId: string, count: number): void {
  const n = Math.max(0, Math.trunc(count));
  if (n === 0) {
    return;
  }
  sql(`
    insert into generation_attempts (user_id, child_id, source, created_at)
    select ${literal(userId)}, ${literal(childId)}, 'enqueue-chapter',
           date_trunc('month', now() at time zone 'utc') at time zone 'utc'
             + (g::text || ' hours')::interval
      from generate_series(0, ${n - 1}) g;
  `);
}

/** How many attempts a child has on record for the current UTC month. */
export function monthlyAttemptCount(childId: string): number {
  const rows = sql(`
    select count(*)::int as n
      from generation_attempts
     where child_id = ${literal(childId)}
       and created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc'
       and created_at <  (date_trunc('month', now() at time zone 'utc') at time zone 'utc')
                          + interval '1 month';
  `);
  return Number(rows[0]?.n ?? 0);
}
