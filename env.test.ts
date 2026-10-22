import {
  assertNotProductionSupabase,
  assertProductionRevenueCatKey,
  supabaseProjectRef,
} from './env';

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

describe('eXPO_PUBLIC_APP_IDENTITY (issue #22, follow-up to #35)', () => {
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

describe('assertProductionRevenueCatKey', () => {
  const LIVE_ANDROID = 'goog_abcdefghijklmnopqrstuvwxyz';
  const LIVE_IOS = 'appl_abcdefghijklmnopqrstuvwxyz';
  const TEST_STORE = 'test_pUwtlTRIYrarVbhcYzHufVhn';

  describe('production', () => {
    it('accepts a live Google Play SDK key', () => {
      expect(() => assertProductionRevenueCatKey({
        appEnv: 'production',
        revenueCatKey: LIVE_ANDROID,
      })).not.toThrow();
    });

    it('accepts a live App Store SDK key', () => {
      expect(() => assertProductionRevenueCatKey({
        appEnv: 'production',
        revenueCatKey: LIVE_IOS,
      })).not.toThrow();
    });

    it('rejects a Test Store key, which charges nobody', () => {
      // The dangerous case: the paywall renders and the purchase flow
      // completes, so every "is the key set?" check passes while no money
      // moves. The message has to name it, or someone will spend an afternoon.
      expect(() => assertProductionRevenueCatKey({
        appEnv: 'production',
        revenueCatKey: TEST_STORE,
      })).toThrow(/Test Store key/);
    });

    it('rejects an empty key', () => {
      expect(() => assertProductionRevenueCatKey({
        appEnv: 'production',
        revenueCatKey: '',
      })).toThrow(/empty or unset/);
    });

    it('rejects an unset key', () => {
      expect(() => assertProductionRevenueCatKey({
        appEnv: 'production',
        revenueCatKey: undefined,
      })).toThrow(/empty or unset/);
    });

    it('rejects a whitespace-only key', () => {
      // dotenv parses `EXPO_PUBLIC_REVENUECAT_KEY= ` as ' ', not undefined.
      expect(() => assertProductionRevenueCatKey({
        appEnv: 'production',
        revenueCatKey: '   ',
      })).toThrow(/empty or unset/);
    });

    it('rejects a secret key, which must never be an EXPO_PUBLIC_ var', () => {
      expect(() => assertProductionRevenueCatKey({
        appEnv: 'production',
        revenueCatKey: 'sk_livexxxxxxxxxxxxxxxxxxxx',
      })).toThrow(/not a public SDK key/);
    });

    it('says how to fix it, not just that it is wrong', () => {
      expect(() => assertProductionRevenueCatKey({
        appEnv: 'production',
        revenueCatKey: TEST_STORE,
      })).toThrow(/eas env:set --environment production/);
    });
  });

  describe('every other environment', () => {
    it.each(['preview', 'development', 'staging'])(
      'lets %s use a Test Store key',
      (appEnv) => {
        expect(() => assertProductionRevenueCatKey({
          appEnv,
          revenueCatKey: TEST_STORE,
        })).not.toThrow();
      },
    );

    it.each(['preview', 'development', 'staging'])(
      'lets %s have no key at all',
      (appEnv) => {
        // Preview builds routinely run without one; the runtime treats an
        // unconfigured RevenueCat as "nothing to sell, so no gate".
        expect(() => assertProductionRevenueCatKey({
          appEnv,
          revenueCatKey: '',
        })).not.toThrow();
      },
    );
  });
});

describe('the RevenueCat guard runs on import', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  /**
   * The property that actually closes the hole. Validation inside
   * `getValidatedEnv` only runs under STRICT_ENV_VALIDATION, which the
   * `prebuild:*` scripts set and an EAS cloud build does not — so a rule
   * placed there would never fire on the one build that matters.
   */
  it('throws for a production build with a test key, with STRICT off', () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'production';
    process.env.EXPO_PUBLIC_REVENUECAT_KEY = 'test_pUwtlTRIYrarVbhcYzHufVhn';
    delete process.env.STRICT_ENV_VALIDATION;

    expect(() => require('./env')).toThrow(/Test Store key/);
  });

  it('throws for a production build with no key, with STRICT off', () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'production';
    delete process.env.EXPO_PUBLIC_REVENUECAT_KEY;
    delete process.env.STRICT_ENV_VALIDATION;

    expect(() => require('./env')).toThrow(/empty or unset/);
  });

  it('loads a preview build with a test key', () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'preview';
    process.env.EXPO_PUBLIC_REVENUECAT_KEY = 'test_pUwtlTRIYrarVbhcYzHufVhn';
    delete process.env.STRICT_ENV_VALIDATION;

    expect(() => require('./env')).not.toThrow();
  });

  it('loads a production build with a live key', () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'production';
    process.env.EXPO_PUBLIC_REVENUECAT_KEY = 'goog_abcdefghijklmnopqrstuvwxyz';
    delete process.env.STRICT_ENV_VALIDATION;

    expect(() => require('./env')).not.toThrow();
  });
});
