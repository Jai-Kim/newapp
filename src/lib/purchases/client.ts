import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import Env from 'env';
import Purchases from 'react-native-purchases';

import { PRO_ENTITLEMENT_ID } from './types';

/**
 * False until the RevenueCat public key lands in `.env` (repo secret
 * `EXPO_PUBLIC_REVENUECAT_KEY`, issue #14 / ADR-0003). Mirrors
 * `isSupabaseConfigured` (lib/supabase/client.ts) — gate any purchase call
 * on this so the app still boots without it rather than throwing at import
 * time.
 */
export const isRevenueCatConfigured = Env.EXPO_PUBLIC_REVENUECAT_KEY !== '';

if (!isRevenueCatConfigured && __DEV__) {
  console.warn(
    '[purchases] EXPO_PUBLIC_REVENUECAT_KEY is unset — the paywall has '
    + 'nothing to sell. Fill it in .env (see .env.example).',
  );
}

// Configuring at import time, not inside a React effect, means it always
// runs before anything that reads entitlements — a child component's effect
// can fire before a parent's (Providers) effect does, and a race here would
// mean the very first `getCustomerInfo()` call sees an unconfigured SDK.
if (isRevenueCatConfigured) {
  Purchases.configure({ apiKey: Env.EXPO_PUBLIC_REVENUECAT_KEY });
}

/**
 * Attaches RevenueCat's app user ID to the signed-in family, so a
 * subscription follows the account across devices and reinstalls the way
 * App Store/Play Store restore already expects.
 */
export async function loginPurchases(appUserId: string): Promise<void> {
  if (!isRevenueCatConfigured) {
    return;
  }
  await Purchases.logIn(appUserId);
}

/** Detaches from the signed-out family, reverting to an anonymous ID. */
export async function logoutPurchases(): Promise<void> {
  if (!isRevenueCatConfigured) {
    return;
  }
  await Purchases.logOut();
}

export function hasProEntitlement(info: CustomerInfo): boolean {
  return info.entitlements.active[PRO_ENTITLEMENT_ID] !== undefined;
}

export async function getCustomerInfo(): Promise<CustomerInfo> {
  if (!isRevenueCatConfigured) {
    return { entitlements: { active: {} } } as CustomerInfo;
  }
  return Purchases.getCustomerInfo();
}

/** Returns an unsubscribe function, matching the rest of this codebase's listener helpers. */
export function subscribeToCustomerInfo(
  listener: (info: CustomerInfo) => void,
): () => void {
  if (!isRevenueCatConfigured) {
    return () => {};
  }
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => Purchases.removeCustomerInfoUpdateListener(listener);
}

/**
 * The one subscription package this app sells — the monthly plan carrying
 * the $1.99-for-3-months intro offer (ADR-0003). Matched by `packageType`
 * first; `$rc_monthly` (RevenueCat's own default identifier for a monthly
 * package) is a fallback for an offering whose package type wasn't set to
 * `MONTHLY` for whatever reason but still uses the default identifier.
 */
export async function getProPackage(): Promise<PurchasesPackage | null> {
  if (!isRevenueCatConfigured) {
    return null;
  }
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current) {
    return null;
  }
  return (
    current.availablePackages.find(pkg => pkg.packageType === 'MONTHLY')
    ?? current.availablePackages.find(pkg => pkg.identifier === '$rc_monthly')
    ?? current.availablePackages[0]
    ?? null
  );
}

export async function purchaseProPackage(
  pkg: PurchasesPackage,
): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function restorePurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}

/** True when the caught purchase error was the parent backing out, not a real failure. */
export function isUserCancelledPurchase(error: unknown): boolean {
  return (
    typeof error === 'object'
    && error !== null
    && (error as { userCancelled?: unknown }).userCancelled === true
  );
}
