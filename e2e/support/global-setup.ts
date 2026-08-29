import { guardAgainstProductionSupabase } from './guard-env';

/**
 * Playwright `globalSetup` — runs once before any spec, in both `stub` and
 * `live` mode. The one thing that must never happen silently is this harness
 * running against the production Supabase project (issue #19); everything
 * else about test setup stays per-spec.
 */
export default function globalSetup(): void {
  guardAgainstProductionSupabase();
}
