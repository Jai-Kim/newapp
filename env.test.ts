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

  it('throws for the closed-testing shape: appEnv=preview pointed at production', () => {
    // The whole point of splitting identity from backend environment
    // (issue #22, follow-up to #35): a closed-testing build sets
    // EXPO_PUBLIC_APP_ENV=preview (to keep this guard live) and
    // EXPO_PUBLIC_APP_IDENTITY=production (to keep the Play-listing package
    // name) — so a build that presents as "production" to the app store must
    // still refuse to start against the real production Supabase project.
    expect(() => assertNotProductionSupabase({
      appEnv: 'preview',
      supabaseUrl: prodUrl,
      prodProjectRef: PROD_REF,
    })).toThrow(/PRODUCTION Supabase project/);
  });
});

describe('EXPO_PUBLIC_APP_IDENTITY (issue #22, follow-up to #35)', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('defaults identity to APP_ENV when unset', () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'preview';
    delete process.env.EXPO_PUBLIC_APP_IDENTITY;

    const Env = require('./env').default;

    expect(Env.EXPO_PUBLIC_APP_IDENTITY).toBe('preview');
    expect(Env.EXPO_PUBLIC_PACKAGE).toBe('com.storyloom.preview');
    expect(Env.EXPO_PUBLIC_BUNDLE_ID).toBe('com.storyloom.preview');
    expect(Env.EXPO_PUBLIC_SCHEME).toBe('storyloom.preview');
  });

  it('lets identity override package/bundle/scheme independently of APP_ENV', () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'preview';
    process.env.EXPO_PUBLIC_APP_IDENTITY = 'production';

    const Env = require('./env').default;

    // Identity drives the app-store-facing values...
    expect(Env.EXPO_PUBLIC_APP_IDENTITY).toBe('production');
    expect(Env.EXPO_PUBLIC_PACKAGE).toBe('com.storyloom');
    expect(Env.EXPO_PUBLIC_BUNDLE_ID).toBe('com.storyloom');
    expect(Env.EXPO_PUBLIC_SCHEME).toBe('storyloom');
    // ...while APP_ENV — what the production-Supabase guard reads — is untouched.
    expect(Env.EXPO_PUBLIC_APP_ENV).toBe('preview');
  });

  it('falls back to APP_ENV when identity is an empty string, not just unset', () => {
    // dotenv parses `EXPO_PUBLIC_APP_IDENTITY=` (what .env.example ships) as
    // '', not undefined — a plain `?? fallback` never fires for that case.
    process.env.EXPO_PUBLIC_APP_ENV = 'preview';
    process.env.EXPO_PUBLIC_APP_IDENTITY = '';

    const Env = require('./env').default;

    expect(Env.EXPO_PUBLIC_APP_IDENTITY).toBe('preview');
    expect(Env.EXPO_PUBLIC_PACKAGE).toBe('com.storyloom.preview');
    expect(Env.EXPO_PUBLIC_BUNDLE_ID).toBe('com.storyloom.preview');
    expect(Env.EXPO_PUBLIC_SCHEME).toBe('storyloom.preview');
  });

  it('falls back to APP_ENV when identity is whitespace-only', () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'preview';
    process.env.EXPO_PUBLIC_APP_IDENTITY = '   ';

    const Env = require('./env').default;

    expect(Env.EXPO_PUBLIC_APP_IDENTITY).toBe('preview');
    expect(Env.EXPO_PUBLIC_PACKAGE).toBe('com.storyloom.preview');
  });

  it('falls back APP_ENV itself to development when set to an empty string', () => {
    process.env.EXPO_PUBLIC_APP_ENV = '';
    delete process.env.EXPO_PUBLIC_APP_IDENTITY;

    const Env = require('./env').default;

    expect(Env.EXPO_PUBLIC_APP_ENV).toBe('development');
    expect(Env.EXPO_PUBLIC_APP_IDENTITY).toBe('development');
    expect(Env.EXPO_PUBLIC_PACKAGE).toBe('com.storyloom.development');
  });
});
