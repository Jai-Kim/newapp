import type { SupabaseClient } from '@supabase/supabase-js';

import { expect, test } from '@playwright/test';

import { MONTHLY_CHAPTER_ALLOWANCE, QUOTA_MESSAGES } from './fixtures/quota';
import { seedMonthlyAttempts } from './support/db-generation-attempts';
import { createChild, lockCharacterLook, openApp, signIn } from './support/flow';
import { installStubs } from './support/stubs';
import {
  clientFor,
  confirmEmail,
  deleteTestUser,
  newTestUser,
  provisionUser,
} from './support/test-user';

/**
 * Abuse & cost protection on the chapter-generation path (issue #6): once a
 * child's month-to-date allowance is spent, the lesson picker gives way to a
 * warm, bilingual notice instead of quietly queuing another paid generation.
 *
 * Rate-limiting is not exercised here — it depends on wall-clock timing that
 * would make a browser suite flaky — see supabase/tests/generation_quota.sql
 * for that, and for the monthly guard against the real database function.
 * This spec proves the wiring: the Edge Function's 429 (replicated by the
 * stub, since stub mode never calls the real function — see the note at the
 * top of support/stubs.ts) reaches the Tonight screen as the same bilingual
 * copy, not a bare error.
 */

const CHILD_NAME = 'Nari';

test.describe('generation quota (issue #6)', () => {
  const user = newTestUser();

  test.afterAll(async () => {
    await deleteTestUser(user.email);
  });

  test('a warm, bilingual notice replaces the lesson picker once this month\'s book is full', async ({ page }) => {
    await openApp(page);
    await provisionUser(user);
    await signIn(page, user, () => confirmEmail(user.email));
    const db: SupabaseClient = await clientFor(user);

    await createChild(page, CHILD_NAME);
    const { data: child } = await db.from('children').select('id').single();
    const childId = child!.id as string;

    await installStubs({ page, db, childId: () => childId });
    await lockCharacterLook(page);

    const { data: authData } = await db.auth.getUser();
    seedMonthlyAttempts(authData.user!.id, childId, MONTHLY_CHAPTER_ALLOWANCE);

    await expect(page.getByText(/What should tomorrow be about\?/i))
      .toBeVisible({ timeout: 60_000 });
    await page.locator('[data-testid="queue-auto"]').click();

    await expect(page.locator('[data-testid="quota-notice"]'))
      .toBeVisible({ timeout: 30_000 });
    // Both languages render regardless of which leads (ADR-0001 §1) — the
    // child here is Korean-primary, so Korean leads, but the assertion does
    // not depend on which one does.
    await expect(page.getByText(QUOTA_MESSAGES.monthly_quota_reached.en))
      .toBeVisible();
    await expect(page.getByText(QUOTA_MESSAGES.monthly_quota_reached.ko))
      .toBeVisible();

    // Blocked has to mean blocked: nothing was queued, so nothing was spent.
    const { data: jobs } = await db
      .from('chapter_queue')
      .select('id')
      .eq('child_id', childId);
    expect(jobs ?? []).toHaveLength(0);
  });
});
