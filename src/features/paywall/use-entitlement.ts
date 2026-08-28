import type { EntitlementInfo } from '@/lib/purchases/types';

import * as React from 'react';

import { REVENUECAT_ENTITLEMENT_ID } from '@/lib/purchases/config';
import { getPurchasesClient } from '@/lib/purchases/purchases-client';

export type EntitlementState
  = | { status: 'loading' }
    | { status: 'none' }
    | { status: 'trial'; expiresAt: string | null }
    | { status: 'active'; willRenew: boolean; expiresAt: string | null };

function toState(entitlement: EntitlementInfo | undefined): EntitlementState {
  if (entitlement === undefined || !entitlement.isActive) {
    return { status: 'none' };
  }
  if (entitlement.periodType === 'trial' || entitlement.periodType === 'intro') {
    return { status: 'trial', expiresAt: entitlement.expirationDate };
  }
  return {
    status: 'active',
    willRenew: entitlement.willRenew,
    expiresAt: entitlement.expirationDate,
  };
}

/** Whether this family currently has a working subscription — trial, intro, or paid. */
export function useEntitlement() {
  const [state, setState] = React.useState<EntitlementState>({ status: 'loading' });

  const refresh = React.useCallback(async () => {
    const info = await getPurchasesClient().getCustomerInfo();
    setState(toState(info.entitlements[REVENUECAT_ENTITLEMENT_ID]));
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { state, refresh };
}
