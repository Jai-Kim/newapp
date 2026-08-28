import type { CustomerInfo, PurchasesClient, PurchasesOffering, PurchasesPackage } from '@/lib/purchases/types';

/**
 * `react-native-purchases` is not a project dependency yet. Adding it needs
 * `pnpm add react-native-purchases` plus its Expo config plugin, and this
 * sandbox cannot run `pnpm` (see the PR description) — so this ships a
 * client that behaves like "nothing purchased, nothing for sale" instead of
 * crashing every screen that asks about entitlements.
 *
 * Swapping in the real SDK is meant to be a single new file: implement
 * `PurchasesClient` against `Purchases.configure` / `getCustomerInfo` /
 * `getOfferings` / `purchasePackage` / `restorePurchases`, guarded by
 * `revenueCatApiKey()` from `@/lib/purchases/config`, and change what
 * `getPurchasesClient` returns below. Nothing that calls `getPurchasesClient()`
 * needs to change.
 */
function noEntitlements(): CustomerInfo {
  return { entitlements: {} };
}

const unconfiguredClient: PurchasesClient = {
  async getCustomerInfo() {
    return noEntitlements();
  },
  async getOfferings(): Promise<PurchasesOffering[]> {
    return [];
  },
  async purchasePackage(_pkg: PurchasesPackage): Promise<CustomerInfo> {
    throw new Error('Subscriptions are not available yet.');
  },
  async restorePurchases() {
    return noEntitlements();
  },
};

export function getPurchasesClient(): PurchasesClient {
  return unconfiguredClient;
}
