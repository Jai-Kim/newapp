import type { ChildRow } from '@/lib/supabase/chapters';
import type { ChildReadableChapter } from '@/lib/supabase/types';

import * as React from 'react';

import { messageOf } from '@/lib/errors';
import {
  cacheChild,
  readCachedChapter,
  readCachedChild,
  resolveImageUris,
} from '@/lib/offline/chapter-cache';
import { downloadChapter } from '@/lib/offline/download-chapter';
import { getReadableChapter, listChildren, signImagePaths } from '@/lib/supabase/chapters';

/**
 * Where a chapter comes from: the device first, the network second (issue #10).
 *
 * Cache FIRST, not cache-as-fallback. Network-first with a fallback makes
 * every bedtime on weak wifi sit through a timeout before showing a single
 * word — which is the same as being broken, only slower. A chapter already
 * downloaded opens with no network at all, and the refresh that follows is
 * best-effort: by the time it fails, the parent is already reading.
 *
 * Separated from `useChapterReader` so that hook is only about paging.
 */
export function useChapterSource(chapterId: string) {
  const [chapter, setChapter] = React.useState<ChildReadableChapter | null>(null);
  const [urls, setUrls] = React.useState<Record<string, string>>({});
  const [child, setChild] = React.useState<ChildRow | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [offline, setOffline] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      // 1. Whatever is already on the device, shown immediately.
      const cached = readCachedChapter(chapterId);
      const cachedChild = readCachedChild();

      if (cachedChild !== null) {
        setChild(cachedChild);
      }
      if (cached !== null) {
        setChapter(cached.chapter);
        setUrls(await resolveImageUris(cached.chapter));
        setLoading(false);
      }

      // 2. Then the network, to refresh and to fill any gaps.
      try {
        const [fresh, kids] = await Promise.all([
          getReadableChapter(chapterId),
          listChildren(),
        ]);
        setChapter(fresh);
        if (kids.length > 0) {
          setChild(kids[0]);
          cacheChild(kids[0]);
        }

        const paths = fresh.pages
          .map(page => page.image_path)
          .filter((path): path is string => path !== undefined);
        setUrls(await resolveImageUris(fresh, await signImagePaths(paths)));

        // Opening a chapter is what marks it worth keeping. Fire and forget:
        // the parent should not wait on a download they did not ask for.
        downloadChapter(fresh).catch(() => {});
      }
      catch (e) {
        // Only an error when there was nothing cached to fall back on;
        // otherwise this is just a normal night on bad wifi.
        if (cached === null) {
          setError(messageOf(e));
        }
        else {
          setOffline(true);
        }
      }
      finally {
        setLoading(false);
      }
    })();
  }, [chapterId]);

  return { chapter, urls, child, loading, offline, error, setError };
}
