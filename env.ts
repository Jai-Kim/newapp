import z from 'zod';

import packageJSON from './package.json';

// Single unified environment schema
const envSchema = z.object({
  EXPO_PUBLIC_APP_ENV: z.enum(['development', 'preview', 'production']),

  // Which app identity (bundle id / package / scheme) this build presents as
  // — independent of which backend it talks to (issue #22, follow-up to
  // #35/#19). Defaults to EXPO_PUBLIC_APP_ENV when unset, so every existing
  // profile keeps behaving exactly as it does today. A `closed-testing`
  // build sets APP_ENV=preview (to keep the production-Supabase guard live)
  // and APP_IDENTITY=production (to keep the Play-listing package name) —
  // see docs/runbook-environments.md.
  EXPO_PUBLIC_APP_IDENTITY: z.enum(['development', 'preview', 'production']),

  EXPO_PUBLIC_NAME: z.string(),
  EXPO_PUBLIC_SCHEME: z.string(),
  EXPO_PUBLIC_BUNDLE_ID: z.string(),
  EXPO_PUBLIC_PACKAGE: z.string(),
  EXPO_PUBLIC_VERSION: z.string(),
  EXPO_PUBLIC_API_URL: z.string().url(),
  EXPO_PUBLIC_ASSOCIATED_DOMAIN: z.string().url().optional(),
  EXPO_PUBLIC_VAR_NUMBER: z.number(),
  EXPO_PUBLIC_VAR_BOOL: z.boolean(),

  // Supabase — client-safe values only. The service-role key and every model
  // provider key stay server-side in Edge Functions (ARCHITECTURE §5).
  EXPO_PUBLIC_SUPABASE_URL: z.string().url(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string(),

  // Environment guard (issue #19) — see docs/runbook-environments.md. Unset
  // until a second (staging) Supabase project exists; the guard below no-ops
  // without it.
  EXPO_PUBLIC_PROD_SUPABASE_PROJECT_REF: z.string().optional(),

  // only available for app.config.ts usage
  APP_BUILD_ONLY_VAR: z.string().optional(),
});

// Config records per environment
const EXPO_PUBLIC_APP_ENV = (process.env.EXPO_PUBLIC_APP_ENV
  ?? 'development') as z.infer<typeof envSchema>['EXPO_PUBLIC_APP_ENV'];

// Defaults to APP_ENV when unset, so every profile that doesn't set it
// explicitly (i.e. every profile except `closed-testing`) is unaffected.
const EXPO_PUBLIC_APP_IDENTITY = (process.env.EXPO_PUBLIC_APP_IDENTITY
  ?? EXPO_PUBLIC_APP_ENV) as z.infer<typeof envSchema>['EXPO_PUBLIC_APP_IDENTITY'];

const BUNDLE_IDS = {
  development: 'com.storyloom.development',
  preview: 'com.storyloom.preview',
  production: 'com.storyloom',
} as const;

const PACKAGES = {
  development: 'com.storyloom.development',
  preview: 'com.storyloom.preview',
  production: 'com.storyloom',
} as const;

const SCHEMES = {
  development: 'storyloom',
  preview: 'storyloom.preview',
  production: 'storyloom',
} as const;

const NAME = 'storyloom';

// Check if strict validation is required (before prebuild)
const STRICT_ENV_VALIDATION = process.env.STRICT_ENV_VALIDATION === '1';

// Build env object
const _env: z.infer<typeof envSchema> = {
  EXPO_PUBLIC_APP_ENV,
  EXPO_PUBLIC_APP_IDENTITY,
  EXPO_PUBLIC_NAME: NAME,
  EXPO_PUBLIC_SCHEME: SCHEMES[EXPO_PUBLIC_APP_IDENTITY],
  EXPO_PUBLIC_BUNDLE_ID: BUNDLE_IDS[EXPO_PUBLIC_APP_IDENTITY],
  EXPO_PUBLIC_PACKAGE: PACKAGES[EXPO_PUBLIC_APP_IDENTITY],
  EXPO_PUBLIC_VERSION: packageJSON.version,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL ?? '',
  EXPO_PUBLIC_ASSOCIATED_DOMAIN: process.env.EXPO_PUBLIC_ASSOCIATED_DOMAIN,
  EXPO_PUBLIC_VAR_NUMBER: Number(process.env.EXPO_PUBLIC_VAR_NUMBER ?? 0),
  EXPO_PUBLIC_VAR_BOOL: process.env.EXPO_PUBLIC_VAR_BOOL === 'true',
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  EXPO_PUBLIC_PROD_SUPABASE_PROJECT_REF: process.env.EXPO_PUBLIC_PROD_SUPABASE_PROJECT_REF,
  APP_BUILD_ONLY_VAR: process.env.APP_BUILD_ONLY_VAR,
};

/**
 * Extracts the project ref from a hosted Supabase URL, e.g. "abcdefgh" from
 * "https://abcdefgh.supabase.co". `null` for anything else — a local stack
 * (`http://127.0.0.1:54321`), a malformed value, or an unrelated URL.
 */
export function supabaseProjectRef(url: string): string | null {
  return /^https:\/\/([^./]+)\.supabase\.co/i.exec(url)?.[1] ?? null;
}

/**
 * Refuses to start when a non-production build points at the PRODUCTION
 * Supabase project (issue #19) — the one E2E and dev sandboxes must never
 * touch, since it is where real families' data will live. A no-op until
 * `EXPO_PUBLIC_PROD_SUPABASE_PROJECT_REF` is set: with no second project yet,
 * there is nothing to guard against. See docs/runbook-environments.md.
 */
export function assertNotProductionSupabase(params: {
  appEnv: string;
  supabaseUrl: string;
  prodProjectRef: string | undefined;
}): void {
  const { appEnv, supabaseUrl, prodProjectRef } = params;
  if (!prodProjectRef || appEnv === 'production') {
    return;
  }
  const ref = supabaseProjectRef(supabaseUrl);
  if (ref !== null && ref === prodProjectRef) {
    throw new Error(
      `❌ Refusing to start: found the PRODUCTION Supabase project ("${ref}") `
      + `in EXPO_PUBLIC_SUPABASE_URL while EXPO_PUBLIC_APP_ENV="${appEnv}". `
      + `A non-production build must never read or write production data — `
      + `point this environment at the dev/staging project instead. See `
      + `docs/runbook-environments.md.`,
    );
  }
}

assertNotProductionSupabase({
  appEnv: _env.EXPO_PUBLIC_APP_ENV,
  supabaseUrl: _env.EXPO_PUBLIC_SUPABASE_URL,
  prodProjectRef: _env.EXPO_PUBLIC_PROD_SUPABASE_PROJECT_REF,
});

function getValidatedEnv(env: z.infer<typeof envSchema>) {
  const parsed = envSchema.safeParse(env);

  if (parsed.success === false) {
    const errorMessage
      = `❌ Invalid environment variables:${
        JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)
      }\n❌ Missing variables in .env file for APP_ENV=${EXPO_PUBLIC_APP_ENV}`
      + `\n💡 Tip: If you recently updated the .env file, try restarting with -c flag to clear the cache.`;

    if (STRICT_ENV_VALIDATION) {
      console.error(errorMessage);
      throw new Error('Invalid environment variables');
    }
  }
  else {
    console.log('✅ Environment variables validated successfully');
  }

  return parsed.success ? parsed.data : env;
}

const Env = STRICT_ENV_VALIDATION ? getValidatedEnv(_env) : _env;

export default Env;
