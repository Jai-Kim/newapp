import type { CharacterChoices, Child } from '@/lib/supabase/types';

import * as React from 'react';

import { INITIAL_CHOICES, isComplete } from '@/lib/character/options';
import {
  AlreadyLockedError,
  lockCharacter,
  signCharacterRef,
} from '@/lib/supabase/character';
import { getMyChild } from '@/lib/supabase/onboarding';

/**
 * State for the look picker: load the child, hold the parent's answers, and
 * lock the sheet.
 *
 * Separated from the screen because "already locked" is not an error condition
 * but a fork in the flow — the parent has to be told what a re-draw would cost
 * before it happens — and that reads badly tangled into JSX.
 */
export function useCharacterLook() {
  const [child, setChild] = React.useState<Child | null>(null);
  const [choices, setChoices]
    = React.useState<Partial<CharacterChoices>>(INITIAL_CHOICES);
  const [sheetUrl, setSheetUrl] = React.useState<string | null>(null);
  const [locked, setLocked] = React.useState(false);
  const [drawing, setDrawing] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  /** Pages already drawn from the current sheet; non-null means "confirm". */
  const [relockCost, setRelockCost] = React.useState<number | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const kid = await getMyChild();
        setChild(kid);
        const ref = kid?.character_ref;
        if (ref) {
          // Returning to a sheet already locked: show it, and start the picker
          // on the answers they gave rather than on a blank form.
          setLocked(true);
          setChoices(prev => ref.choices ?? prev);
          setSheetUrl(await signCharacterRef(ref.identity.image_path));
        }
      }
      catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
      finally {
        setLoading(false);
      }
    })();
  }, []);

  const choose = React.useCallback(
    (key: keyof CharacterChoices, value: string) =>
      setChoices(prev => ({ ...prev, [key]: value })),
    [],
  );

  const draw = React.useCallback(async (relock: boolean) => {
    if (!child || !isComplete(choices)) {
      return;
    }
    setDrawing(true);
    setError(null);
    setRelockCost(null);
    try {
      const result = await lockCharacter(child.id, choices, { relock });
      setSheetUrl(result.preview_url);
      setLocked(true);
    }
    catch (e) {
      if (e instanceof AlreadyLockedError) {
        setRelockCost(e.illustratedPages);
      }
      else {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
    finally {
      setDrawing(false);
    }
  }, [child, choices]);

  return {
    name: child?.first_name ?? 'your child',
    choices,
    choose,
    complete: isComplete(choices),
    sheetUrl,
    locked,
    drawing,
    loading,
    error,
    relockCost,
    dismissRelock: React.useCallback(() => setRelockCost(null), []),
    draw,
  };
}
