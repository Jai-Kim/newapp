/**
 * The minimal surface this app needs from RevenueCat, named to match
 * `react-native-purchases`'s own types (`CustomerInfo`, `PurchasesOffering`,
 * `PurchasesPackage`, entitlement `PeriodType`) so a real adapter can satisfy
 * `PurchasesClient` by mapping the SDK's response almost field-for-field —
 * see `purchases-client.ts` for why there isn't one yet.
 */

export type EntitlementInfo = {
  identifier: string;
  isActive: boolean;
  willRenew: boolean;
  periodType: 'trial' | 'intro' | 'normal';
  expirationDate: string | null;
};

export type CustomerInfo = {
  /** Keyed by entitlement identifier, e.g. `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID`. */
  entitlements: Record<string, EntitlementInfo>;
};

export type PurchasesPackage = {
  identifier: string;
  product: {
    identifier: string;
    priceString: string;
    title: string;
  };
};

export type PurchasesOffering = {
  identifier: string;
  availablePackages: PurchasesPackage[];
};

export type PurchasesClient = {
  getCustomerInfo: () => Promise<CustomerInfo>;
  getOfferings: () => Promise<PurchasesOffering[]>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<CustomerInfo>;
  restorePurchases: () => Promise<CustomerInfo>;
};
