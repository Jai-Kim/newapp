import type { AllowanceStatus } from '@/features/paywall/allowance';

import * as React from 'react';

import { computeAllowanceStatus } from '@/features/paywall/allowance';
import { listReadableChapters } from '@/lib/supabase/chapters';

/** This month's chapter allowance for one child, or `null` before the first load. */
export function useAllowance(childId: string | null) {
  const [status, setStatus] = React.useState<AllowanceStatus | null>(null);

  const refresh = React.useCallback(async () => {
    if (childId === null) {
      setStatus(null);
      return;
    }
    const chapters = await listReadableChapters(childId);
    setStatus(computeAllowanceStatus(chapters));
  }, [childId]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { status, refresh };
}
