import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';

import { expect } from '@playwright/test';

import { AUTH_STRATEGY, IS_LIVE } from './env';

/**
 * The core loop, as a parent walks it.
 *
 * Shared by both modes so that live mode is genuinely "the same flow against
 * real providers" rather than a second, subtly different script.
 */

const t = (id: string) => `[data-testid="${id}"]`;

/** Expo's dev bundle is slow to come up cold; the first screen needs room. */
export async function openApp(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Let\'s Get Started')).toBeVisible({ timeout: 120_000 });
  await page.getByText('Let\'s Get Started').click();
  await expect(page.locator(t('form-title'))).toBeVisible();
}

async function fillCredentials(page: Page, email: string, password: string) {
  await page.locator(t('name')).fill('E2E Parent');
  await page.locator(t('email-input')).fill(email);
  await page.locator(t('password-input')).fill(password);
  await page.locator(t('login-button')).click();
}

/**
 * Gets the parent signed in, by whichever route the target supports.
 *
 * `admin` skips the sign-up screen because the account already exists — a
 * deliberate trade: it is the only strategy that can run on every commit
 * against a project with email confirmation on, and the cost is that the
 * sign-up screen itself is covered by the other two strategies instead.
 */
export async function signIn(
  page: Page,
  credentials: { email: string; password: string },
  confirm: () => void,
): Promise<void> {
  const { email, password } = credentials;

  if (AUTH_STRATEGY !== 'admin') {
    await page.locator(t('toggle-account-mode')).click();
    await fillCredentials(page, email, password);

    if (AUTH_STRATEGY === 'autoconfirm') {
      // No confirmation step: sign-up lands the parent straight in the app.
      await expect(page.locator(t('child-name'))).toBeVisible({ timeout: 60_000 });
      return;
    }

    // The app telling the parent to go and confirm is the signal that sign-up
    // actually reached Supabase.
    await expect(page.locator(t('auth-error'))).toContainText(/confirm the account/i);
    confirm();
    await page.locator(t('toggle-account-mode')).click();
  }

  await fillCredentials(page, email, password);
  await expect(page.locator(t('child-name'))).toBeVisible({ timeout: 60_000 });
}

/**
 * Signs in a parent whose child is already set up.
 *
 * `signIn` above ends by waiting for the child-setup screen, which is right
 * for the account it just created and wrong for every later visit: a parent
 * who already has a child goes straight into the app. A test needs this
 * because Playwright gives each test its own browser context — a second test
 * starts with no session at all, and `goto('/')` lands on the welcome screen
 * rather than the app, however signed-in the previous test was.
 */
export async function signInExisting(
  page: Page,
  credentials: { email: string; password: string },
): Promise<void> {
  await openApp(page);
  await fillCredentials(page, credentials.email, credentials.password);

  // Whatever tonight holds, it is one of these — and any of them means the
  // app is open, which is what makes the sweep run.
  await expect(
    page.getByText(
      /What should tomorrow be about\?|Tonight's chapter is ready|Waiting for you|Writing tomorrow's chapter/i,
    ),
  ).toBeVisible({ timeout: 120_000 });
}

/** Onboarding: who the story is about. */
export async function createChild(page: Page, name: string): Promise<void> {
  await page.locator(t('child-name')).fill(name);
  await page.locator(t('age-5-6')).click();
  await page.locator(t('lang-ko')).click();
  await page.locator(t('interest-the sea')).click();
  await page.locator(t('interest-rain')).click();
  await page.locator(t('create-child')).click();

  // Onboarding hands straight over to the look picker.
  await expect(page.locator(t('draw-sheet'))).toBeVisible({ timeout: 60_000 });
}

/** Provider weather rather than a broken product — worth one more go. */
function isTransient(message: string): boolean {
  return /\b(429|500|502|503|504)\b|high demand|UNAVAILABLE|overloaded|rate limit|timeout/i
    .test(message);
}

/**
 * The guided look picker. Every field must be answered before it will draw.
 *
 * In live mode the draw is retried on a transient provider error. Gemini
 * returns 503 "high demand" often enough that a smoke test which fails on it
 * is a test that gets ignored within a fortnight — and the thing under test is
 * whether the loop works, not whether Google had a good afternoon.
 *
 * The important part is that it races the success control against the error
 * banner. Waiting only for success turns a provider outage into a three-minute
 * timeout reported as "element not found", which is how the first live run
 * spent 180 seconds telling us nothing.
 */
export async function lockCharacterLook(page: Page): Promise<void> {
  for (const chip of [
    'presentation-girl',
    'skin_tone-light-golden',
    'hair_color-black',
    'hair_texture-straight',
    'hair_style-two-pigtails',
    'fringe-blunt',
    'eye_shape-monolid',
    'eye_color-dark-brown',
    'glasses-none',
    'detail-mole-left',
    'signature_color-terracotta',
    'companion-magpie',
  ]) {
    await page.locator(t(chip)).click();
  }

  const attempts = IS_LIVE ? 3 : 1;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await expect(page.locator(t('draw-sheet'))).toBeEnabled();
    await page.locator(t('draw-sheet')).click();

    const done = page.locator(t('finish-character'));
    const failed = page.locator(t('picker-error'));

    await expect(done.or(failed)).toBeVisible({
      timeout: IS_LIVE ? 180_000 : 30_000,
    });

    if (await done.isVisible()) {
      await done.click();
      return;
    }

    const message = (await failed.innerText()).trim();
    if (attempt === attempts || !isTransient(message)) {
      throw new Error(`the look picker could not draw a sheet: ${message}`);
    }

    console.warn(`sheet attempt ${attempt} hit provider weather, retrying: ${message}`);
    await page.waitForTimeout(15_000);
  }
}

/** Choose what tomorrow is about, from wherever the picker is showing. */
export async function chooseTomorrow(page: Page, lesson: string): Promise<void> {
  await expect(page.getByText(/What should tomorrow be about\?/i)).toBeVisible();
  await page.locator(t(`lesson-${lesson.slice(0, 12)}`)).click();
  await page.locator(t('queue-tomorrow')).click();
}

/** The parent gate. Nothing is readable until this happens. */
export async function approveLatestChapter(page: Page): Promise<void> {
  await page.locator(t('go-review')).click();
  await expect(page.locator(t('approve'))).toBeVisible({ timeout: 60_000 });
  await page.locator(t('approve')).click();
}

export type ReadResult = {
  englishSeen: string[];
  koreanSeen: string[];
  pagesWithArt: number;
};

/**
 * Reads a chapter to the end, recording what was actually on screen.
 *
 * Returns observations rather than asserting inline so the spec can state the
 * expectations in one place — and so a failure says which page was wrong.
 */
export async function readToTheEnd(page: Page, pageCount: number): Promise<ReadResult> {
  const result: ReadResult = { englishSeen: [], koreanSeen: [], pagesWithArt: 0 };

  for (let i = 0; i < pageCount; i++) {
    // Sample only once the page is actually on screen. The reader shows a
    // spinner while it fetches the chapter, and reading innerText straight
    // after the tap captured that spinner as "page 1" — the assertion then
    // failed on an empty string rather than on anything the parent would see.
    await expect(page.locator(t(`page-${i + 1}`))).toBeVisible({ timeout: 30_000 });

    const body = await page.locator('body').innerText();

    // Hangul syllables. Checking the script rather than a specific string is
    // what catches an encoding or fallback bug, which is the failure that
    // would otherwise slip through a "not empty" assertion.
    const korean = body.match(/[\uAC00-\uD7AF]+/g) ?? [];
    const english = body.match(/[a-z]{4}[^\n]*/gi) ?? [];
    result.koreanSeen.push(korean.join(' '));
    result.englishSeen.push(english.join(' '));

    if (await page.locator('img').count() > 0) {
      result.pagesWithArt += 1;
    }

    await page.locator(t('next-page')).click();
  }

  await expect(page.getByText(/What should tomorrow be about\?/i))
    .toBeVisible({ timeout: 30_000 });
  return result;
}

/** Live jobs for this child — the thing the one-per-child index protects. */
export async function liveJobCount(db: SupabaseClient, childId: string): Promise<number> {
  const { data, error } = await db
    .from('chapter_queue')
    .select('id')
    .eq('child_id', childId)
    .in('status', ['queued', 'running']);

  if (error) {
    throw error;
  }
  return (data ?? []).length;
}

/**
 * Two enqueue requests at once, from inside the page so they take exactly the
 * path the app takes — intercepted in stub mode, the deployed function in live
 * mode. This is the real shape of the double-submit risk: not a literal double
 * tap, which the button's disabled state already blocks, but two requests in
 * flight together from a retry or a second device.
 *
 * The access token is passed in from Node rather than dug out of the page,
 * because the app keeps its session in MMKV — a lookup that quietly missed
 * would send the anon key, get a 401 from both calls, and "pass" for entirely
 * the wrong reason.
 */
export async function doubleEnqueue(
  page: Page,
  args: {
    supabaseUrl: string;
    anonKey: string;
    accessToken: string;
    childId: string;
    lesson: string;
  },
): Promise<{ statuses: number[]; bodies: unknown[] }> {
  return page.evaluate(
    async ({ supabaseUrl, anonKey, accessToken, childId, lesson }) => {
      const call = async () => {
        const response = await fetch(`${supabaseUrl}/functions/v1/enqueue-chapter`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'apikey': anonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'enqueue', child_id: childId, lesson }),
        });
        return { status: response.status, body: await response.json().catch(() => null) };
      };

      const results = await Promise.all([call(), call()]);
      return {
        statuses: results.map(r => r.status),
        bodies: results.map(r => r.body),
      };
    },
    args,
  );
}

/** Polls until the background worker closes the job out, or gives up. */
export type JobSnapshot = {
  status: string;
  error: string | null;
  chapter_id: string | null;
  attempts: number | null;
  started_at: string | null;
};

/**
 * Polls until the background worker closes the job out, or gives up.
 *
 * Returns `attempts` and `started_at` as well as the status, because when this
 * times out on a stranded job those two fields are the only things that
 * distinguish the two very different explanations:
 *
 *   started_at still old   the sweep never picked it up
 *   started_at moved up    the sweep re-claimed it and that worker died too
 *
 * A live run failed on exactly this and could say neither.
 */
export async function waitForJob(
  db: SupabaseClient,
  jobId: string,
  timeoutMs: number,
): Promise<JobSnapshot> {
  const deadline = Date.now() + timeoutMs;
  let last: JobSnapshot = {
    status: 'unknown',
    error: null,
    chapter_id: null,
    attempts: null,
    started_at: null,
  };

  while (Date.now() < deadline) {
    const { data } = await db
      .from('chapter_queue')
      .select('status,error,chapter_id,attempts,started_at')
      .eq('id', jobId)
      .maybeSingle();

    if (data) {
      last = data as JobSnapshot;
      if (last.status === 'done' || last.status === 'failed') {
        return last;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  return last;
}

/** One line a human can read straight out of a CI log. */
export function describeJob(job: JobSnapshot): string {
  return `status=${job.status} attempts=${job.attempts} `
    + `started_at=${job.started_at ?? 'null'} error=${job.error ?? 'none'}`;
}
