import type { ChildReadableChapter } from '@/lib/supabase/types';

import { messageOf } from '@/lib/errors';
import { signImagePaths } from '@/lib/supabase/chapters';

import { putBlob } from './blob-store';
import { evictOldImages, readCachedChapter, writeCachedChapter } from './chapter-cache';

/**
 * Makes one chapter readable with the network off (issue #10).
 *
 * Text first, then pictures, and the order is deliberate: if the connection
 * dies halfway, a chapter that reads with some art missing is still a bedtime
 * story, whereas art with no text is nothing at all.
 */

export type DownloadResult = {
  chapterId: string;
  imagesStored: number;
  imagesExpected: number;
  /** Non-fatal. The chapter is still readable, just with fewer pictures. */
  failures: { path: string; reason: string }[];
};

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function downloadChapter(
  chapter: ChildReadableChapter,
): Promise<DownloadResult> {
  const paths = chapter.pages
    .map(page => page.image_path)
    .filter((path): path is string => path !== undefined);

  const existing = readCachedChapter(chapter.id);
  const stored = [...(existing?.images ?? [])];

  // Write the text before touching the network again, so the chapter is
  // readable even if every image fetch below fails.
  writeCachedChapter({
    chapter,
    images: stored,
    cachedAt: new Date().toISOString(),
  });

  const failures: DownloadResult['failures'] = [];

  if (paths.length > 0) {
    // One signing round-trip for the whole chapter rather than one per page.
    const signed = await signImagePaths(paths);

    await Promise.all(paths.map(async (path) => {
      if (stored.includes(path)) {
        return;
      }
      const url = signed[path];
      if (url === undefined) {
        failures.push({ path, reason: 'could not be signed' });
        return;
      }
      try {
        await putBlob(path, await fetchBytes(url));
        stored.push(path);
      }
      catch (error) {
        failures.push({ path, reason: messageOf(error) });
      }
    }));

    writeCachedChapter({
      chapter,
      images: stored,
      cachedAt: new Date().toISOString(),
    });
  }

  await evictOldImages(chapter.child_id);

  return {
    chapterId: chapter.id,
    imagesStored: stored.length,
    imagesExpected: paths.length,
    failures,
  };
}
