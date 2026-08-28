import type { SupabaseClient } from '@supabase/supabase-js';

import { expect, test } from '@playwright/test';

import { createChild, openApp, signIn } from './support/flow';
import {
  clientFor,
  confirmEmail,
  deleteTestUser,
  newTestUser,
  provisionUser,
} from './support/test-user';

/**
 * Volumes / "our books" (issue #22, ADR-0003): the library shows the current
 * Volume filling up and marks it complete at ten chapters.
 *
 * Nothing here depends on generation — a Volume is derived purely from what
 * is in `child_readable_chapters` — so chapters are seeded directly against
 * the database (the same table, RLS, and `approve_chapter` RPC the app
 * itself uses) rather than driving nine more rounds of the full write ->
 * review -> approve cycle through the UI. Real signup and a real child row
 * still go through the app, so this proves the library reads real RLS-scoped
 * rows, not a mock.
 */

const CHILD_NAME = 'Yuna';

async function seedApprovedChapter(
  db: SupabaseClient,
  childId: string,
  number: number,
): Promise<void> {
  const { data, error } = await db
    .from('chapters')
    .insert({
      child_id: childId,
      number,
      title_en: `Chapter ${number}`,
      title_ko: `${number}장`,
      pages: [{
        page: 1,
        en: 'Once upon a time, on a quiet night.',
        ko: '어느 조용한 밤, 옛날 옛적에.',
        scene: 'a child by a window at night',
        wardrobe: 'soft pyjamas',
      }],
      summary: `Seeded chapter ${number} for the Volumes e2e (issue #22).`,
      safety: {
        verdict: 'safe',
        concerns: [],
        checked_languages: ['en', 'ko'],
        model: 'e2e-seed',
        latency_ms: 0,
      },
    })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  const { error: approveError } = await db.rpc('approve_chapter', {
    p_chapter_id: data!.id as string,
    p_approved: true,
  });
  if (approveError) {
    throw approveError;
  }
}

test.describe('volumes / "our books"', () => {
  const user = newTestUser();

  test.afterAll(async () => {
    await deleteTestUser(user.email);
  });

  test('the library shows the current Volume filling up and marks it complete at ten', async ({ page }) => {
    await openApp(page);
    await provisionUser(user);
    await signIn(page, user, () => confirmEmail(user.email));
    const db = await clientFor(user);

    await createChild(page, CHILD_NAME);
    const { data: child } = await db.from('children').select('id').single();
    const childId = child!.id as string;

    // Sequential, not Promise.all: chapter numbers must land in order for
    // volume grouping to mean anything.
    for (let number = 1; number <= 9; number += 1) {
      await seedApprovedChapter(db, childId, number);
    }

    await page.goto('/library');
    await expect(page.locator('[data-testid="volume-progress"]'))
      .toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Volume 1')).toBeVisible();
    await expect(page.getByText('9 of 10 chapters')).toBeVisible();
    await expect(page.locator('[data-testid="volume-complete"]')).toHaveCount(0);

    await seedApprovedChapter(db, childId, 10);
    await page.reload();

    await expect(page.getByText('10 of 10 chapters')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-testid="volume-complete"]')).toBeVisible();
    // Bilingual, per ADR-0001 §1 — both languages render regardless of lead.
    await expect(page.getByText('Your book is ready!')).toBeVisible();
    await expect(page.getByText('책이 완성되었어요!')).toBeVisible();

    // An eleventh chapter starts volume two rather than growing volume one
    // past its ten-chapter shape.
    await seedApprovedChapter(db, childId, 11);
    await page.reload();

    await expect(page.getByText('Volume 2')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('1 of 10 chapters')).toBeVisible();
    await expect(page.locator('[data-testid="volume-complete"]')).toHaveCount(0);
  });
});
