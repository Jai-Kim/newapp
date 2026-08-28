import type { ChildReadableChapter } from '@/lib/supabase/types';

/**
 * Groups a child's readable chapters into completable Volumes — the
 * product's spine (ADR-0003): a family is building a shelf of finished books,
 * not scrolling a feed.
 *
 * Volumes are derived here, not a persisted table. Chapters are grouped by
 * their POSITION in the readable sequence, not by `chapters.number` — number
 * is a monotonic per-child counter that a parent's rejection leaves a gap in
 * (see WEEK-2-PLAN.md), while `child_readable_chapters` only ever contains
 * approved-and-safe chapters and is already gap-free. Grouping by position
 * means a rejected chapter can never freeze a volume short of 10 forever.
 */

export const VOLUME_SIZE = 10;

export type Volume = {
  /** 1-based, matching how a parent would talk about "book one". */
  index: number;
  chapters: ChildReadableChapter[];
  complete: boolean;
};

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
 * The volume a family is currently filling — the last one, whether it just
 * completed at 10 or is still short. `null` when nothing has been read yet.
 */
export function currentVolume(chapters: ChildReadableChapter[]): Volume | null {
  const volumes = groupIntoVolumes(chapters);
  return volumes.length === 0 ? null : volumes[volumes.length - 1];
}
