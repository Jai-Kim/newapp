import * as React from 'react';

import {
  getCustomerInfo,
  hasProEntitlement,
  subscribeToCustomerInfo,
} from './client';

/**
 * Whether this family currently holds the `pro` entitlement — the gate in
 * front of writing a new chapter (issue #14, ADR-0003).
 *
 * `loading` is only ever true for the first check; once RevenueCat has
 * answered once, `addCustomerInfoUpdateListener` keeps `isPro` current from
 * then on (a purchase completing, a subscription lapsing), so callers never
 * need to poll or refetch by hand.
 */
export function useProEntitlement(): { isPro: boolean; loading: boolean } {
  const [isPro, setIsPro] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    getCustomerInfo()
      .then((info) => {
        if (!cancelled) {
          setIsPro(hasProEntitlement(info));
        }
      })
      .catch(() => {
        // No entitlement info is the same as "not pro" — the paywall is the
        // correct thing to show, not a red error box.
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    const unsubscribe = subscribeToCustomerInfo((info) => {
      if (!cancelled) {
        setIsPro(hasProEntitlement(info));
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return { isPro, loading };
}
