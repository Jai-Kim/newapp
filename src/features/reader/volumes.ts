import type { ChildReadableChapter } from '@/lib/supabase/types';

/**
 * Volumes group readable chapters into completable "books" (~10 chapters
 * each), per ADR-0003 — the product shows progress toward a finished book,
 * not an endless feed, and a clear "your book is ready" moment at 10.
 *
 * Volumes are DERIVED, not a persisted table: they group chapters by
 * POSITION in the readable sequence, not by raw `chapters.number`. A
 * parent's rejection leaves a permanent gap in `number` (flagged as an open
 * question in WEEK-2-PLAN.md); grouping by number would bake that gap into
 * a volume forever, and `child_readable_chapters` itself already skips
 * rejected/unsafe chapters, so position within it has no such gaps. A
 * persisted `volumes` table would make sense once slice 3 (paywall
 * allowance) or slice 4 (concierge print, which needs a stable
 * order-to-volume reference) make one load-bearing.
 */

export const VOLUME_SIZE = 10;

export type Volume = {
  /** 1-based — "Volume 1", "Volume 2", ... */
  index: number;
  chapters: ChildReadableChapter[];
  complete: boolean;
};

/** Splits readable chapters into ~10-chapter volumes, oldest first. */
export function groupIntoVolumes(chapters: ChildReadableChapter[]): Volume[] {
  const ordered = [...chapters].sort((a, b) => a.number - b.number);
  const volumes: Volume[] = [];

  for (let i = 0; i < ordered.length; i += VOLUME_SIZE) {
    const slice = ordered.slice(i, i + VOLUME_SIZE);
    volumes.push({
      index: volumes.length + 1,
      chapters: slice,
      complete: slice.length === VOLUME_SIZE,
    });
  }

  return volumes;
}

/**
 * The volume currently filling up — the last one, whether or not it has
 * reached 10 yet. Once it does, it stays "current" (and complete) until the
 * next chapter starts a new volume.
 */
export function currentVolume(chapters: ChildReadableChapter[]): Volume | null {
  const volumes = groupIntoVolumes(chapters);
  return volumes.length === 0 ? null : volumes[volumes.length - 1];
}
