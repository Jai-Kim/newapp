import * as React from 'react';

import { cleanup, screen, setup, waitFor } from '@/lib/test-utils';
import { PaywallScreen } from './paywall-screen';

const mockListChildren = jest.fn(async () => [
  { id: 'child-1', first_name: 'Yuna', primary_language: 'en' },
]);
const mockGetCustomerInfo = jest.fn(async () => ({ entitlements: {} }));
const mockGetOfferings = jest.fn(async () => []);
const mockPurchasePackage = jest.fn(async () => ({ entitlements: {} }));
const mockRestorePurchases = jest.fn(async () => ({ entitlements: {} }));

jest.mock('@/lib/offline/chapter-cache', () => ({
  readCachedChild: () => null,
}));

jest.mock('@/lib/supabase/chapters', () => ({
  listChildren: (...args: unknown[]) => mockListChildren(...(args as [])),
}));

jest.mock('@/lib/purchases/purchases-client', () => ({
  getPurchasesClient: () => ({
    getCustomerInfo: () => mockGetCustomerInfo(),
    getOfferings: () => mockGetOfferings(),
    purchasePackage: (pkg: unknown) => mockPurchasePackage(pkg),
    restorePurchases: () => mockRestorePurchases(),
  }),
}));

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  mockGetCustomerInfo.mockResolvedValue({ entitlements: {} });
  mockGetOfferings.mockResolvedValue([]);
});

describe('paywallScreen', () => {
  it('shows the ADR-0003 pricing bilingually, and says offerings are not yet available (no RevenueCat SDK wired in)', async () => {
    setup(<PaywallScreen />);

    expect(await screen.findByTestId('paywall-pricing')).toBeOnTheScreen();
    expect(screen.getByText('$1.99 for your first 3 months, then $1.99/month')).toBeOnTheScreen();
    expect(screen.getByText('첫 3개월은 $1.99, 이후 매달 $1.99')).toBeOnTheScreen();

    await waitFor(() =>
      expect(screen.getByTestId('paywall-unavailable')).toBeOnTheScreen());
  });

  it('lists purchasable packages and buys the one that is pressed', async () => {
    mockGetOfferings.mockResolvedValue([
      {
        identifier: 'default',
        availablePackages: [
          {
            identifier: 'monthly',
            product: { identifier: 'storyloom.monthly', priceString: '$1.99', title: 'Monthly' },
          },
        ],
      },
    ]);
    const { user } = setup(<PaywallScreen />);

    await user.press(await screen.findByTestId('subscribe-monthly'));
    await waitFor(() =>
      expect(mockPurchasePackage).toHaveBeenCalledWith(
        expect.objectContaining({ identifier: 'monthly' }),
      ));
  });

  it('says when the family is already subscribed', async () => {
    mockGetCustomerInfo.mockResolvedValue({
      entitlements: {
        premium: {
          identifier: 'premium',
          isActive: true,
          willRenew: true,
          periodType: 'normal',
          expirationDate: null,
        },
      },
    });
    setup(<PaywallScreen />);

    expect(await screen.findByTestId('paywall-active')).toBeOnTheScreen();
  });

  it('says when the family is in their trial', async () => {
    mockGetCustomerInfo.mockResolvedValue({
      entitlements: {
        premium: {
          identifier: 'premium',
          isActive: true,
          willRenew: true,
          periodType: 'trial',
          expirationDate: '2026-09-01T00:00:00.000Z',
        },
      },
    });
    setup(<PaywallScreen />);

    expect(await screen.findByTestId('paywall-trial')).toBeOnTheScreen();
  });

  it('restores purchases on request', async () => {
    const { user } = setup(<PaywallScreen />);

    await user.press(await screen.findByTestId('restore-purchases'));
    await waitFor(() => expect(mockRestorePurchases).toHaveBeenCalled());
  });
});
