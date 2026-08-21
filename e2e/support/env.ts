import fs from 'node:fs';
import path from 'node:path';

/**
 * Test configuration.
 *
 * Reads the app's own `.env` so the harness always points at the same project
 * the app does — a suite that silently tested a different database than the one
 * being developed against would be worse than no suite.
 */

function loadDotEnv(): Record<string, string> {
  const file = path.join(process.cwd(), '.env');
  if (!fs.existsSync(file)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (match) {
      out[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  return out;
}

const dotenv = loadDotEnv();

function required(name: string): string {
  const value = process.env[name] ?? dotenv[name];
  if (!value) {
    throw new Error(
      `${name} is not set. The E2E harness needs the app's .env (or the same `
      + `values in the environment) to reach Supabase.`,
    );
  }
  return value;
}

export const SUPABASE_URL = required('EXPO_PUBLIC_SUPABASE_URL');
export const SUPABASE_ANON_KEY = required('EXPO_PUBLIC_SUPABASE_ANON_KEY');

export const MODE: 'stub' | 'live' = process.env.E2E_MODE === 'live' ? 'live' : 'stub';
export const IS_LIVE = MODE === 'live';

/**
 * Synthetic accounts are namespaced so teardown can find them and a human can
 * recognise them. `.invalid` is reserved by RFC 2606 and can never be a real
 * mailbox, so nothing here can accidentally mail a person.
 */
export const TEST_EMAIL_DOMAIN = 'storyloom-e2e.example.com';

/**
 * How the harness gets a signed-in session. See support/test-user.ts for what
 * each one costs and covers. Defaults to `admin` when a service-role key is
 * present, because that is the only strategy that survives repeated runs
 * against a project with email confirmation on.
 */
export const SERVICE_ROLE_KEY
  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? dotenv.SUPABASE_SERVICE_ROLE_KEY ?? '';

export type AuthStrategy = 'admin' | 'autoconfirm' | 'sql-confirm';

export const AUTH_STRATEGY: AuthStrategy
  = (process.env.E2E_AUTH as AuthStrategy | undefined)
    ?? (SERVICE_ROLE_KEY ? 'admin' : 'sql-confirm');
