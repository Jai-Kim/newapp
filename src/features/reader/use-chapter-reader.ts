import * as React from 'react';

import { useChapterSource } from '@/features/reader/use-chapter-source';
import { messageOf } from '@/lib/errors';
import { enqueueTomorrow, markChapterRead } from '@/lib/supabase/nightly';

/**
 * One chapter, read a page at a time.
 *
 * Loading lives in `useChapterSource` (device first, network second); this
 * hook is the paging and the two things reaching the end does — stamp the
 * chapter read, and let the parent choose what tomorrow is about.
 *
 * `read_at` is stamped at the END rather than on open: an opened-and-abandoned
 * chapter should still be tonight's chapter tomorrow.
 */
export function useChapterReader(chapterId: string) {
  const source = useChapterSource(chapterId);
  const { chapter, urls, child, setError } = source;

  const [index, setIndex] = React.useState(0);
  const [finished, setFinished] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const next = React.useCallback(() => {
    if (!chapter) {
      return;
    }
    if (index >= chapter.pages.length - 1) {
      setFinished(true);
      // Fire and forget: failing to record the read must not block the ending.
      markChapterRead(chapter.id).catch(() => {});
      return;
    }
    setIndex(i => i + 1);
  }, [chapter, index]);

  const previous = React.useCallback(() => setIndex(i => Math.max(0, i - 1)), []);

  const queueTomorrow = React.useCallback(
    async (lesson: string | undefined, situation: string | undefined) => {
      if (!child) {
        return;
      }
      setBusy(true);
      try {
        await enqueueTomorrow(child.id, lesson, situation);
      }
      catch (e) {
        setError(messageOf(e));
      }
      finally {
        setBusy(false);
      }
    },
    [child, setError],
  );

  return {
    chapter,
    lead: child?.primary_language ?? 'en',
    name: child?.first_name ?? 'your child',
    index,
    finished,
    loading: source.loading,
    busy,
    error: source.error,
    /** Reading from the device because the network was unreachable. */
    offline: source.offline,
    next,
    previous,
    queueTomorrow,
    imageUrlFor: (i: number) => {
      const path = chapter?.pages[i]?.image_path;
      return path ? urls[path] : undefined;
    },
  };
}
