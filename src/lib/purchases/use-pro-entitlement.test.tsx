import type { CustomerInfo } from 'react-native-purchases';

import { act, renderHook, waitFor } from '@/lib/test-utils';
import { useProEntitlement } from './use-pro-entitlement';

// jest.mock factories are hoisted above the file, so anything they close
// over has to be named `mock*` to be allowed through.
const mockGetCustomerInfo = jest.fn();
const mockUnsubscribe = jest.fn();
let mockListener: ((info: CustomerInfo) => void) | null = null;

jest.mock('./client', () => ({
  getCustomerInfo: (...args: unknown[]) => mockGetCustomerInfo(...(args as [])),
  hasProEntitlement: (info: CustomerInfo) =>
    (info as unknown as { entitlements: { active: Record<string, unknown> } })
      .entitlements.active.pro !== undefined,
  subscribeToCustomerInfo: (listener: (info: CustomerInfo) => void) => {
    mockListener = listener;
    return mockUnsubscribe;
  },
}));

afterEach(() => {
  jest.clearAllMocks();
  mockListener = null;
});

function info(active: Record<string, unknown>): CustomerInfo {
  return { entitlements: { active } } as unknown as CustomerInfo;
}

describe('useProEntitlement', () => {
  it('starts loading and resolves to not-pro when nothing is active', async () => {
    mockGetCustomerInfo.mockResolvedValue(info({}));
    const { result } = renderHook(() => useProEntitlement());

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isPro).toBe(false);
  });

  it('resolves to pro when the entitlement is active', async () => {
    mockGetCustomerInfo.mockResolvedValue(info({ pro: {} }));
    const { result } = renderHook(() => useProEntitlement());

    await waitFor(() => expect(result.current.isPro).toBe(true));
    expect(result.current.loading).toBe(false);
  });

  it('updates live when a purchase completes mid-session', async () => {
    mockGetCustomerInfo.mockResolvedValue(info({}));
    const { result } = renderHook(() => useProEntitlement());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isPro).toBe(false);

    act(() => {
      mockListener?.(info({ pro: {} }));
    });

    expect(result.current.isPro).toBe(true);
  });

  it('treats a failed lookup as not-pro rather than throwing', async () => {
    mockGetCustomerInfo.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useProEntitlement());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isPro).toBe(false);
  });

  it('unsubscribes on unmount', async () => {
    mockGetCustomerInfo.mockResolvedValue(info({}));
    const { result, unmount } = renderHook(() => useProEntitlement());
    await waitFor(() => expect(result.current.loading).toBe(false));

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
