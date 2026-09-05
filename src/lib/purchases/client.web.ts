import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

/**
 * Web build of the purchases client (metro/webpack pick this over
 * `client.ts` for web bundles, same convention as `lib/offline/blob-store`).
 * `react-native-purchases` wraps native StoreKit/Billing and has no web
 * story — the app builds for web only for the Playwright E2E harness
 * (docs/RISKS.md), which never needs to buy a subscription. Every export
 * here mirrors `client.ts`'s shape so nothing that imports
 * `@/lib/purchases/client` needs to know which platform it's on.
 */
export const isRevenueCatConfigured = false;

export async function loginPurchases(_appUserId: string): Promise<void> {}

export async function logoutPurchases(): Promise<void> {}

export function hasProEntitlement(_info: CustomerInfo): boolean {
  return false;
}

export async function getCustomerInfo(): Promise<CustomerInfo> {
  return { entitlements: { active: {} } } as CustomerInfo;
}

export function subscribeToCustomerInfo(
  _listener: (info: CustomerInfo) => void,
): () => void {
  return () => {};
}

export async function getProPackage(): Promise<PurchasesPackage | null> {
  return null;
}

export async function purchaseProPackage(
  _pkg: PurchasesPackage,
): Promise<CustomerInfo> {
  throw new Error('Subscribing isn\'t available on web yet — use the mobile app.');
}

export async function restorePurchases(): Promise<CustomerInfo> {
  return getCustomerInfo();
}

export function isUserCancelledPurchase(_error: unknown): boolean {
  return false;
}
