import type { CustomerInfo } from 'react-native-purchases';

import { hasProEntitlement, isUserCancelledPurchase } from './client';

function customerInfo(active: Record<string, unknown>): CustomerInfo {
  return { entitlements: { active } } as unknown as CustomerInfo;
}

describe('hasProEntitlement', () => {
  it('is true when the pro entitlement is active', () => {
    expect(hasProEntitlement(customerInfo({ pro: {} }))).toBe(true);
  });

  it('is false with no active entitlements', () => {
    expect(hasProEntitlement(customerInfo({}))).toBe(false);
  });

  it('is false when a different entitlement is active', () => {
    expect(hasProEntitlement(customerInfo({ other: {} }))).toBe(false);
  });
});

describe('isUserCancelledPurchase', () => {
  it('is true for a RevenueCat cancellation', () => {
    expect(isUserCancelledPurchase({ userCancelled: true })).toBe(true);
  });

  it('is false for a real purchase error', () => {
    expect(isUserCancelledPurchase({ userCancelled: false, message: 'boom' })).toBe(false);
  });

  it('is false for a plain Error', () => {
    expect(isUserCancelledPurchase(new Error('network down'))).toBe(false);
  });

  it('is false for a non-object throw', () => {
    expect(isUserCancelledPurchase('nope')).toBe(false);
  });
});
