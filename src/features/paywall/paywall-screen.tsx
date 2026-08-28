import type { PurchasesPackage } from '@/lib/purchases/types';

import * as React from 'react';

import {
  ActivityIndicator,
  Button,
  FocusAwareStatusBar,
  Pressable,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { ALLOWANCE_SIZE } from '@/features/paywall/allowance';
import { useEntitlement } from '@/features/paywall/use-entitlement';
import { messageOf } from '@/lib/errors';
import { readCachedChild } from '@/lib/offline/chapter-cache';
import { getPurchasesClient } from '@/lib/purchases/purchases-client';
import { listChildren } from '@/lib/supabase/chapters';

/**
 * The paywall (ADR-0003): $1.99 for the first 3 months, then $1.99/month,
 * including roughly one book's worth of chapters a month. Bilingual, like
 * every product screen — this is a family decision, and either grown-up
 * should be able to read it.
 *
 * Purchasing goes through `getPurchasesClient()`, which is a stub until the
 * `react-native-purchases` SDK is installed (see PR description) — until
 * then, `getOfferings()` returns nothing to buy and this screen says so
 * rather than pretending.
 */
export function PaywallScreen() {
  const { state, refresh } = useEntitlement();
  const [lead, setLead] = React.useState<'en' | 'ko'>('en');
  const [packages, setPackages] = React.useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const cached = readCachedChild();
    if (cached !== null) {
      setLead(cached.primary_language);
    }

    (async () => {
      try {
        const kids = await listChildren();
        if (kids.length > 0) {
          setLead(kids[0].primary_language);
        }
        const offerings = await getPurchasesClient().getOfferings();
        setPackages(offerings.flatMap(o => o.availablePackages));
      }
      catch (e) {
        setError(messageOf(e));
      }
      finally {
        setLoading(false);
      }
    })();
  }, []);

  const subscribe = async (pkg: PurchasesPackage) => {
    setBusy(true);
    setError(null);
    try {
      await getPurchasesClient().purchasePackage(pkg);
      await refresh();
    }
    catch (e) {
      setError(messageOf(e));
    }
    finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    setError(null);
    try {
      await getPurchasesClient().restorePurchases();
      await refresh();
    }
    catch (e) {
      setError(messageOf(e));
    }
    finally {
      setBusy(false);
    }
  };

  return (
    <>
      <FocusAwareStatusBar />
      <ScrollView>
        <View className="flex-1 gap-6 p-4 pb-12">
          <View
            testID="paywall-pricing"
            className="gap-2 rounded-xl border border-primary-300 p-5 dark:border-primary-700"
          >
            <Text className="font-bold">
              {lead === 'ko'
                ? '첫 3개월은 $1.99, 이후 매달 $1.99'
                : '$1.99 for your first 3 months, then $1.99/month'}
            </Text>
            <Text className="text-neutral-500">
              {lead === 'ko'
                ? '$1.99 for your first 3 months, then $1.99/month'
                : '첫 3개월은 $1.99, 이후 매달 $1.99'}
            </Text>
            <Text className="text-neutral-600 dark:text-neutral-400">
              {lead === 'ko'
                ? `매달 새 책 한 권 분량(챕터 약 ${ALLOWANCE_SIZE}개)이 포함돼요 — 넉넉한 리듬이지, 제한이 아니에요.`
                : `Includes about one new book each month (~${ALLOWANCE_SIZE} chapters) — a rhythm, not a limit.`}
            </Text>
            <Text className="text-neutral-500">
              {lead === 'ko'
                ? `Includes about one new book each month (~${ALLOWANCE_SIZE} chapters) — a rhythm, not a limit.`
                : `매달 새 책 한 권 분량(챕터 약 ${ALLOWANCE_SIZE}개)이 포함돼요 — 넉넉한 리듬이지, 제한이 아니에요.`}
            </Text>
          </View>

          {state.status === 'active' && (
            <Text testID="paywall-active" className="text-primary-600 dark:text-primary-400">
              {lead === 'ko' ? '이미 구독 중이에요.' : 'You’re already subscribed.'}
            </Text>
          )}

          {state.status === 'trial' && (
            <Text testID="paywall-trial" className="text-primary-600 dark:text-primary-400">
              {lead === 'ko' ? '체험 기간이 진행 중이에요.' : 'You’re in your trial period.'}
            </Text>
          )}

          {loading
            ? <ActivityIndicator />
            : packages.length === 0
              ? (
                  <Text testID="paywall-unavailable" className="text-neutral-500">
                    {lead === 'ko'
                      ? '구독 옵션을 아직 이용할 수 없어요.'
                      : 'Subscription options aren’t available yet.'}
                  </Text>
                )
              : (
                  packages.map(pkg => (
                    <Pressable
                      key={pkg.identifier}
                      testID={`subscribe-${pkg.identifier}`}
                      className="gap-1 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700"
                      onPress={() => subscribe(pkg)}
                      disabled={busy}
                    >
                      <Text className="font-bold">{pkg.product.title}</Text>
                      <Text className="text-neutral-500">{pkg.product.priceString}</Text>
                    </Pressable>
                  ))
                )}

          {error !== null && <Text className="text-danger-600">{error}</Text>}

          <Button
            label={lead === 'ko' ? '구매 복원' : 'Restore purchases'}
            variant="outline"
            onPress={restore}
            disabled={busy}
            testID="restore-purchases"
          />
        </View>
      </ScrollView>
    </>
  );
}
