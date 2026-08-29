import type { SupabaseClient } from '@supabase/supabase-js';

import { expect, test } from '@playwright/test';

import {
  createChild,
  lockCharacterLook,
  openApp,
  signIn,
} from './support/flow';
import {
  clientFor,
  confirmEmail,
  deleteTestUser,
  newTestUser,
  provisionUser,
} from './support/test-user';

/**
 * Privacy disclosure + Korea PIPA + AI-content labeling (issue #12).
 *
 * Three things this proves against a real signed-in session and real RLS,
 * not mocks:
 *   - explicit parental consent is recorded (version + timestamp) when a
 *     child's profile is created, not implied by agreeing to Terms;
 *   - the privacy notice is reachable both directly and from Settings, and
 *     renders bilingually;
 *   - the "made with AI" label appears both where a parent decides (the
 *     review screen) and where a child reads (the reader), before and after
 *     approval.
 */

const CHILD_NAME = 'Yuna';

async function seedChapter(
  db: SupabaseClient,
  childId: string,
  number: number,
  { approve }: { approve: boolean },
): Promise<string> {
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
      summary: `Seeded chapter ${number} for the privacy/AI-labeling e2e (issue #12).`,
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

  if (approve) {
    const { error: approveError } = await db.rpc('approve_chapter', {
      p_chapter_id: chapterId,
      p_approved: true,
    });
    if (approveError) {
      throw approveError;
    }
  }

  return chapterId;
}

test.describe('privacy disclosure, consent & AI-content labeling', () => {
  const user = newTestUser();

  test.afterAll(async () => {
    await deleteTestUser(user.email);
  });

  test('records consent, shows the notice bilingually, and labels AI content', async ({ page }) => {
    await openApp(page);
    await provisionUser(user);
    await signIn(page, user, () => confirmEmail(user.email));
    const db = await clientFor(user);

    await createChild(page, CHILD_NAME);

    // Explicit consent (issue #12) was recorded, not implied — with a version
    // and a timestamp, not just a boolean.
    const { data: child } = await db
      .from('children')
      .select('id, privacy_consent_version, privacy_consented_at')
      .single();
    const childId = child!.id as string;
    expect(child!.privacy_consent_version).toBeTruthy();
    expect(child!.privacy_consented_at).toBeTruthy();

    // Reachable directly, and bilingual — both languages on screen together,
    // per the app's convention (ADR-0001 §1), regardless of which leads.
    await page.goto('/privacy');
    await expect(page.getByText('Privacy & AI use')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('개인정보 및 AI 이용 안내')).toBeVisible();
    await expect(page.getByText(/Anthropic \(Claude\)/)).toBeVisible();
    await expect(page.getByText(/Google \(Gemini\)/)).toBeVisible();

    // Also reachable from Settings, not just by direct link.
    await lockCharacterLook(page);
    await page.locator('[data-testid="settings-tab"]').click();
    await page.locator('[data-testid="settings-privacy"]').click();
    await expect(page.locator('[data-testid="privacy-screen"]')).toBeVisible({ timeout: 30_000 });

    // The parent-preview gate: AI-generated-content label shows before a
    // parent has decided anything.
    const pendingChapterId = await seedChapter(db, childId, 1, { approve: false });
    await page.goto(`/review/${pendingChapterId}`);
    await expect(page.locator('[data-testid="ai-generated-badge"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Made with AI, reviewed by a parent')).toBeVisible();
    await expect(page.getByText('AI로 제작 · 부모님이 검토했어요')).toBeVisible();

    // And in the reader itself, once approved and child-readable.
    const approvedChapterId = await seedChapter(db, childId, 2, { approve: true });
    await page.goto(`/read/${approvedChapterId}`);
    await expect(page.locator('[data-testid="ai-generated-badge"]')).toBeVisible({ timeout: 30_000 });
  });
});
