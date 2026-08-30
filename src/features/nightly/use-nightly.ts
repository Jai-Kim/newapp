import type { ChildRow } from '@/lib/supabase/chapters';
import type { NightlyState } from '@/lib/supabase/nightly';
import * as React from 'react';

import { messageOf } from '@/lib/errors';

import {
  cacheChild,
  isFullyOffline,
  readCachedChapters,
  readCachedChild,
} from '@/lib/offline/chapter-cache';
import { downloadChapter } from '@/lib/offline/download-chapter';
import { listChildren } from '@/lib/supabase/chapters';
import {
  enqueueTomorrow,
  GenerationQuotaError,
  getNightlyState,
  sweepQueue,
} from '@/lib/supabase/nightly';

/** How often to re-check while a chapter is being written. */
const WRITING_POLL_MS = 8000;

/** Bilingual copy for a blocked request (issue #6) — not a punishment. */
export type QuotaNotice = { messageEn: string; messageKo: string };

/**
 * What tonight looks like with no network: the oldest downloaded chapter
 * nobody has read yet. Bedtime does not stop because the wifi did (issue #10).
 */
function offlineState(childId: string): NightlyState {
  const unread = readCachedChapters(childId)
    .filter(chapter => chapter.read_at === null)
    .sort((a, b) => a.number - b.number);

  return unread.length > 0
    ? { kind: 'ready', chapter: unread[0] }
    : { kind: 'offline_empty' };
}

/**
 * The home screen's state.
 *
 * Polls only while something is actually being written. Generation takes ~93s
 * plus illustration, so a parent who opens the app mid-write wants to see it
 * finish; the rest of the time there is nothing to poll for and a timer would
 * just cost battery.
 */
/**
 * Re-checks only while a chapter is actually being written.
 *
 * Generation takes ~93s plus illustration, so a parent who opens the app
 * mid-write wants to watch it land. The rest of the time there is nothing to
 * poll for and a timer would only cost battery.
 */
function usePollWhileWriting(
  writing: boolean,
  child: ChildRow | null,
  refresh: (childId: string) => Promise<void>,
): void {
  React.useEffect(() => {
    if (!writing || child === null) {
      return;
    }
    const timer = setInterval(() => refresh(child.id), WRITING_POLL_MS);
    return () => clearInterval(timer);
  }, [writing, child, refresh]);
}

/** Queuing tomorrow's chapter, with its own busy and error handling. */
function useQueueTomorrow(
  child: ChildRow | null,
  refresh: (childId: string) => Promise<void>,
  report: {
    setBusy: (busy: boolean) => void;
    setError: (message: string | null) => void;
    setQuotaNotice: (notice: QuotaNotice | null) => void;
  },
) {
  const { setBusy, setError, setQuotaNotice } = report;
  return React.useCallback(
    async (lesson: string | undefined, situation: string | undefined) => {
      if (child === null) {
        return;
      }
      setBusy(true);
      setError(null);
      setQuotaNotice(null);
      try {
        await enqueueTomorrow(child.id, lesson, situation);
        await refresh(child.id);
      }
      catch (e) {
        // A blocked allowance is a warm, expected state, not the generic red
        // error — it gets its own bilingual notice instead (issue #6).
        if (e instanceof GenerationQuotaError) {
          setQuotaNotice({ messageEn: e.messageEn, messageKo: e.messageKo });
        }
        else {
          setError(messageOf(e));
        }
      }
      finally {
        setBusy(false);
      }
    },
    [child, refresh, setBusy, setError, setQuotaNotice],
  );
}

export function useNightly() {
  const [child, setChild] = React.useState<ChildRow | null>(null);
  const [state, setState] = React.useState<NightlyState | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [offline, setOffline] = React.useState(false);
  /** Tonight's chapter, pictures and all, is on the device. */
  const [savedOffline, setSavedOffline] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [quotaNotice, setQuotaNotice] = React.useState<QuotaNotice | null>(null);

  const refresh = React.useCallback(async (childId: string) => {
    try {
      const next = await getNightlyState(childId);
      setState(next);
      setOffline(false);

      // Tonight's chapter is the one that has to survive a dead connection, so
      // it gets downloaded as soon as we know which it is. The parent is not
      // waiting on this, but they are told when it lands — knowing the story
      // will work in the car is worth a line of text.
      if (next.kind === 'ready') {
        const chapterId = next.chapter.id;
        setSavedOffline(await isFullyOffline(chapterId));
        downloadChapter(next.chapter)
          .then(async () => setSavedOffline(await isFullyOffline(chapterId)))
          .catch(() => {});
      }
      else {
        setSavedOffline(false);
      }
    }
    catch (e) {
      // Falling back to what is on the device is the whole point; only say
      // something went wrong if there is nothing to fall back to.
      const fallback = offlineState(childId);
      setOffline(true);
      setState(fallback);
      if (fallback.kind === 'offline_empty') {
        setError(messageOf(e));
      }
    }
  }, []);

  // Bootstrap, kept out of the hook body so the hook stays readable: start
  // from whatever is on the device, then let the network correct it.
  const start = React.useCallback(async () => {
    const cached = readCachedChild();
    if (cached !== null) {
      // An offline start still knows whose bedtime this is, and can therefore
      // reach the chapters already downloaded for them.
      setChild(cached);
      setState(offlineState(cached.id));
    }

    try {
      const kids = await listChildren();
      if (kids.length === 0) {
        setState(cached === null ? { kind: 'empty' } : offlineState(cached.id));
        return;
      }
      setChild(kids[0]);
      cacheChild(kids[0]);
      // Heal a queue whose worker died before showing anything, so the parent
      // sees "writing" rather than a stuck empty state.
      await sweepQueue(kids[0].id);
      await refresh(kids[0].id);
    }
    catch (e) {
      if (cached === null) {
        setError(messageOf(e));
        return;
      }
      setOffline(true);
      setState(offlineState(cached.id));
    }
  }, [refresh]);

  React.useEffect(() => {
    start();
  }, [start]);

  usePollWhileWriting(state?.kind === 'writing', child, refresh);

  const queue = useQueueTomorrow(child, refresh, { setBusy, setError, setQuotaNotice });

  return {
    child,
    name: child?.first_name ?? 'your child',
    state,
    busy,
    offline,
    savedOffline,
    error,
    quotaNotice,
    queue,
    refresh: React.useCallback(
      () => (child ? refresh(child.id) : Promise.resolve()),
      [child, refresh],
    ),
  };
}
