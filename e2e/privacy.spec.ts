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
 * Privacy disclosure + Korea PIPA consent + AI-content labeling (issue #12).
 *
 * `createChild` (support/flow.ts) already checks the new consent checkbox as
 * part of the normal onboarding flow, so the first assertion here is just
 * that doing so actually wrote a real, RLS-scoped row — not a mock. The
 * chapter used for the AI-label assertion is seeded directly against the
 * database, same as `volumes.spec.ts`: nothing about a label on an already-
 * approved chapter depends on generation.
 */

const CHILD_NAME = 'Mia';
const POLICY_VERSION = 'v1';

async function seedApprovedChapter(
  db: SupabaseClient,
  childId: string,
  number: number,
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
      summary: `Seeded chapter ${number} for the privacy e2e (issue #12).`,
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
  return data!.id as string;
}

test.describe('privacy disclosure + AI-content labeling (issue #12)', () => {
  const user = newTestUser();

  test.afterAll(async () => {
    await deleteTestUser(user.email);
  });

  test('records consent, exposes the full bilingual notice, and labels an AI-generated chapter', async ({ page }) => {
    await openApp(page);
    await provisionUser(user);
    await signIn(page, user, () => confirmEmail(user.email));
    const db = await clientFor(user);

    await createChild(page, CHILD_NAME);

    const { data: family } = await db.from('families').select('id').single();
    const { data: consents } = await db
      .from('privacy_consents')
      .select('policy_version')
      .eq('family_id', family!.id as string);
    expect(consents).toHaveLength(1);
    expect(consents![0].policy_version).toBe(POLICY_VERSION);

    // The full notice is reachable directly, and both languages render.
    await page.goto('/privacy');
    await expect(page.getByText('Privacy & how AI is used')).toBeVisible();
    await expect(page.getByText('개인정보 처리방침 및 AI 이용 안내')).toBeVisible();
    // Named in both the English and Korean body text of the same section,
    // so more than one match is expected — .first() avoids a strict-mode
    // violation rather than asserting there is exactly one.
    await expect(page.getByText(/Anthropic/).first()).toBeVisible();
    await expect(page.getByText(/Google/).first()).toBeVisible();

    // An already-approved chapter carries the AI-generated label in the reader.
    const { data: child } = await db.from('children').select('id').single();
    const chapterId = await seedApprovedChapter(db, child!.id as string, 1);

    await page.goto(`/read/${chapterId}`);
    await expect(page.locator('[data-testid="ai-generated-badge"]'))
      .toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Made with AI, reviewed by a parent')).toBeVisible();
    await expect(page.getByText('AI로 제작되었고, 보호자가 검토했어요')).toBeVisible();
  });
});
