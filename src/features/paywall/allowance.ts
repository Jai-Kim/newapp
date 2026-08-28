import type { ChildReadableChapter } from '@/lib/supabase/types';

import { VOLUME_SIZE } from '@/features/reader/volumes';

/**
 * The chapter allowance (ADR-0003): roughly one book's worth a month, which
 * bounds the per-chapter image cost. It shares its size with a Volume (10
 * chapters) and resets with the calendar month on purpose, so reaching it
 * reads as "you've finished this month's book" rather than "you're locked
 * out" — a rhythm, not a punishment.
 *
 * This is the in-app, family-facing view of the allowance only, counted from
 * `child_readable_chapters` (what the family actually received). It is not
 * the spend guard: a client can always skip a client-side check, so the
 * number that actually bounds cost has to be enforced server-side inside
 * `generate-chapter`/`enqueue-chapter` (issue #6, still open).
 */
export const ALLOWANCE_SIZE = VOLUME_SIZE;

export type AllowanceStatus = {
  used: number;
  limit: number;
  remaining: number;
  blocked: boolean;
  /** When the current window closes and the allowance resets. */
  periodEnds: Date;
};

/** Midnight UTC on the first of the month containing `now`. */
export function currentPeriodStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Midnight UTC on the first of the month after `now`. */
export function currentPeriodEnd(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

export function computeAllowanceStatus(
  chapters: ChildReadableChapter[],
  now: Date = new Date(),
): AllowanceStatus {
  const periodStart = currentPeriodStart(now);
  const used = chapters.filter((c) => {
    const createdAt = new Date(c.created_at);
    return !Number.isNaN(createdAt.getTime()) && createdAt >= periodStart;
  }).length;

  return {
    used,
    limit: ALLOWANCE_SIZE,
    remaining: Math.max(ALLOWANCE_SIZE - used, 0),
    blocked: used >= ALLOWANCE_SIZE,
    periodEnds: currentPeriodEnd(now),
  };
}
