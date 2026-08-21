import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

import { literal, sql } from './db';
import {
  AUTH_STRATEGY,
  SERVICE_ROLE_KEY,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  TEST_EMAIL_DOMAIN,
} from './env';

/**
 * A throwaway account per run, and getting one is the least obvious part of
 * this harness.
 *
 * The project requires email confirmation — correct for production, and it
 * means a programmatic sign-up yields a user with no session. Worse for a test
 * suite, every sign-up sends a mail through Supabase's built-in SMTP, which is
 * rate-limited to a handful an hour; a suite that signs up on every run stops
 * working by the third run of the morning.
 *
 * So there are three strategies and the right one depends on the target:
 *
 *   admin        A service-role client creates the user already confirmed. No
 *                mail is sent, so it is the only option that survives repeated
 *                CI runs against a project with confirmation on. Needs
 *                SUPABASE_SERVICE_ROLE_KEY in the test environment only — it
 *                must never reach the app bundle (ARCHITECTURE §5).
 *
 *   autoconfirm  Sign-up through the app's own screen returns a session
 *                immediately. This is what a local `supabase start` does out of
 *                the box, and what a project with "Confirm email" turned off
 *                does. Exercises the real sign-up UI; costs nothing.
 *
 *   sql-confirm  Sign up through the screen, then mark that one address
 *                confirmed over the CLI's privileged connection. Exercises the
 *                real sign-up UI against a project with confirmation ON, but
 *                still sends one mail per run, so it is for occasional runs
 *                rather than CI.
 */

export type TestUser = { email: string; password: string };

export function newTestUser(): TestUser {
  return {
    // example.com is reserved by RFC 2606 and has no mail service, so a stray
    // run can never reach a real person. (`.invalid` would be safer still, but
    // Supabase rejects the TLD outright.)
    email: `e2e-${randomUUID().replace(/-/g, '')}@${TEST_EMAIL_DOMAIN}`,
    password: `Pw-${randomUUID().slice(0, 18)}`,
  };
}

function adminClient() {
  if (!SERVICE_ROLE_KEY) {
    throw new Error('the admin strategy needs SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Creates the account ahead of the UI flow. Only used by the admin strategy. */
export async function provisionUser(user: TestUser): Promise<void> {
  if (AUTH_STRATEGY !== 'admin') {
    return;
  }
  const { error } = await adminClient().auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
  });
  if (error) {
    throw new Error(`could not provision the test user: ${error.message}`);
  }
}

/**
 * Marks one address confirmed, for the sql-confirm strategy.
 *
 * Only `email_confirmed_at` is touched — `confirmed_at` is generated from it —
 * and the project's confirmation *setting* is left exactly as it is. This
 * confirms a single synthetic address; it does not weaken sign-up for anyone.
 */
export function confirmEmail(email: string): void {
  const updated = sql(`
    update auth.users
       set email_confirmed_at = coalesce(email_confirmed_at, now())
     where email = ${literal(email)}
    returning id;
  `);
  if (updated.length === 0) {
    throw new Error(`sign-up did not create ${email}`);
  }
}

/**
 * A client authenticated as the test user — same anon key, same RLS as the
 * app, so assertions see exactly what the app is allowed to see and nothing
 * more. Deliberately not a service-role client: an assertion that could read
 * past RLS would not be checking the same thing the app checks.
 */
export async function clientFor(user: TestUser) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword(user);
  if (error) {
    throw new Error(`could not sign in as the test user: ${error.message}`);
  }
  return client;
}

/**
 * Removes the account and everything under it. `families.auth_user_id`
 * cascades from `auth.users`, and every Story Bible table cascades from
 * `families`, so one delete is the whole cleanup.
 */
export async function deleteTestUser(email: string): Promise<void> {
  if (AUTH_STRATEGY === 'admin') {
    const admin = adminClient();
    const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
    const found = data?.users.find(u => u.email === email);
    if (found) {
      await admin.auth.admin.deleteUser(found.id);
    }
    return;
  }
  sql(`delete from auth.users where email = ${literal(email)};`);
}
