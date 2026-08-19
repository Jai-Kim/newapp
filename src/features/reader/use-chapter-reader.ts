import type { ChildReadableChapter } from '@/lib/supabase/types';
import * as React from 'react';

import { messageOf } from '@/lib/errors';

import { getReadableChapter, listChildren, signImagePaths } from '@/lib/supabase/chapters';
import { enqueueTomorrow, markChapterRead } from '@/lib/supabase/nightly';

/**
 * One chapter, read a page at a time.
 *
 * `read_at` is stamped when the reader reaches the end rather than when the
 * chapter is opened — an opened-and-abandoned chapter should still be tonight's
 * chapter tomorrow.
 */
export function useChapterReader(chapterId: string) {
  const [chapter, setChapter] = React.useState<ChildReadableChapter | null>(null);
  const [urls, setUrls] = React.useState<Record<string, string>>({});
  const [lead, setLead] = React.useState<'en' | 'ko'>('en');
  const [name, setName] = React.useState('your child');
  const [childId, setChildId] = React.useState<string | null>(null);
  const [index, setIndex] = React.useState(0);
  const [finished, setFinished] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const [ch, kids] = await Promise.all([
          getReadableChapter(chapterId),
          listChildren(),
        ]);
        setChapter(ch);
        if (kids.length > 0) {
          setLead(kids[0].primary_language);
          setName(kids[0].first_name);
          setChildId(kids[0].id);
        }
        setUrls(
          await signImagePaths(
            ch.pages.map(p => p.image_path).filter(Boolean) as string[],
          ),
        );
      }
      catch (e) {
        setError(messageOf(e));
      }
      finally {
        setLoading(false);
      }
    })();
  }, [chapterId]);

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
      if (!childId) {
        return;
      }
      setBusy(true);
      try {
        await enqueueTomorrow(childId, lesson, situation);
      }
      catch (e) {
        setError(messageOf(e));
      }
      finally {
        setBusy(false);
      }
    },
    [childId],
  );

  return {
    chapter,
    lead,
    name,
    index,
    finished,
    loading,
    busy,
    error,
    next,
    previous,
    queueTomorrow,
    imageUrlFor: (i: number) => {
      const path = chapter?.pages[i]?.image_path;
      return path ? urls[path] : undefined;
    },
  };
}
