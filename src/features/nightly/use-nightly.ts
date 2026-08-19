import type { ChildRow } from '@/lib/supabase/chapters';
import type { NightlyState } from '@/lib/supabase/nightly';
import * as React from 'react';

import { messageOf } from '@/lib/errors';

import { listChildren } from '@/lib/supabase/chapters';
import { enqueueTomorrow, getNightlyState, sweepQueue } from '@/lib/supabase/nightly';

/** How often to re-check while a chapter is being written. */
const WRITING_POLL_MS = 8000;

/**
 * The home screen's state.
 *
 * Polls only while something is actually being written. Generation takes ~93s
 * plus illustration, so a parent who opens the app mid-write wants to see it
 * finish; the rest of the time there is nothing to poll for and a timer would
 * just cost battery.
 */
export function useNightly() {
  const [child, setChild] = React.useState<ChildRow | null>(null);
  const [state, setState] = React.useState<NightlyState | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async (childId: string) => {
    try {
      setState(await getNightlyState(childId));
    }
    catch (e) {
      setError(messageOf(e));
    }
  }, []);

  React.useEffect(() => {
    (async () => {
      try {
        const kids = await listChildren();
        if (kids.length === 0) {
          setState({ kind: 'empty' });
          return;
        }
        setChild(kids[0]);
        // Heal a queue whose worker died before showing anything, so the
        // parent sees "writing" rather than a stuck empty state.
        await sweepQueue(kids[0].id);
        await refresh(kids[0].id);
      }
      catch (e) {
        setError(messageOf(e));
      }
    })();
  }, [refresh]);

  const writing = state?.kind === 'writing';
  React.useEffect(() => {
    if (!writing || !child) {
      return;
    }
    const timer = setInterval(() => refresh(child.id), WRITING_POLL_MS);
    return () => clearInterval(timer);
  }, [writing, child, refresh]);

  const queue = React.useCallback(
    async (lesson: string | undefined, situation: string | undefined) => {
      if (!child) {
        return;
      }
      setBusy(true);
      setError(null);
      try {
        await enqueueTomorrow(child.id, lesson, situation);
        await refresh(child.id);
      }
      catch (e) {
        setError(messageOf(e));
      }
      finally {
        setBusy(false);
      }
    },
    [child, refresh],
  );

  return {
    child,
    name: child?.first_name ?? 'your child',
    state,
    busy,
    error,
    queue,
    refresh: React.useCallback(
      () => (child ? refresh(child.id) : Promise.resolve()),
      [child, refresh],
    ),
  };
}
