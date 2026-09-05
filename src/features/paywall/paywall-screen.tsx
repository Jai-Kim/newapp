import type { PurchasesPackage } from 'react-native-purchases';
import { useRouter } from 'expo-router';

import * as React from 'react';
import {
  ActivityIndicator,
  Button,
  FocusAwareStatusBar,
  ScrollView,
  Text,
  View,
} from '@/components/ui';

import { messageOf } from '@/lib/errors';
import { readCachedChild } from '@/lib/offline/chapter-cache';
import {
  getProPackage,
  hasProEntitlement,
  isUserCancelledPurchase,
  purchaseProPackage,
  restorePurchases as restorePurchasesRequest,
} from '@/lib/purchases/client';
import { useProEntitlement } from '@/lib/purchases/use-pro-entitlement';

type Lead = 'en' | 'ko';

/** `[primary, secondary]` — `lead` decides which language reads first; both always render (ADR-0001 §1). */
function pair(lead: Lead, en: string, ko: string): [string, string] {
  return lead === 'ko' ? [ko, en] : [en, ko];
}

/**
 * ADR-0003's locked pricing, shown until a real Play/App Store product is
 * linked (issue #14: "Real Play products link at launch — build and test
 * against the key now"). Once an offering exists, `PricingCard` prefers the
 * live `introPriceString`/`priceString` RevenueCat reports over this.
 */
const FALLBACK_PRICE_EN = '$1.99 for your first 3 months, then $1.99 a month';
const FALLBACK_PRICE_KO = '처음 3개월은 $1.99, 이후 매달 $1.99';

function BilingualLines({ lead, en, ko, className }: { lead: Lead; en: string; ko: string; className?: string }) {
  const [primary, secondary] = pair(lead, en, ko);
  return (
    <>
      <Text className={className}>{primary}</Text>
      <Text className="text-neutral-500">{secondary}</Text>
    </>
  );
}

function PricingCard({
  lead,
  pkg,
  offerLoading,
}: {
  lead: Lead;
  pkg: PurchasesPackage | null;
  offerLoading: boolean;
}) {
  const introPriceString = pkg?.product.introPrice?.priceString ?? null;
  const priceString = pkg?.product.priceString ?? null;

  const livePriceEn = introPriceString && priceString
    ? `${introPriceString} to start, then ${priceString} a month`
    : null;
  const livePriceKo = introPriceString && priceString
    ? `첫 결제 ${introPriceString}, 이후 매달 ${priceString}`
    : null;

  return (
    <View className="gap-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      {offerLoading
        ? (
            <ActivityIndicator testID="paywall-price-loading" />
          )
        : (
            <View testID="paywall-price" className="gap-1">
              <BilingualLines
                lead={lead}
                en={livePriceEn ?? FALLBACK_PRICE_EN}
                ko={livePriceKo ?? FALLBACK_PRICE_KO}
                className="text-lg font-bold"
              />
            </View>
          )}
      <BilingualLines
        lead={lead}
        en="Cancel anytime — chapters you've already made are yours to keep."
        ko="언제든 취소할 수 있고, 이미 만든 챕터는 항상 간직할 수 있어요."
        className="text-sm text-neutral-500"
      />
    </View>
  );
}

function SubscribedCard({ lead }: { lead: Lead }) {
  return (
    <View testID="paywall-subscribed" className="gap-2 rounded-lg border border-primary-300 p-4 dark:border-primary-700">
      <BilingualLines
        lead={lead}
        en="You're all set — thanks for keeping the story going."
        ko="구독해 주셔서 감사해요 — 이야기가 계속 이어질 거예요."
        className="text-lg font-bold"
      />
    </View>
  );
}

/**
 * The paywall (issue #14, ADR-0003): RevenueCat wired to the `pro`
 * entitlement, gating new chapters behind $1.99-for-3-months → $1.99/month.
 * Reached from the nightly flow's subscribe prompt or from Settings.
 *
 * `lead` comes from the cached child, not a route param — this screen is
 * reachable from more than one place, and every caller would otherwise have
 * to thread the language through.
 */
export function PaywallScreen() {
  const router = useRouter();
  const lead: Lead = readCachedChild()?.primary_language ?? 'en';
  const { isPro, loading: proLoading } = useProEntitlement();

  const [pkg, setPkg] = React.useState<PurchasesPackage | null>(null);
  const [offerLoading, setOfferLoading] = React.useState(true);
  const [purchasing, setPurchasing] = React.useState(false);
  const [restoring, setRestoring] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [restoreNotice, setRestoreNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isPro) {
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
  }, [isPro]);

  const subscribe = async () => {
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
      if (!isUserCancelledPurchase(e)) {
        setError(messageOf(e));
      }
    }
    finally {
      setPurchasing(false);
    }
  };

  const restore = async () => {
    setRestoring(true);
    setError(null);
    setRestoreNotice(null);
    try {
      const info = await restorePurchasesRequest();
      if (hasProEntitlement(info)) {
        router.back();
        return;
      }
      setRestoreNotice(pair(
        lead,
        'No previous subscription found on this account.',
        '이 계정에서 이전 구독 내역을 찾지 못했어요.',
      )[0]);
    }
    catch (e) {
      setError(messageOf(e));
    }
    finally {
      setRestoring(false);
    }
  };

  if (proLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <>
      <FocusAwareStatusBar />
      <ScrollView>
        <View className="flex-1 gap-5 p-4 pb-12">
          <View className="gap-1">
            <BilingualLines
              lead={lead}
              en={isPro ? 'Your subscription' : 'Start this month\'s book'}
              ko={isPro ? '내 구독' : '이번 달 책을 시작해요'}
              className="text-2xl font-bold"
            />
          </View>

          {!isPro && (
            <BilingualLines
              lead={lead}
              en="About 10 chapters a month — roughly one finished book, at a pace that's kind to bedtime, not a race."
              ko="한 달에 약 10장 — 대략 책 한 권 분량이에요. 서두르지 않는, 잠들기 전 편안한 속도로요."
              className="text-neutral-600 dark:text-neutral-400"
            />
          )}

          {isPro
            ? <SubscribedCard lead={lead} />
            : <PricingCard lead={lead} pkg={pkg} offerLoading={offerLoading} />}

          {error !== null && (
            <View testID="paywall-error" className="rounded-md bg-danger-100 p-3 dark:bg-danger-900">
              <Text className="text-danger-800 dark:text-danger-100">{error}</Text>
            </View>
          )}

          {restoreNotice !== null && (
            <Text testID="paywall-restore-notice" className="text-neutral-500">{restoreNotice}</Text>
          )}

          {!isPro && (
            <Button
              testID="paywall-subscribe"
              label={purchasing
                ? pair(lead, 'Subscribing…', '구독하는 중…')[0]
                : pair(lead, 'Subscribe', '구독하기')[0]}
              disabled={purchasing || restoring || pkg === null}
              onPress={subscribe}
            />
          )}

          <Button
            testID="paywall-restore"
            variant="outline"
            label={restoring
              ? pair(lead, 'Restoring…', '복원하는 중…')[0]
              : pair(lead, 'Restore purchases', '구매 복원')[0]}
            disabled={purchasing || restoring}
            onPress={restore}
          />

          {isPro && (
            <Button
              testID="paywall-done"
              variant="ghost"
              label={pair(lead, 'Done', '완료')[0]}
              onPress={() => router.back()}
            />
          )}
        </View>
      </ScrollView>
    </>
  );
}
