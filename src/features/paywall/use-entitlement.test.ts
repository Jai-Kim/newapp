import { renderHook, waitFor } from '@testing-library/react-native';

import { useEntitlement } from './use-entitlement';

const mockGetCustomerInfo = jest.fn(async () => ({ entitlements: {} }));

jest.mock('@/lib/purchases/purchases-client', () => ({
  getPurchasesClient: () => ({ getCustomerInfo: () => mockGetCustomerInfo() }),
}));

afterEach(() => {
  jest.clearAllMocks();
});

describe('useEntitlement', () => {
  it('starts loading, then settles on none with no active entitlement', async () => {
    mockGetCustomerInfo.mockResolvedValue({ entitlements: {} });
    const { result } = renderHook(() => useEntitlement());

    expect(result.current.state.status).toBe('loading');
    await waitFor(() => expect(result.current.state.status).toBe('none'));
  });

  it('reports trial for an active intro/trial-period entitlement', async () => {
    mockGetCustomerInfo.mockResolvedValue({
      entitlements: {
        premium: {
          identifier: 'premium',
          isActive: true,
          willRenew: true,
          periodType: 'intro',
          expirationDate: '2026-11-01T00:00:00.000Z',
        },
      },
    });
    const { result } = renderHook(() => useEntitlement());

    await waitFor(() => expect(result.current.state.status).toBe('trial'));
    expect(result.current.state).toEqual({
      status: 'trial',
      expiresAt: '2026-11-01T00:00:00.000Z',
    });
  });

  it('reports active for a normal, paid entitlement', async () => {
    mockGetCustomerInfo.mockResolvedValue({
      entitlements: {
        premium: {
          identifier: 'premium',
          isActive: true,
          willRenew: false,
          periodType: 'normal',
          expirationDate: '2026-12-01T00:00:00.000Z',
        },
      },
    });
    const { result } = renderHook(() => useEntitlement());

    await waitFor(() => expect(result.current.state.status).toBe('active'));
    expect(result.current.state).toEqual({
      status: 'active',
      willRenew: false,
      expiresAt: '2026-12-01T00:00:00.000Z',
    });
  });

  it('reports none for an entitlement that has expired', async () => {
    mockGetCustomerInfo.mockResolvedValue({
      entitlements: {
        premium: {
          identifier: 'premium',
          isActive: false,
          willRenew: false,
          periodType: 'normal',
          expirationDate: '2026-01-01T00:00:00.000Z',
        },
      },
    });
    const { result } = renderHook(() => useEntitlement());

    await waitFor(() => expect(result.current.state.status).toBe('none'));
  });
});
