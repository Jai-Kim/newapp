import type { SupabaseClient } from '@supabase/supabase-js';

import { expect, test } from '@playwright/test';

import { FIXTURE_LESSON, FIXTURE_PAGES } from './fixtures/chapter';
import { jobAttempts, jobStatus, strandJob } from './support/db-jobs';
import { IS_LIVE, MODE, SUPABASE_ANON_KEY, SUPABASE_URL } from './support/env';
import {
  approveLatestChapter,
  chooseTomorrow,
  createChild,
  doubleEnqueue,
  liveJobCount,
  lockCharacterLook,
  openApp,
  readToTheEnd,
  signIn,
  signInExisting,
  waitForJob,
} from './support/flow';
import { installStubs, runStubWorker } from './support/stubs';
import {
  clientFor,
  confirmEmail,
  deleteTestUser,
  newTestUser,
  provisionUser,
} from './support/test-user';

/**
 * The core loop, end to end: sign up -> onboarding -> look picker -> first
 * chapter -> read it -> choose tomorrow.
 *
 * One spec, two modes (E2E_MODE). See playwright.config.ts for what each
 * covers; the short version is that stub mode proves the app and the database,
 * and live mode proves the Edge Functions, the providers and the background
 * worker. Neither is sufficient on its own.
 */

const CHILD_NAME = 'Yuna';
const TOMORROW_LESSON = 'being brave about something new';

type Persisted = { id: string; first_name: string; primary_language: string };

/**
 * "The child persists" means a row in Postgres owned by this user and visible
 * under RLS to a client that shares nothing with the app but the account — not
 * a value still sitting in a React state hook.
 */
async function assertChildPersisted(db: SupabaseClient, name: string): Promise<string> {
  const { data } = await db
    .from('children')
    .select('id,first_name,age_band,primary_language,interests')
    .maybeSingle();

  expect(data, 'the child was not written to the database').toBeTruthy();
  const child = data as unknown as Persisted & { interests: string[] };
  expect(child.first_name).toBe(name);
  expect(child.primary_language).toBe('ko');
  expect(child.interests).toEqual(expect.arrayContaining(['the sea', 'rain']));
  return child.id;
}

/** Bilingual and page-aligned on every page (ADR-0001 §1), and illustrated. */
function assertChapterIsBilingualWithArt(
  pages: { en: string; ko: string; image_path?: string }[],
): void {
  expect(pages.length, 'the chapter has no pages').toBeGreaterThan(0);

  for (const p of pages) {
    expect(p.en?.trim().length, `page ${p.en ? '' : '?'} has no English`)
      .toBeGreaterThan(0);
    expect(p.ko?.trim().length, 'a page has no Korean').toBeGreaterThan(0);
    // Checking the script, not just non-emptiness: a page whose "Korean" was
    // ASCII would pass a length check while hiding a translation or encoding
    // failure, which is the bug that actually matters here.
    expect(p.ko, 'the Korean side is not written in Korean')
      .toMatch(/[\uAC00-\uD7AF]/);
  }

  expect(
    pages.filter(p => p.image_path).length,
    'the chapter has no illustrations',
  ).toBeGreaterThan(0);
}

test.describe(`core loop (${MODE})`, () => {
  const user = newTestUser();
  let db: SupabaseClient;
  let childId: string;
  let accessToken: string;

  test.afterAll(async () => {
    // One delete: families.auth_user_id cascades from auth.users, and every
    // Story Bible table cascades from families.
    await deleteTestUser(user.email);
  });

  test('a parent can set up and read tonight, and tomorrow is queued', async ({ page }) => {
    await test.step('sign up, confirm, sign in', async () => {
      await openApp(page);
      await provisionUser(user);
      await signIn(page, user, () => confirmEmail(user.email));
      db = await clientFor(user);
      accessToken = (await db.auth.getSession()).data.session!.access_token;
    });

    await test.step('onboarding creates the child', async () => {
      await createChild(page, CHILD_NAME);
      childId = await assertChildPersisted(db, CHILD_NAME);

      // Stubs need the child id, so they go on now — before the first call
      // that would otherwise reach a provider.
      if (!IS_LIVE) {
        await installStubs({ page, db, childId: () => childId });
      }
    });

    await test.step('the look picker locks a character sheet', async () => {
      await lockCharacterLook(page);
      const { data } = await db
        .from('children')
        .select('character_ref')
        .eq('id', childId)
        .single();
      const ref = data!.character_ref as { identity?: { image_path?: string } };
      expect(ref?.identity?.image_path, 'no character sheet was locked').toBeTruthy();
    });

    const firstJobId = await test.step('chapter one is generated', async () => {
      await expect(page.getByText(/What should tomorrow be about\?/i))
        .toBeVisible({ timeout: 60_000 });
      await chooseTomorrow(page, FIXTURE_LESSON);
      await expect(page.getByText(/Writing tomorrow's chapter/i)).toBeVisible();
      expect(await liveJobCount(db, childId)).toBe(1);

      const jobId = await currentJobId(db, childId);
      if (IS_LIVE) {
        // The real proof of issue #9: enqueue-chapter returned long ago and
        // the work continued in a background task nobody held a socket for.
        const outcome = await waitForJob(db, jobId, 10 * 60_000);
        expect(outcome.status, `background worker did not finish: ${outcome.error}`)
          .toBe('done');
      }
      else {
        await runStubWorker(db, childId);
      }
      return jobId;
    });
    expect(firstJobId).toBeTruthy();

    const pages = await test.step('the parent gate, then the chapter', async () => {
      await page.reload();
      await expect(page.locator('[data-testid="go-review"]'))
        .toBeVisible({ timeout: 60_000 });
      await approveLatestChapter(page);

      const { data } = await db
        .from('chapters')
        .select('*')
        .eq('child_id', childId)
        .eq('number', 1)
        .single();
      const chapterPages = data!.pages as { en: string; ko: string; image_path?: string }[];
      assertChapterIsBilingualWithArt(chapterPages);
      return chapterPages;
    });

    await test.step('reading it shows both languages and art', async () => {
      await expect(page.locator('[data-testid="read-tonight"]'))
        .toBeVisible({ timeout: 60_000 });
      await page.locator('[data-testid="read-tonight"]').click();

      const read = await readToTheEnd(page, pages.length);
      expect(read.koreanSeen[0], 'no Korean rendered on page 1')
        .toMatch(/[\uAC00-\uD7AF]/);
      expect(read.englishSeen[0]!.length, 'no English rendered on page 1')
        .toBeGreaterThan(10);
      expect(read.pagesWithArt, 'no page rendered an illustration').toBeGreaterThan(0);
    });

    await test.step('choosing tomorrow queues exactly one job', async () => {
      await chooseTomorrow(page, TOMORROW_LESSON);
      await expect(page.getByText(/Writing tomorrow's chapter/i))
        .toBeVisible({ timeout: 60_000 });
      expect(
        await liveJobCount(db, childId),
        'choosing tomorrow did not queue exactly one job',
      ).toBe(1);

      // Two requests in flight at once, as a retry or a second device sends.
      const doubled = await doubleEnqueue(page, {
        supabaseUrl: SUPABASE_URL,
        anonKey: SUPABASE_ANON_KEY,
        accessToken,
        childId,
        lesson: TOMORROW_LESSON,
      });

      expect(
        await liveJobCount(db, childId),
        'a concurrent double-submit bought a second chapter',
      ).toBe(1);
      expect(
        doubled.bodies.filter(b => (b as { already_queued?: boolean })?.already_queued),
        'the second request should be told the work is already happening',
      ).not.toHaveLength(0);
    });

    if (!IS_LIVE) {
      expect(pages.length).toBe(FIXTURE_PAGES.length);
    }
  });

  // The sweep only means something against a worker that can really die.
  test('a stranded job is revived by the sweep', async ({ page }) => {
    test.skip(!IS_LIVE, 'the sweep rescues a real worker; stub mode has none');

    const jobId = await currentJobId(db, childId);

    // The job the last test queued is still being written by a live worker.
    // Stranding THAT one proves nothing: its own worker finishes a minute
    // later and closes the job out, and the sweep takes the credit for work
    // it never did. It would also collide with the one-live-job unique index,
    // which forbids a second 'running' row for this child. So wait for it to
    // settle first — what gets stranded must have nothing running behind it.
    const settled = await waitForJob(db, jobId, 10 * 60_000);
    expect(settled.status, `the queued job never settled: ${settled.error}`)
      .toBe('done');
    const attemptsBefore = jobAttempts(jobId);

    // Now force the state a killed isolate leaves behind: still 'running',
    // started long enough ago that no generation could still be in flight.
    // Without the sweep this holds the one-live-job lock forever and the
    // family simply never gets another chapter.
    strandJob(jobId, 30);
    expect(jobStatus(jobId)).toBe('running');

    // Each test gets its own browser context, so this one starts signed out —
    // `goto('/')` alone would sit on the welcome screen and the app would
    // never sweep, which is a harness failure dressed up as a product one.
    // Signing in IS opening the app, and the app sweeps on open.
    await signInExisting(page, user);

    await expect(
      page.getByText(/Writing tomorrow's chapter|Tonight's chapter is ready|Waiting for you/i),
    ).toBeVisible({ timeout: 120_000 });

    const outcome = await waitForJob(db, jobId, 10 * 60_000);
    expect(
      outcome.status,
      `the sweep did not rescue the stranded job: ${outcome.error}`,
    ).toBe('done');

    // Re-run, not merely re-labelled: `runJob` increments attempts, so a job
    // that came back with the same count was closed by something other than
    // the sweep — the exact false pass this test used to be capable of.
    expect(
      jobAttempts(jobId),
      'the job ended up done without the sweep ever re-running it',
    ).toBeGreaterThan(attemptsBefore);
    expect(outcome.chapter_id, 'the revived job produced no chapter').toBeTruthy();
  });
});

async function currentJobId(db: SupabaseClient, childId: string): Promise<string> {
  const { data } = await db
    .from('chapter_queue')
    .select('id')
    .eq('child_id', childId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  return data!.id as string;
}
