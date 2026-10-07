import type { PurchasesPackage } from 'react-native-purchases';

import { useRouter } from 'expo-router';
import * as React from 'react';

import { messageOf } from '@/lib/errors';
import {
  getProPackage,
  hasProEntitlement,
  isUserCancelledPurchase,
  purchaseProPackage,
  restorePurchases as restorePurchasesRequest,
} from '@/lib/purchases/client';
import { useProEntitlement } from '@/lib/purchases/use-pro-entitlement';

/**
 * Everything the paywall does, separated from everything it says.
 *
 * The screen renders two languages of every line (ADR-0001 §1), which is a lot
 * of JSX; keeping the offer fetch, the purchase and the restore in here is what
 * stops the two concerns growing into one 157-line function. Same shape as
 * `useNightly` and `useChapterSource`.
 */
export function usePaywall(restoreFailedMessage: string) {
  const router = useRouter();
  const { isPro, loading: proLoading } = useProEntitlement();

  const [pkg, setPkg] = React.useState<PurchasesPackage | null>(null);
  const [offerLoading, setOfferLoading] = React.useState(true);
  const [purchasing, setPurchasing] = React.useState(false);
  const [restoring, setRestoring] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [restoreNotice, setRestoreNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Wait for the entitlement to settle before asking the store for an
    // offering. `isPro` is false while it is still loading, so acting on it
    // early fetches a price for someone who already subscribes — a wasted
    // round-trip, and a flash of the pricing card on a slow connection.
    if (proLoading || isPro) {
      return;
    }
    let cancelled = false;
    getProPackage()
      .then((p) => {
        if (!cancelled) {
          setPkg(p);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setOfferLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isPro, proLoading]);

  const subscribe = React.useCallback(async () => {
    if (pkg === null) {
      return;
    }
    setPurchasing(true);
    setError(null);
    try {
      await purchaseProPackage(pkg);
      router.back();
    }
    catch (e) {
      // Backing out of the store sheet is a decision, not a failure; showing
      // an error for it would tell a parent something went wrong when they
      // simply changed their mind.
      if (!isUserCancelledPurchase(e)) {
        setError(messageOf(e));
      }
    }
    finally {
      setPurchasing(false);
    }
  }, [pkg, router]);

  const restore = React.useCallback(async () => {
    setRestoring(true);
    setError(null);
    setRestoreNotice(null);
    try {
      const info = await restorePurchasesRequest();
      if (hasProEntitlement(info)) {
        router.back();
        return;
      }
      setRestoreNotice(restoreFailedMessage);
    }
    catch (e) {
      setError(messageOf(e));
    }
    finally {
      setRestoring(false);
    }
  }, [restoreFailedMessage, router]);

  return {
    isPro,
    proLoading,
    pkg,
    offerLoading,
    purchasing,
    restoring,
    error,
    restoreNotice,
    subscribe,
    restore,
  };
}
