import { renderHook, waitFor } from '@testing-library/react-native';

import { ALLOWANCE_SIZE } from './allowance';
import { useAllowance } from './use-allowance';

const mockListReadableChapters = jest.fn(async () => []);

jest.mock('@/lib/supabase/chapters', () => ({
  listReadableChapters: (...args: unknown[]) => mockListReadableChapters(...(args as [])),
}));

afterEach(() => {
  jest.clearAllMocks();
});

describe('useAllowance', () => {
  it('is null before a child is known', () => {
    const { result } = renderHook(() => useAllowance(null));
    expect(result.current.status).toBeNull();
    expect(mockListReadableChapters).not.toHaveBeenCalled();
  });

  it('loads this month\'s usage for the given child', async () => {
    mockListReadableChapters.mockResolvedValue(
      Array.from({ length: 3 }, (_, i) => ({
        id: `ch-${i + 1}`,
        created_at: new Date().toISOString(),
      })),
    );
    const { result } = renderHook(() => useAllowance('child-1'));

    await waitFor(() => expect(result.current.status).not.toBeNull());
    expect(result.current.status?.used).toBe(3);
    expect(result.current.status?.blocked).toBe(false);
    expect(mockListReadableChapters).toHaveBeenCalledWith('child-1');
  });

  it('blocks once the child has this month\'s full allowance', async () => {
    mockListReadableChapters.mockResolvedValue(
      Array.from({ length: ALLOWANCE_SIZE }, (_, i) => ({
        id: `ch-${i + 1}`,
        created_at: new Date().toISOString(),
      })),
    );
    const { result } = renderHook(() => useAllowance('child-1'));

    await waitFor(() => expect(result.current.status?.blocked).toBe(true));
  });
});
