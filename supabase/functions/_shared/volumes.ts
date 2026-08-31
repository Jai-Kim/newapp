// Storyloom — server-side mirror of src/features/reader/volumes.ts's grouping
// (issue #22, ADR-0003).
//
// Duplicated rather than imported: Edge Functions run on Deno and cannot
// import from src/. Keep VOLUME_SIZE and the grouping rule in lockstep with
// the client version if either ever changes -- a mismatch would mean the
// library screen and the print-order snapshot disagree about what "Volume 1"
// contains.
//
// Chapters are grouped by their POSITION in the readable sequence, not by
// `chapters.number` -- number is a monotonic per-child counter a parent's
// rejection leaves a gap in, while child_readable_chapters only ever contains
// approved-and-safe chapters and is already gap-free.

export const VOLUME_SIZE = 10;

export type VolumeChapter = {
  id: string;
  number: number;
};

/**
 * The ordered chapter ids making up one complete (1-based) volume, or null if
 * that volume is not yet complete. Used by submit-print-order to compute the
 * snapshot server-side -- never trust a client-supplied chapter list here.
 */
export function completedVolumeChapterIds(
  chapters: VolumeChapter[],
  volumeIndex: number,
): string[] | null {
  const ordered = [...chapters].sort((a, b) => a.number - b.number);
  const start = (volumeIndex - 1) * VOLUME_SIZE;
  const slice = ordered.slice(start, start + VOLUME_SIZE);
  return slice.length === VOLUME_SIZE ? slice.map((c) => c.id) : null;
}
