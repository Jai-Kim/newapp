import type { SupabaseClient } from '@supabase/supabase-js';

import { expect, test } from '@playwright/test';

import { FIXTURE_LESSON } from './fixtures/chapter';
import { IS_LIVE, MODE } from './support/env';
import { createChild, lockCharacterLook, openApp, signIn } from './support/flow';
import { installStubs, runStubWorker } from './support/stubs';
import {
  clientFor,
  confirmEmail,
  deleteTestUser,
  newTestUser,
  provisionUser,
} from './support/test-user';

/**
 * Volumes / "our books" (issue #14, ADR-0003) — the library groups readable
 * chapters into ~10-chapter volumes and marks one complete at 10.
 *
 * Generating a chapter for real, choice-by-choice through the UI, is already
 * core-loop.spec.ts's job. Doing that nine more times here would just re-prove
 * the nightly loop instead of the thing this slice actually adds, so this spec
 * seeds chapters directly against the real database — the same tables, RLS and
 * `approve_chapter` / `mark_chapter_read` functions the app itself calls — and
 * spends its UI time on the library screen. Nothing here depends on a real
 * provider, so it only needs to run in stub mode.
 */

const CHILD_NAME = 'Sora';
const t = (id: string) => `[data-testid="${id}"]`;

test.describe(`volumes (${MODE})`, () => {
  test.skip(IS_LIVE, 'seeds chapters directly against the database; no provider behaviour to prove here');

  const user = newTestUser();
  let db: SupabaseClient;
  let childId: string;
  let anyFailed = false;

  test.afterEach(({}, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      anyFailed = true;
    }
  });

  test.afterAll(async () => {
    if (anyFailed && process.env.E2E_CLEANUP_ALWAYS !== '1') {
      console.warn(
        `\n[e2e] leaving ${user.email} in place for inspection.`
        + `\n[e2e] delete it with E2E_CLEANUP_ALWAYS=1, or from the dashboard.\n`,
      );
      return;
    }
    await deleteTestUser(user.email);
  });

  test('the library shows the current volume filling up and marks it complete at 10', async ({ page }) => {
    await test.step('sign up and set up the child', async () => {
      await openApp(page);
      await provisionUser(user);
      await signIn(page, user, () => confirmEmail(user.email));
      db = await clientFor(user);

      await createChild(page, CHILD_NAME);
      const { data } = await db.from('children').select('id').single();
      childId = data!.id as string;

      // Stubs need the child id before any generation call, same as core-loop.
      await installStubs({ page, db, childId: () => childId });
      await lockCharacterLook(page);
      await expect(page.getByText(/What should tomorrow be about\?/i))
        .toBeVisible({ timeout: 60_000 });
    });

    await test.step('nine chapters leave the volume short of complete', async () => {
      for (let i = 0; i < 9; i++) {
        await seedApprovedChapter(db, childId, { markRead: true });
      }

      // From the tonight screen, same as a parent tapping through — not a
      // fresh navigation, so this also proves the shelf updates once opened.
      await page.locator(t('go-library')).click();
      await expect(page.locator(t('volume-progress'))).toBeVisible();
      await expect(page.getByText('Volume 1')).toBeVisible();
      await expect(page.getByText('9 of 10 chapters')).toBeVisible();
      await expect(page.locator(t('volume-complete'))).toHaveCount(0);
    });

    await test.step('the tenth chapter completes the volume', async () => {
      // Left unread on purpose: completion is about what has passed the
      // parent gate, not what has been read yet.
      await seedApprovedChapter(db, childId, { markRead: false });

      await page.reload();
      await expect(page.locator(t('volume-complete'))).toBeVisible();
      await expect(page.getByText('Your book is ready!')).toBeVisible();
      await expect(page.getByText('10 of 10 chapters')).toBeVisible();
    });
  });
});

/**
 * Writes one chapter straight through to the child-readable state: queued,
 * "generated" by the stub worker, and approved — exactly what a real night
 * followed by a parent's "yes" produces, minus the wait.
 */
async function seedApprovedChapter(
  db: SupabaseClient,
  childId: string,
  { markRead }: { markRead: boolean },
): Promise<void> {
  const { error: queueError } = await db.from('chapter_queue').insert({
    child_id: childId,
    lesson: FIXTURE_LESSON,
    situation: null,
    auto_chosen: true,
  });
  if (queueError) {
    throw queueError;
  }

  const chapterId = await runStubWorker(db, childId);

  const { error: approveError } = await db.rpc('approve_chapter', {
    p_chapter_id: chapterId,
    p_approved: true,
  });
  if (approveError) {
    throw approveError;
  }

  if (markRead) {
    const { error: readError } = await db.rpc('mark_chapter_read', {
      p_chapter_id: chapterId,
    });
    if (readError) {
      throw readError;
    }
  }
}
