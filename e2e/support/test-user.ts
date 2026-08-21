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

/**
 * Ids of the accounts this run created, so teardown can delete them directly.
 *
 * Looking the account up by listing users is what made teardown silently
 * useless: `listUsers` fails for the whole project if any single row in
 * `auth.users` has NULL where GoTrue expects an empty string, and the old
 * teardown read that failure as "no such user, nothing to do". Deleting by an
 * id we already hold needs no listing and cannot be poisoned by another row.
 */
const provisionedIds = new Map<string, string>();

/** Creates the account ahead of the UI flow. Only used by the admin strategy. */
export async function provisionUser(user: TestUser): Promise<void> {
  if (AUTH_STRATEGY !== 'admin') {
    return;
  }
  const { data, error } = await adminClient().auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
  });
  if (error) {
    throw new Error(`could not provision the test user: ${error.message}`);
  }
  if (data.user) {
    provisionedIds.set(user.email, data.user.id);
  }
}

/**
 * Marks one address confirmed, for the sql-confirm strategy.
 *
 * Confirmation itself is just `email_confirmed_at` (`confirmed_at` is generated
 * from it); the empty-string writes below are hygiene, not confirmation. The
 * project's confirmation *setting* is left exactly as it is — this confirms a
 * single synthetic address and does not weaken sign-up for anyone.
 */
export function confirmEmail(email: string): void {
  const updated = sql(`
    update auth.users
       set email_confirmed_at = coalesce(email_confirmed_at, now()),
           -- GoTrue scans these as Go strings, so a NULL in any one of them
           -- makes admin.listUsers() fail for the ENTIRE project with
           -- "Database error finding users" — and an admin delete of that row
           -- fail with "Database error loading user", which leaves it stuck
           -- there poisoning every later run. This is the harness's only
           -- direct write to auth.users, so it is the one place that could
           -- introduce them; it writes '' instead, and repairs any it finds.
           confirmation_token         = coalesce(confirmation_token, ''),
           recovery_token             = coalesce(recovery_token, ''),
           email_change               = coalesce(email_change, ''),
           email_change_token_new     = coalesce(email_change_token_new, ''),
           email_change_token_current = coalesce(email_change_token_current, ''),
           phone_change               = coalesce(phone_change, ''),
           phone_change_token         = coalesce(phone_change_token, ''),
           reauthentication_token     = coalesce(reauthentication_token, '')
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
  if (AUTH_STRATEGY !== 'admin') {
    sql(`delete from auth.users where email = ${literal(email)};`);
    return;
  }

  const admin = adminClient();
  const id = provisionedIds.get(email) ?? await findUserId(admin, email);
  if (id === null) {
    throw new Error(
      `teardown could not find ${email} to delete. The account may still `
      + `exist — check the project before running again.`,
    );
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    // Loudly, on purpose. A teardown that swallows this leaks an account per
    // run and says nothing, which is exactly how five of them piled up.
    throw new Error(`teardown could not delete ${email}: ${error.message}`);
  }
  provisionedIds.delete(email);
}

/** Fallback for an account this process did not create. */
async function findUserId(
  admin: ReturnType<typeof adminClient>,
  email: string,
): Promise<string | null> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) {
    throw new Error(
      `teardown could not look up ${email}: ${error.message}. If this is `
      + `"Database error finding users", some row in auth.users has NULL `
      + `where GoTrue expects '' and no account can be listed until it is `
      + `repaired or removed.`,
    );
  }
  return data.users.find(u => u.email === email)?.id ?? null;
}
