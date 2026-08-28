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
 * Paywall / allowance (issue #22, ADR-0003): the allowance blocks gracefully
 * with a warm message once a family has this month's book, and the
 * membership screen states the $1.99/3mo -> $1.99/mo pricing.
 *
 * Chapters are seeded directly against the database, same as the Volumes
 * e2e (issue #22, PR #27) — the allowance is derived purely from
 * `child_readable_chapters`, so nothing here needs a real chapter
 * generation. `mark_chapter_read` is called on each one too: the allowance
 * notice only replaces the "what's tomorrow about" prompt once tonight's
 * screen has nothing left to read, same as a family would actually reach it
 * a chapter at a time.
 */

const CHILD_NAME = 'Yuna';
const ALLOWANCE_SIZE = 10;

async function seedReadChapter(
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
      summary: `Seeded chapter ${number} for the paywall e2e (issue #22).`,
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

  const chapterId = data!.id as string;
  const { error: approveError } = await db.rpc('approve_chapter', {
    p_chapter_id: chapterId,
    p_approved: true,
  });
  if (approveError) {
    throw approveError;
  }

  const { error: readError } = await db.rpc('mark_chapter_read', {
    p_chapter_id: chapterId,
  });
  if (readError) {
    throw readError;
  }
}

test.describe('paywall / allowance', () => {
  const user = newTestUser();

  test.afterAll(async () => {
    await deleteTestUser(user.email);
  });

  test('blocks gracefully once this month\'s book is done, and links to the membership screen', async ({ page }) => {
    await openApp(page);
    await provisionUser(user);
    await signIn(page, user, () => confirmEmail(user.email));
    const db = await clientFor(user);

    await createChild(page, CHILD_NAME);
    const { data: child } = await db.from('children').select('id').single();
    const childId = child!.id as string;

    for (let number = 1; number <= ALLOWANCE_SIZE; number += 1) {
      await seedReadChapter(db, childId, number);
    }

    await page.goto('/');
    await expect(page.locator('[data-testid="allowance-blocked"]'))
      .toBeVisible({ timeout: 30_000 });
    // Bilingual, per ADR-0001 §1 — both languages render regardless of lead.
    await expect(page.getByText('이번 달 책이 완성됐어요!')).toBeVisible();
    await expect(page.getByText('This month’s book is finished!')).toBeVisible();
    await expect(page.getByText(/What should tomorrow be about\?/i)).toHaveCount(0);

    await page.locator('[data-testid="open-paywall-from-allowance"]').click();
    await expect(page.locator('[data-testid="paywall-pricing"]')).toBeVisible();
    await expect(page.getByText('$1.99 for your first 3 months, then $1.99/month')).toBeVisible();
    await expect(page.getByText('첫 3개월은 $1.99, 이후 매달 $1.99')).toBeVisible();
  });
});
