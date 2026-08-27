import type { ChildRow } from '@/lib/supabase/chapters';
import type { ChildReadableChapter } from '@/lib/supabase/types';

import { storage } from '@/lib/storage';

import { blobUri, hasBlob, removeBlob } from './blob-store';

/**
 * The text half of offline reading (issue #10).
 *
 * Bedtime happens in a kid's room on bad wifi or in airplane mode, so an
 * already-generated chapter has to be readable with no network at all. Chapter
 * text is small and structured, so it lives in MMKV; illustrations are far too
 * big for that and live in `blob-store`.
 *
 * Cache-FIRST, not cache-as-fallback. Trying the network first and falling
 * back on failure means every bedtime on weak wifi waits out a timeout before
 * showing anything, which is the same as being broken, only slower.
 *
 * The child row is cached too. That is not incidental: "airplane-mode reading
 * works" needs the screen you navigate FROM to survive offline, or the parent
 * lands on an error and never reaches the chapter at all.
 */

const CHAPTER_KEY = (chapterId: string) => `offline:chapter:${chapterId}`;
const INDEX_KEY = (childId: string) => `offline:index:${childId}`;
const CHILD_KEY = 'offline:child';

/** How many chapters keep their illustrations. Text is kept for all of them. */
export const KEEP_ILLUSTRATED = 5;

export type CachedChapter = {
  chapter: ChildReadableChapter;
  /** Storage paths whose bytes were actually stored. */
  images: string[];
  cachedAt: string;
};

function readJson<T>(key: string): T | null {
  const raw = storage.getString(key);
  if (raw === undefined) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  }
  catch {
    // A half-written or stale-format entry must not break bedtime: drop it and
    // let the caller fall through to the network.
    storage.remove(key);
    return null;
  }
}

// ---------------------------------------------------------------------------
// The child
// ---------------------------------------------------------------------------

export function cacheChild(child: ChildRow): void {
  storage.set(CHILD_KEY, JSON.stringify(child));
}

export function readCachedChild(): ChildRow | null {
  return readJson<ChildRow>(CHILD_KEY);
}

// ---------------------------------------------------------------------------
// Chapters
// ---------------------------------------------------------------------------

export function readCachedChapter(chapterId: string): CachedChapter | null {
  return readJson<CachedChapter>(CHAPTER_KEY(chapterId));
}

export function writeCachedChapter(entry: CachedChapter): void {
  storage.set(CHAPTER_KEY(entry.chapter.id), JSON.stringify(entry));

  const childId = entry.chapter.child_id;
  const index = readIndex(childId).filter(id => id !== entry.chapter.id);
  index.unshift(entry.chapter.id);
  storage.set(INDEX_KEY(childId), JSON.stringify(index));
}

/** Cached chapter ids for this child, most recently cached first. */
export function readIndex(childId: string): string[] {
  return readJson<string[]>(INDEX_KEY(childId)) ?? [];
}

/** Everything readable offline, newest chapter first — the offline library. */
export function readCachedChapters(childId: string): ChildReadableChapter[] {
  return readIndex(childId)
    .map(id => readCachedChapter(id)?.chapter)
    .filter((c): c is ChildReadableChapter => c !== undefined)
    .sort((a, b) => b.number - a.number);
}

export function isCached(chapterId: string): boolean {
  return storage.getString(CHAPTER_KEY(chapterId)) !== undefined;
}

/**
 * Every page's image as something renderable right now: the cached copy when
 * there is one, otherwise whatever the network signed. Pages with no art, and
 * pages whose art was never downloaded and cannot be signed, come back absent
 * — a missing picture must never stop a chapter being read.
 */
export async function resolveImageUris(
  chapter: ChildReadableChapter,
  signed: Record<string, string> = {},
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};

  for (const page of chapter.pages) {
    const path = page.image_path;
    if (path === undefined) {
      continue;
    }
    const cached = await blobUri(path);
    if (cached !== null) {
      out[path] = cached;
    }
    else if (signed[path] !== undefined) {
      out[path] = signed[path];
    }
  }
  return out;
}

/** True when this chapter, pictures and all, can be read with the network off. */
export async function isFullyOffline(chapterId: string): Promise<boolean> {
  const entry = readCachedChapter(chapterId);
  if (entry === null) {
    return false;
  }
  const wanted = entry.chapter.pages
    .map(page => page.image_path)
    .filter((path): path is string => path !== undefined);

  for (const path of wanted) {
    if (!(await hasBlob(path))) {
      return false;
    }
  }
  return true;
}

/**
 * Drops the illustrations of all but the most recent chapters.
 *
 * Text is kept indefinitely — it is kilobytes, and a parent browsing offline
 * should still see every title. Images are megabytes each, so a year of
 * nightly chapters would otherwise fill the device.
 */
export async function evictOldImages(
  childId: string,
  keep = KEEP_ILLUSTRATED,
): Promise<number> {
  let removed = 0;

  for (const chapterId of readIndex(childId).slice(keep)) {
    const entry = readCachedChapter(chapterId);
    if (entry === null || entry.images.length === 0) {
      continue;
    }
    for (const path of entry.images) {
      await removeBlob(path);
      removed += 1;
    }
    writeCachedChapter({ ...entry, images: [] });
  }
  return removed;
}
