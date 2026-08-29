import { PROD_SUPABASE_PROJECT_REF, SUPABASE_URL } from './env';

/**
 * Refuses to run the E2E harness against the PRODUCTION Supabase project
 * (issue #19). This harness creates and deletes real users/rows against
 * whatever `EXPO_PUBLIC_SUPABASE_URL` resolves to, and in `live` mode calls
 * real model providers with real money — the one thing it must never do
 * silently is any of that against production.
 *
 * A no-op until `EXPO_PUBLIC_PROD_SUPABASE_PROJECT_REF` is set: with no
 * second (staging) Supabase project yet, there is nothing to compare against.
 * See docs/runbook-environments.md.
 *
 * Deliberately NOT gated on an app-env value the way `env.ts`'s own guard is
 * — this harness is destructive by design, so a match on the production ref
 * is refused unconditionally, regardless of what `EXPO_PUBLIC_APP_ENV`
 * happens to be set to for a given run.
 *
 * The ref-matching logic below is a small, deliberate duplicate of
 * `supabaseProjectRef` in the root `env.ts` rather than a shared import: this
 * file runs in a plain Node process reading `.env`/`.env.e2e` by hand (see
 * `./env.ts`), while `env.ts` builds the RN/Expo bundle's own config — two
 * different runtimes, same precedent the project already accepted for
 * `CHAPTER_MONTHLY_ALLOWANCE` (issue #6) rather than forcing a shared module
 * that doesn't cleanly serve either side. It is unit-tested there, as
 * `assertNotProductionSupabase` in `env.test.ts` — jest's
 * `testPathIgnorePatterns` excludes all of `e2e/` (the Playwright specs here
 * import `@playwright/test`, which jest cannot load), so this file has no
 * direct jest coverage of its own; it is a thin, manually reviewed mirror of
 * the tested comparison.
 */
function supabaseProjectRef(url: string): string | null {
  return /^https:\/\/([^./]+)\.supabase\.co/i.exec(url)?.[1] ?? null;
}

export function guardAgainstProductionSupabase(
  supabaseUrl: string = SUPABASE_URL,
  prodProjectRef: string | undefined = PROD_SUPABASE_PROJECT_REF,
): void {
  if (!prodProjectRef) {
    return;
  }
  const ref = supabaseProjectRef(supabaseUrl);
  if (ref !== null && ref === prodProjectRef) {
    throw new Error(
      `❌ Refusing to run the E2E harness: EXPO_PUBLIC_SUPABASE_URL points at `
      + `the PRODUCTION Supabase project ("${ref}"). This harness creates and `
      + `deletes test users/rows and, in \`live\` mode, spends real provider `
      + `money — point .env at a dev/staging project instead. See `
      + `docs/runbook-environments.md.`,
    );
  }
}
