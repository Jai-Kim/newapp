import { assertNotProductionSupabase, supabaseProjectRef } from './env';

describe('supabaseProjectRef', () => {
  it('extracts the ref from a hosted Supabase URL', () => {
    expect(supabaseProjectRef('https://abcdefgh.supabase.co')).toBe('abcdefgh');
  });

  it('returns null for a local Supabase stack', () => {
    expect(supabaseProjectRef('http://127.0.0.1:54321')).toBeNull();
  });

  it('returns null for an unrelated URL', () => {
    expect(supabaseProjectRef('https://example.com')).toBeNull();
  });
});

describe('assertNotProductionSupabase (issue #19)', () => {
  const PROD_REF = 'prodref123';
  const prodUrl = `https://${PROD_REF}.supabase.co`;
  const stagingUrl = 'https://stagingref456.supabase.co';

  it('is a no-op when EXPO_PUBLIC_PROD_SUPABASE_PROJECT_REF is unset', () => {
    expect(() => assertNotProductionSupabase({
      appEnv: 'development',
      supabaseUrl: prodUrl,
      prodProjectRef: undefined,
    })).not.toThrow();
  });

  it('throws when a non-production env points at the production project', () => {
    expect(() => assertNotProductionSupabase({
      appEnv: 'development',
      supabaseUrl: prodUrl,
      prodProjectRef: PROD_REF,
    })).toThrow(/PRODUCTION Supabase project/);
  });

  it('allows the production env to point at the production project', () => {
    expect(() => assertNotProductionSupabase({
      appEnv: 'production',
      supabaseUrl: prodUrl,
      prodProjectRef: PROD_REF,
    })).not.toThrow();
  });

  it('allows a non-production env pointing at a staging project', () => {
    expect(() => assertNotProductionSupabase({
      appEnv: 'development',
      supabaseUrl: stagingUrl,
      prodProjectRef: PROD_REF,
    })).not.toThrow();
  });
});
