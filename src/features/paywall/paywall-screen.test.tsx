import * as React from 'react';

import { cleanup, screen, setup, waitFor } from '@/lib/test-utils';
import { PaywallScreen } from './paywall-screen';

/**
 * The paywall (issue #14, ADR-0003): $1.99-for-3-months intro → $1.99/month,
 * gating new chapters behind the `pro` entitlement. Covers the price falling
 * back to the ADR's locked copy when no offering is configured yet, showing
 * a live intro price once one is, the purchase/restore flows, and the
 * already-subscribed thank-you state.
 */

// jest.mock factories are hoisted above the file, so anything they close
// over has to be named `mock*` to be allowed through.
const mockGetCustomerInfo = jest.fn();
const mockGetProPackage = jest.fn();
const mockPurchaseProPackage = jest.fn();
const mockRestorePurchases = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();
let mockLead: 'en' | 'ko' | null = 'en';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

jest.mock('@/lib/offline/chapter-cache', () => ({
  readCachedChild: () => (mockLead === null ? null : { primary_language: mockLead }),
}));

jest.mock('@/lib/purchases/client', () => ({
  getCustomerInfo: (...args: unknown[]) => mockGetCustomerInfo(...(args as [])),
  hasProEntitlement: (info: { entitlements: { active: Record<string, unknown> } }) =>
    info.entitlements.active.pro !== undefined,
  subscribeToCustomerInfo: () => () => {},
  getProPackage: (...args: unknown[]) => mockGetProPackage(...(args as [])),
  purchaseProPackage: (...args: unknown[]) => mockPurchaseProPackage(...(args as [])),
  restorePurchases: (...args: unknown[]) => mockRestorePurchases(...(args as [])),
  isUserCancelledPurchase: (e: unknown) =>
    typeof e === 'object' && e !== null && (e as { userCancelled?: boolean }).userCancelled === true,
}));

const notPro = { entitlements: { active: {} } };
const pro = { entitlements: { active: { pro: {} } } };

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  mockLead = 'en';
});

describe('paywallScreen', () => {
  it('shows the ADR-locked fallback price when no offering is configured yet', async () => {
    mockGetCustomerInfo.mockResolvedValue(notPro);
    mockGetProPackage.mockResolvedValue(null);
    setup(<PaywallScreen />);

    expect(await screen.findByText(/\$1\.99 for your first 3 months, then \$1\.99 a month/))
      .toBeOnTheScreen();
    // Both languages, per ADR-0001 §1.
    expect(screen.getByText('처음 3개월은 $1.99, 이후 매달 $1.99')).toBeOnTheScreen();
    // Nothing to buy yet — the subscribe button stays disabled rather than erroring.
    expect(screen.getByTestId('paywall-subscribe')).toBeDisabled();
  });

  it('prefers the live intro price once an offering exists', async () => {
    mockGetCustomerInfo.mockResolvedValue(notPro);
    mockGetProPackage.mockResolvedValue({
      identifier: '$rc_monthly',
      packageType: 'MONTHLY',
      product: {
        priceString: '$1.99',
        introPrice: { priceString: '$1.99', period: 'P3M' },
      },
    });
    setup(<PaywallScreen />);

    expect(await screen.findByText('$1.99 to start, then $1.99 a month')).toBeOnTheScreen();
    expect(screen.getByTestId('paywall-subscribe')).not.toBeDisabled();
  });

  it('purchases the package and returns to the previous screen', async () => {
    mockGetCustomerInfo.mockResolvedValue(notPro);
    mockGetProPackage.mockResolvedValue({
      identifier: '$rc_monthly',
      packageType: 'MONTHLY',
      product: { priceString: '$1.99', introPrice: null },
    });
    mockPurchaseProPackage.mockResolvedValue(pro);
    const { user } = setup(<PaywallScreen />);

    await waitFor(() => expect(screen.getByTestId('paywall-subscribe')).not.toBeDisabled());
    await user.press(screen.getByTestId('paywall-subscribe'));

    await waitFor(() => expect(mockPurchaseProPackage).toHaveBeenCalled());
    expect(mockBack).toHaveBeenCalled();
  });

  it('shows an error for a real purchase failure, but stays silent when the parent just backs out', async () => {
    mockGetCustomerInfo.mockResolvedValue(notPro);
    mockGetProPackage.mockResolvedValue({
      identifier: '$rc_monthly',
      packageType: 'MONTHLY',
      product: { priceString: '$1.99', introPrice: null },
    });
    mockPurchaseProPackage.mockRejectedValueOnce({ userCancelled: true });
    const { user } = setup(<PaywallScreen />);

    await waitFor(() => expect(screen.getByTestId('paywall-subscribe')).not.toBeDisabled());
    await user.press(screen.getByTestId('paywall-subscribe'));

    await waitFor(() => expect(mockPurchaseProPackage).toHaveBeenCalledTimes(1));
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.queryByTestId('paywall-error')).not.toBeOnTheScreen();

    mockPurchaseProPackage.mockRejectedValueOnce(new Error('store unreachable'));
    await user.press(screen.getByTestId('paywall-subscribe'));

    expect(await screen.findByTestId('paywall-error')).toBeOnTheScreen();
    expect(screen.getByText('store unreachable')).toBeOnTheScreen();
  });

  it('restores a previous subscription and returns to the previous screen', async () => {
    mockGetCustomerInfo.mockResolvedValue(notPro);
    mockGetProPackage.mockResolvedValue(null);
    mockRestorePurchases.mockResolvedValue(pro);
    const { user } = setup(<PaywallScreen />);

    await screen.findByTestId('paywall-restore');
    await user.press(screen.getByTestId('paywall-restore'));

    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('tells the parent plainly when restoring finds nothing', async () => {
    mockGetCustomerInfo.mockResolvedValue(notPro);
    mockGetProPackage.mockResolvedValue(null);
    mockRestorePurchases.mockResolvedValue(notPro);
    const { user } = setup(<PaywallScreen />);

    await user.press(await screen.findByTestId('paywall-restore'));

    expect(await screen.findByTestId('paywall-restore-notice')).toBeOnTheScreen();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('shows the thank-you state, not the pricing card, once already subscribed', async () => {
    mockGetCustomerInfo.mockResolvedValue(pro);
    setup(<PaywallScreen />);

    expect(await screen.findByTestId('paywall-subscribed')).toBeOnTheScreen();
    expect(screen.getByText('You\'re all set — thanks for keeping the story going.')).toBeOnTheScreen();
    expect(screen.queryByTestId('paywall-subscribe')).not.toBeOnTheScreen();
    expect(mockGetProPackage).not.toHaveBeenCalled();
  });
});
