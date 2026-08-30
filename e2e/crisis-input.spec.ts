import { expect, test } from '@playwright/test';

import { CRISIS_FIXTURE_SITUATION, NEAR_MISS_FIXTURE_SITUATION } from './fixtures/crisis';
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
 * Input-side crisis screening (issue #13): a situation that discloses
 * something Storyloom shouldn't turn into a bedtime story must yield a warm,
 * bilingual care notice with real resources — not a chapter, not a spent
 * provider call, not a consumed quota slot. An ordinary sad or scary topic,
 * which is exactly what this app is for, must still queue normally.
 *
 * The real screener (supabase/functions/_shared/crisis.ts) is a model call
 * this harness cannot make, so the stub matches a fixed fixture phrase
 * instead (see e2e/fixtures/crisis.ts) — this spec exercises the plumbing
 * (client -> server -> UI), not the model's judgement. The judgement itself
 * is covered by supabase/functions/_shared/crisis-response.test.ts's
 * simulated-verdict tests, including a wider range of Korean and English
 * crisis and near-miss phrasing than a browser e2e test could practically
 * drive through the UI.
 *
 * Two independent describe blocks, each with its own user, rather than two
 * tests sharing one — the one-child-per-family trigger means a second
 * createChild() for the same user would fail, and these two cases have
 * nothing else worth sharing state over.
 */

const CHILD_NAME = 'Yuna';

test.describe('crisis-input screening — a crisis-shaped situation', () => {
  const user = newTestUser();

  test.afterAll(async () => {
    await deleteTestUser(user.email);
  });

  test('gets a warm bilingual care notice, not a chapter', async ({ page }) => {
    await openApp(page);
    await provisionUser(user);
    await signIn(page, user, () => confirmEmail(user.email));
    const db = await clientFor(user);

    await createChild(page, CHILD_NAME);
    const { data: child } = await db.from('children').select('id').single();
    const childId = child!.id as string;

    await installStubs({ page, db, childId: () => childId });

    await lockCharacterLook(page);
    await expect(page.getByText(/What should tomorrow be about\?/i))
      .toBeVisible({ timeout: 60_000 });

    await page.locator('[data-testid="situation"]').fill(CRISIS_FIXTURE_SITUATION);
    await page.locator('[data-testid="queue-auto"]').click();

    await expect(page.locator('[data-testid="crisis-notice"]'))
      .toBeVisible({ timeout: 15_000 });
    // Bilingual, per ADR-0001 §1 — both languages render regardless of lead.
    await expect(page.getByText(/Thank you for telling us\./)).toBeVisible();
    await expect(page.getByText('말씀해 주셔서 감사해요.')).toBeVisible();
    // A real, named resource — not a placeholder.
    await expect(page.getByText(/109/)).toBeVisible();
    await expect(page.getByText('자살예방상담전화')).toBeVisible();
    // Blocked, not queued: the picker itself is gone, and no job exists.
    await expect(page.getByText(/What should tomorrow be about\?/i)).not.toBeVisible();

    const { data: jobs } = await db.from('chapter_queue').select('id').eq('child_id', childId);
    expect(jobs, 'a crisis-screened request should not have queued a job').toHaveLength(0);
  });
});

test.describe('crisis-input screening — an ordinary sad or scary situation', () => {
  const user = newTestUser();

  test.afterAll(async () => {
    await deleteTestUser(user.email);
  });

  test('still queues a chapter — over-blocking would break the product', async ({ page }) => {
    await openApp(page);
    await provisionUser(user);
    await signIn(page, user, () => confirmEmail(user.email));
    const db = await clientFor(user);

    await createChild(page, CHILD_NAME);
    const { data: child } = await db.from('children').select('id').single();
    const childId = child!.id as string;

    await installStubs({ page, db, childId: () => childId });

    await lockCharacterLook(page);
    await expect(page.getByText(/What should tomorrow be about\?/i))
      .toBeVisible({ timeout: 60_000 });

    await page.locator('[data-testid="situation"]').fill(NEAR_MISS_FIXTURE_SITUATION);
    await page.locator('[data-testid="queue-auto"]').click();

    // Queued, not blocked: no crisis notice, and a job now exists.
    await expect(page.locator('[data-testid="crisis-notice"]')).not.toBeVisible();
    await expect(page.getByText(/Writing tomorrow's chapter/i))
      .toBeVisible({ timeout: 15_000 });

    const { data: jobs } = await db.from('chapter_queue').select('id').eq('child_id', childId);
    expect(jobs, 'an ordinary situation should still queue a chapter').toHaveLength(1);
  });
});
