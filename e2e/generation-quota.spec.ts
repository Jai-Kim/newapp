import { expect, test } from '@playwright/test';

import { seedGenerationAttempts } from './support/db-generation-attempts';
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
 * The server-side spend guard on chapter generation (issue #6): once a
 * child's month-to-date chapter count reaches the allowance, the app shows a
 * warm bilingual notice instead of queueing another chapter.
 *
 * A full month's worth of attempts is seeded directly against the database
 * (generation_attempts has no client-facing insert policy — see
 * 0010_generation_quota.sql — so this goes through the same privileged path
 * db-print-orders.ts and db-jobs.ts already use), rather than driving ten
 * real enqueue round-trips through the UI. The per-user rate limit and the
 * reservation function itself are exercised by
 * supabase/tests/generation_quota.sql against a real Postgres connection
 * instead — rate limiting depends on wall-clock timing, which would make a
 * browser e2e test flaky for no real coverage gain.
 */

const CHILD_NAME = 'Yuna';

test.describe('chapter generation quota', () => {
  const user = newTestUser();

  test.afterAll(async () => {
    await deleteTestUser(user.email);
  });

  test('a used-up monthly allowance blocks with a warm bilingual notice, not a bare error', async ({ page }) => {
    await openApp(page);
    await provisionUser(user);
    await signIn(page, user, () => confirmEmail(user.email));
    const db = await clientFor(user);

    await createChild(page, CHILD_NAME);
    const { data: child } = await db.from('children').select('id').single();
    const childId = child!.id as string;
    const { data: authData } = await db.auth.getUser();
    const userId = authData.user!.id;

    await installStubs({ page, db, childId: () => childId });

    // A full month's worth already spent for this child.
    seedGenerationAttempts(userId, childId, 10);

    await lockCharacterLook(page);
    await expect(page.getByText(/What should tomorrow be about\?/i))
      .toBeVisible({ timeout: 60_000 });

    // "You choose for me" — the shortest path to a request, and the one an
    // already-tired parent is most likely to take.
    await page.locator('[data-testid="queue-auto"]').click();

    await expect(page.locator('[data-testid="quota-notice"]'))
      .toBeVisible({ timeout: 15_000 });
    // Bilingual, per ADR-0001 §1 — both languages render regardless of lead.
    await expect(page.getByText('This month\'s book is finished! A new one starts next month.'))
      .toBeVisible();
    await expect(page.getByText('이번 달 책이 완성되었어요! 다음 달에 새 책이 시작돼요.'))
      .toBeVisible();
    // Blocked, not queued: the picker itself is gone, and no job exists.
    await expect(page.getByText(/What should tomorrow be about\?/i)).not.toBeVisible();

    const { data: jobs } = await db.from('chapter_queue').select('id').eq('child_id', childId);
    expect(jobs, 'a blocked request should not have queued a job').toHaveLength(0);
  });
});
