import { Platform } from 'react-native';

import Env from 'env';

/** Falls back to a sane default so code can reference it before RevenueCat is set up. */
export const REVENUECAT_ENTITLEMENT_ID
  = Env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID ?? 'premium';

/**
 * The public RevenueCat SDK key for this platform, or `null` when it hasn't
 * been configured yet. These are the client-safe RevenueCat API keys (one
 * per store) — never the secret key, which would go server-side like every
 * other provider credential (ARCHITECTURE §5).
 */
export function revenueCatApiKey(): string | null {
  const key = Platform.OS === 'ios'
    ? Env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
    : Env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
  return key !== undefined && key.length > 0 ? key : null;
}
