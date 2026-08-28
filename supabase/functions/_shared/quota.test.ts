import {
  loadQuotaConfig,
  QuotaExceededError,
  quotaErrorResponse,
  reserveGenerationSlot,
} from './quota';

/**
 * Pure logic worth covering directly, even though this file lives beside the
 * Deno Edge Functions rather than under src/: the config parsing, the
 * bilingual failure shape, and reserveGenerationSlot's translation of the
 * database's verdict into either success or a typed error are exactly the
 * kind of thing that is easy to get subtly wrong (issue #6) and easy to test
 * without a database. `quota.ts` only ever imports `SupabaseClient` as a
 * type, so nothing here needs the `Deno` global — see readEnv's comment.
 */

describe('loadQuotaConfig', () => {
  afterEach(() => {
    delete (globalThis as { Deno?: unknown }).Deno;
  });

  function withEnv(vars: Record<string, string>) {
    const store = new Map(Object.entries(vars));
    (globalThis as { Deno?: unknown }).Deno = {
      env: { get: (name: string) => store.get(name) },
    };
  }

  it('falls back to conservative defaults with no Deno global at all', () => {
    expect(loadQuotaConfig()).toEqual({
      rateLimitMax: 3,
      rateLimitWindowMs: 60_000,
      monthlyAllowance: 10,
    });
  });

  it('mirrors VOLUME_SIZE (10) by default, so the spend guard and the book allowance agree', () => {
    expect(loadQuotaConfig().monthlyAllowance).toBe(10);
  });

  it('reads valid overrides from env', () => {
    withEnv({
      GENERATION_RATE_LIMIT_MAX: '5',
      GENERATION_RATE_LIMIT_WINDOW_MS: '30000',
      CHAPTER_MONTHLY_ALLOWANCE: '20',
    });
    expect(loadQuotaConfig()).toEqual({
      rateLimitMax: 5,
      rateLimitWindowMs: 30_000,
      monthlyAllowance: 20,
    });
  });

  it.each(['0', '-1', 'not-a-number', ''])(
    'ignores an invalid override (%s) and keeps the default',
    (bad) => {
      withEnv({ CHAPTER_MONTHLY_ALLOWANCE: bad });
      expect(loadQuotaConfig().monthlyAllowance).toBe(10);
    },
  );

  it('does not throw when a real Deno-shaped env simply has none of these keys set', () => {
    withEnv({});
    expect(() => loadQuotaConfig()).not.toThrow();
  });
});

describe('quotaExceededError', () => {
  it('gives rate_limited a bilingual, warm — not a bare 429 — body', () => {
    const err = new QuotaExceededError('rate_limited');
    const body = err.toBody();
    expect(body.code).toBe('rate_limited');
    expect(body.message_en).toMatch(/wait a minute/i);
    expect(body.message_ko).toMatch(/잠시 후/);
    expect(body.resets_at).toBeUndefined();
  });

  it('includes resets_at for monthly_quota_reached when the DB provides one', () => {
    const err = new QuotaExceededError('monthly_quota_reached', '2026-09-01T00:00:00.000Z');
    const body = err.toBody();
    expect(body.code).toBe('monthly_quota_reached');
    expect(body.message_en).toMatch(/next month/i);
    expect(body.message_ko).toMatch(/다음 달/);
    expect(body.resets_at).toBe('2026-09-01T00:00:00.000Z');
  });
});

describe('quotaErrorResponse', () => {
  it('returns null for an unrelated error, so callers fall through to the generic handler', () => {
    expect(quotaErrorResponse(new Error('boom'))).toBeNull();
  });

  it('returns the 429 body and status for a QuotaExceededError', () => {
    const result = quotaErrorResponse(new QuotaExceededError('rate_limited'));
    expect(result?.status).toBe(429);
    expect(result?.body.code).toBe('rate_limited');
  });
});

/** A minimal double: only `.rpc` is exercised. */
function fakeSupabase(rpcResult: { data?: unknown; error?: unknown }) {
  return { rpc: jest.fn().mockResolvedValue(rpcResult) } as unknown as Parameters<
    typeof reserveGenerationSlot
  >[0];
}

describe('reserveGenerationSlot', () => {
  const params = {
    userId: 'user-1',
    childId: 'child-1',
    source: 'enqueue-chapter' as const,
  };

  it('resolves without error when the database allows the call', async () => {
    const supabase = fakeSupabase({ data: { allowed: true } });
    await expect(reserveGenerationSlot(supabase, params)).resolves.toBeUndefined();
  });

  it('throws QuotaExceededError with the reason the database returned', async () => {
    const supabase = fakeSupabase({
      data: { allowed: false, reason: 'monthly_quota_reached', resets_at: '2026-09-01T00:00:00.000Z' },
    });
    await expect(reserveGenerationSlot(supabase, params)).rejects.toMatchObject({
      reason: 'monthly_quota_reached',
      resetsAt: '2026-09-01T00:00:00.000Z',
    });
  });

  it('propagates a raw database error rather than swallowing it', async () => {
    const supabase = fakeSupabase({ error: new Error('connection refused') });
    await expect(reserveGenerationSlot(supabase, params)).rejects.toThrow('connection refused');
  });

  it('rejects with a clear error if the database blocks with no reason', async () => {
    const supabase = fakeSupabase({ data: { allowed: false } });
    await expect(reserveGenerationSlot(supabase, params)).rejects.toThrow(/no reason/);
  });
});
