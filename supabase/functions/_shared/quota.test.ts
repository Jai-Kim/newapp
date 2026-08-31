import type { SupabaseClient } from '@supabase/supabase-js';

import { loadQuotaConfig, QuotaExceededError, reserveGenerationSlot } from './quota';

/**
 * The first unit test for a `_shared/` Deno function file in this repo.
 * `quota.ts` only imports `SupabaseClient` as a *type* (via `jsr:` — resolved
 * away entirely once TypeScript erases the import), so Jest can load it like
 * any other module. `Deno.env` is stubbed globally for the config tests.
 */

describe('loadQuotaConfig', () => {
  const originalDeno = (globalThis as { Deno?: unknown }).Deno;

  afterEach(() => {
    (globalThis as { Deno?: unknown }).Deno = originalDeno;
  });

  function stubEnv(vars: Record<string, string>) {
    (globalThis as { Deno?: unknown }).Deno = {
      env: { get: (name: string) => vars[name] },
    };
  }

  it('falls back to the documented defaults when nothing is set', () => {
    stubEnv({});
    expect(loadQuotaConfig()).toEqual({
      rateLimitMax: 3,
      rateLimitWindowMs: 60_000,
      monthlyAllowance: 10,
    });
  });

  it('reads overrides from env', () => {
    stubEnv({
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

  it('ignores an unparsable or non-positive override rather than trusting it', () => {
    stubEnv({ GENERATION_RATE_LIMIT_MAX: 'not-a-number', CHAPTER_MONTHLY_ALLOWANCE: '0' });
    const config = loadQuotaConfig();
    expect(config.rateLimitMax).toBe(3);
    expect(config.monthlyAllowance).toBe(10);
  });
});

describe('quotaExceededError', () => {
  it('carries a machine-readable code and warm bilingual copy', () => {
    const err = new QuotaExceededError('monthly_quota_exceeded');
    expect(err.status).toBe(429);
    expect(err.code).toBe('monthly_quota_exceeded');
    expect(err.messageEn).toMatch(/this month's book is finished/i);
    expect(err.messageKo).toContain('완성되었어요');
  });

  it('toBody() is not a bare 429 — it carries the code and both languages', () => {
    const err = new QuotaExceededError('rate_limited');
    expect(err.toBody()).toEqual({
      ok: false,
      code: 'rate_limited',
      error: err.messageEn,
      message_en: err.messageEn,
      message_ko: err.messageKo,
    });
  });
});

describe('reserveGenerationSlot', () => {
  // An explicit config on every call, never the `= loadQuotaConfig()` default
  // — that default reads `Deno.env`, which does not exist in this Jest/Node
  // process, and none of these tests are about config loading (see the
  // `loadQuotaConfig` suite above for that).
  const config = { rateLimitMax: 3, rateLimitWindowMs: 60_000, monthlyAllowance: 10 };

  function fakeSupabase(rpcResult: { data: unknown; error: unknown }): SupabaseClient {
    return { rpc: jest.fn().mockResolvedValue(rpcResult) } as unknown as SupabaseClient;
  }

  it('resolves silently when the reservation succeeds', async () => {
    const supabase = fakeSupabase({ data: 'ok', error: null });
    await expect(
      reserveGenerationSlot(supabase, 'user-1', 'child-1', config),
    ).resolves.toBeUndefined();

    expect(supabase.rpc).toHaveBeenCalledWith('reserve_generation_attempt', {
      p_user_id: 'user-1',
      p_child_id: 'child-1',
      p_rate_limit_max: 3,
      p_rate_limit_window_ms: 60_000,
      p_monthly_allowance: 10,
    });
  });

  it('throws QuotaExceededError when the DB function reports rate_limited', async () => {
    const supabase = fakeSupabase({ data: 'rate_limited', error: null });
    await expect(
      reserveGenerationSlot(supabase, 'user-1', 'child-1', config),
    ).rejects.toThrow(QuotaExceededError);
  });

  it('throws QuotaExceededError when the DB function reports monthly_quota_exceeded', async () => {
    const supabase = fakeSupabase({ data: 'monthly_quota_exceeded', error: null });
    await expect(
      reserveGenerationSlot(supabase, 'user-1', 'child-1', config),
    ).rejects.toMatchObject({ code: 'monthly_quota_exceeded' });
  });

  it('rethrows a plain Postgres/RPC error untranslated', async () => {
    const dbError = new Error('connection reset');
    const supabase = fakeSupabase({ data: null, error: dbError });
    await expect(
      reserveGenerationSlot(supabase, 'user-1', 'child-1', config),
    ).rejects.toBe(dbError);
  });
});
