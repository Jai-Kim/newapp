import * as React from 'react';

import { useAuthStore as useAuth } from '@/features/auth/use-auth-store';
import { loginPurchases, logoutPurchases } from './client';

/**
 * Keeps RevenueCat's app user ID in step with the signed-in family
 * (issue #14, ADR-0003). Logging in with the Supabase user id — rather than
 * leaving RevenueCat on its own anonymous ID — is what lets a subscription
 * follow the account across devices and reinstalls.
 *
 * Mounted once, in the root layout's provider tree.
 */
export function usePurchasesAuthSync(): void {
  const userId = useAuth.use.session()?.user.id ?? null;

  React.useEffect(() => {
    if (userId === null) {
      logoutPurchases().catch(() => {});
      return;
    }
    loginPurchases(userId).catch(() => {});
  }, [userId]);
}
