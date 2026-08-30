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
 * Two things matter for this slice specifically: onboarding cannot be
 * finished without an explicit, separate consent step (not a bundled ToS
 * checkbox), and the full notice is reachable and genuinely bilingual, not
 * just a settings row that goes nowhere.
 */

const t = (id: string) => `[data-testid="${id}"]`;

test.describe('privacy disclosure + consent', () => {
  const user = newTestUser();

  test.afterAll(async () => {
    await deleteTestUser(user.email);
  });

  test('onboarding cannot be completed without checking privacy consent, and consent is recorded once it is', async ({ page }) => {
    await openApp(page);
    await provisionUser(user);
    await signIn(page, user, () => confirmEmail(user.email));
    const db = await clientFor(user);

    // Fill in everything except consent, and confirm the app refuses to move
    // on -- a half-asleep parent tapping through fields should not be able to
    // skip this the way a bundled ToS checkbox could be skipped.
    await page.locator(t('child-name')).fill('Mia');
    await page.locator(t('age-5-6')).click();
    await page.locator(t('lang-en')).click();
    await page.locator(t('interest-drawing')).click();
    // react-native-web renders the button as a plain `<div>` with no ARIA
    // role, so Playwright's toBeDisabled()/toBeEnabled() (which only honour
    // aria-disabled on role-bearing elements) can't see it — assert the
    // rendered attribute directly instead.
    await expect(page.locator(t('create-child'))).toHaveAttribute('aria-disabled', 'true');

    await page.locator(t('privacy-consent')).click();
    // react-native-web omits the attribute entirely when enabled rather than
    // emitting aria-disabled="false", so assert its absence instead.
    await expect(page.locator(t('create-child'))).not.toHaveAttribute('aria-disabled', 'true');
    await page.locator(t('create-child')).click();

    // Onboarding hands over to the look picker, same as every other flow.
    await expect(page.locator(t('draw-sheet'))).toBeVisible({ timeout: 60_000 });

    // Proof of consent lives on the family row, not just in the UI having
    // been satisfied for one session.
    const { data: family, error } = await db
      .from('families')
      .select('privacy_consent_version,privacy_consented_at')
      .single();
    if (error) {
      throw error;
    }
    expect(family!.privacy_consent_version).toBeTruthy();
    expect(family!.privacy_consented_at).toBeTruthy();
  });
});

test.describe('privacy notice screen', () => {
  const user = newTestUser();

  test.afterAll(async () => {
    await deleteTestUser(user.email);
  });

  test('the full privacy notice is reachable and names both AI providers bilingually', async ({ page }) => {
    // Stands up its own account and child rather than relying on a sibling
    // test's side effect -- a failure earlier in the file (or a future
    // `--grep`/sharded run that skips it) must not turn into a second,
    // unrelated-looking failure here.
    await openApp(page);
    await provisionUser(user);
    await signIn(page, user, () => confirmEmail(user.email));
    await createChild(page, 'Rina');

    await page.goto('/privacy');

    // Scope every text assertion to the screen's own container -- the title
    // renders once in the stack header and once as the in-screen heading, so
    // an unscoped getByText() hits a strict-mode violation on duplicate text.
    const screen = page.locator(t('privacy-screen'));
    await expect(screen).toBeVisible({ timeout: 30_000 });
    await expect(screen.getByText('Privacy & data')).toBeVisible();
    await expect(screen.getByText('개인정보 및 데이터')).toBeVisible();

    // Named directly, not "our partners".
    await expect(screen.getByText(/Anthropic \(Claude models\) writes the text/)).toBeVisible();
    await expect(screen.getByText(/Google \(Gemini models\) generates the illustrations/)).toBeVisible();

    // The cross-border transfer is its own section, per PIPA.
    await expect(screen.getByText('Cross-border transfer (Korea PIPA)')).toBeVisible();
    await expect(screen.getByText('국외 이전 (개인정보보호법)')).toBeVisible();
  });
});

test.describe('privacy — AI-content label in the reader', () => {
  const user = newTestUser();

  test.afterAll(async () => {
    await deleteTestUser(user.email);
  });

  test('a made-with-ai notice appears on an approved chapter a parent reads', async ({ page }) => {
    await openApp(page);
    await provisionUser(user);
    await signIn(page, user, () => confirmEmail(user.email));
    const db = await clientFor(user);

    await createChild(page, 'Yuna');
    const { data: child } = await db.from('children').select('id').single();

    const { data: chapterRow, error: insertError } = await db
      .from('chapters')
      .insert({
        child_id: child!.id,
        number: 1,
        title_en: 'Chapter 1',
        title_ko: '1장',
        pages: [{
          page: 1,
          en: 'Once upon a time.',
          ko: '옛날 옛적에.',
          scene: 'a child at bedtime',
          wardrobe: 'pyjamas',
        }],
        summary: 'Seeded chapter for the AI-label e2e (issue #12).',
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
    if (insertError) {
      throw insertError;
    }

    const { error: approveError } = await db.rpc('approve_chapter', {
      p_chapter_id: chapterRow!.id as string,
      p_approved: true,
    });
    if (approveError) {
      throw approveError;
    }

    await page.goto(`/read/${chapterRow!.id}`);
    await expect(page.locator(t('ai-generated-notice'))).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Made with AI — text and pictures generated by AI, reviewed by a parent\./)).toBeVisible();
  });
});
