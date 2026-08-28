import type { Page, Route } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  FIXTURE_LESSON,
  FIXTURE_PAGES,
  FIXTURE_PNG,
  FIXTURE_SUMMARY,
  FIXTURE_TITLE_EN,
  FIXTURE_TITLE_KO,
} from '../fixtures/chapter';
import { MONTHLY_CHAPTER_ALLOWANCE, QUOTA_MESSAGES } from '../fixtures/quota';
import { monthlyAttemptCount } from './db-generation-attempts';

/**
 * Stub mode: the AI providers are replaced, and nothing else is.
 *
 * The seam is the Edge Function boundary, so what a stub returns has to match
 * what the real function returns AND leave the database in the same state the
 * real one would. The important consequence is that the stubs do NOT complete
 * a generation job — the real `enqueue-chapter` returns while the job is still
 * running, and a stub that finished instantly would make the double-tap
 * assertion pass for the wrong reason (a second job would be legal because the
 * first was already done). `runStubWorker` is the deliberate second step.
 *
 * What this mode therefore does NOT cover, by construction: the inside of the
 * Edge Functions, the provider contracts, and the background worker. That is
 * exactly what live mode is for — the two layers are complementary, and
 * neither is sufficient alone.
 */

type Ctx = {
  page: Page;
  db: SupabaseClient;
  childId: () => string | null;
};

const SHEET_DESCRIPTOR
  = 'Yuna is a 6-year-old girl. She has light golden skin. Her hair is straight '
    + 'and black, worn in two low pigtails, with a blunt fringe cut straight '
    + 'across above the eyebrows.';

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  });
}

/** Locks a character sheet without drawing one. */
async function stubLockCharacter(route: Route, ctx: Ctx) {
  const childId = ctx.childId();
  if (!childId) {
    return json(route, { ok: false, error: 'no child yet' }, 400);
  }

  const imagePath = `character-refs/${childId}/e2e-fixture.png`;
  // The real function writes this row; so must the stub, or the illustration
  // path and the picker's "already locked" branch have nothing to read.
  await ctx.db
    .from('children')
    .update({
      character_ref: {
        identity: { image_path: imagePath, descriptor: SHEET_DESCRIPTOR },
        wardrobe_default: 'simple everyday clothes with terracotta as the accent',
        companion: null,
        locked_at: new Date().toISOString(),
        model: 'e2e-fixture',
      },
    })
    .eq('id', childId);

  return json(route, {
    ok: true,
    child_id: childId,
    image_path: imagePath,
    preview_url: `${new URL(route.request().url()).origin}/storage/v1/object/sign/character-refs/fixture`,
    descriptor: SHEET_DESCRIPTOR,
    wardrobe_default: 'simple everyday clothes with terracotta as the accent',
    latency_ms: 1,
    model: 'e2e-fixture',
  });
}

/**
 * Queues a job exactly as the real function does — including letting the
 * one-live-job unique index reject a second one. This is the assertion the
 * whole stub exists to make honest: the constraint under test is the real
 * Postgres index, not a branch in this file.
 */
async function stubEnqueue(route: Route, ctx: Ctx) {
  const childId = ctx.childId();
  if (!childId) {
    return json(route, { ok: false, error: 'no child yet' }, 400);
  }

  const body = route.request().postDataJSON() as {
    action?: string;
    lesson?: string;
    situation?: string;
  };

  if (body.action === 'sweep') {
    return json(route, { ok: true, revived: 0 });
  }

  // Mirrors reserve_generation_attempt's month-to-date guard (issue #6). The
  // real Edge Function never runs in stub mode (see the note at the top of
  // this file), so the check is replicated here against the same table —
  // rate-limiting is not, since it depends on wall-clock timing that would
  // make this suite flaky; supabase/tests/generation_quota.sql covers it
  // against the real database function instead.
  if (monthlyAttemptCount(childId) >= MONTHLY_CHAPTER_ALLOWANCE) {
    const copy = QUOTA_MESSAGES.monthly_quota_reached;
    return json(route, {
      ok: false,
      error: copy.en,
      code: 'monthly_quota_reached',
      message_en: copy.en,
      message_ko: copy.ko,
    }, 429);
  }

  const lesson = body.lesson ?? FIXTURE_LESSON;
  const { data, error } = await ctx.db
    .from('chapter_queue')
    .insert({
      child_id: childId,
      lesson,
      situation: body.situation ?? null,
      auto_chosen: !body.lesson,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return json(route, {
        ok: true,
        already_queued: true,
        message: 'a chapter is already being written for this child',
      });
    }
    return json(route, { ok: false, error: error.message }, 500);
  }

  return json(route, {
    ok: true,
    job_id: data.id,
    lesson,
    auto_chosen: !body.lesson,
    status: 'running',
  });
}

/** Signed-URL requests, and the bytes they point at. */
async function stubStorage(route: Route) {
  if (route.request().method() === 'GET') {
    return route.fulfill({
      status: 200,
      contentType: 'image/png',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: FIXTURE_PNG,
    });
  }

  const body = route.request().postDataJSON() as {
    paths?: string[];
    expiresIn?: number;
  };
  const url = new URL(route.request().url());
  const bucket = url.pathname.split('/').pop();

  // createSignedUrls (plural) posts { paths }; createSignedUrl (singular) does
  // not, and the two return different shapes.
  if (Array.isArray(body?.paths)) {
    return json(
      route,
      body.paths.map(p => ({
        path: p,
        error: null,
        signedURL: `/object/sign/${bucket}/${p}?token=e2e`,
      })),
    );
  }
  return json(route, { signedURL: `/object/sign/${bucket}/fixture?token=e2e` });
}

/** Installs every stub. Call once, before the first navigation. */
export async function installStubs(ctx: Ctx): Promise<void> {
  await ctx.page.route('**/functions/v1/lock-character', r => stubLockCharacter(r, ctx));
  await ctx.page.route('**/functions/v1/enqueue-chapter', r => stubEnqueue(r, ctx));
  await ctx.page.route('**/functions/v1/generate-chapter', r =>
    json(r, { ok: false, error: 'generate-chapter is not used by the nightly flow' }, 400));
  await ctx.page.route('**/storage/v1/object/sign/**', r => stubStorage(r));
}

/**
 * What the background worker would have done: write the chapter, attach art
 * paths, close the job out.
 *
 * Separate from the enqueue stub on purpose — see the note at the top of this
 * file. The test calls it when it wants the night to have passed.
 */
export async function runStubWorker(
  db: SupabaseClient,
  childId: string,
): Promise<string> {
  const { data: job } = await db
    .from('chapter_queue')
    .select('id,lesson,situation')
    .eq('child_id', childId)
    .in('status', ['queued', 'running'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: last } = await db
    .from('chapters')
    .select('number')
    .eq('child_id', childId)
    .order('number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const number = ((last?.number as number) ?? 0) + 1;
  const pages = FIXTURE_PAGES.map(p => ({
    ...p,
    // Only the illustrated pages get art, exactly as illustrate-chapter does.
    ...(p.illustrated
      ? { image_path: `illustrations/${childId}/ch${number}/p${p.page}.png` }
      : {}),
  }));

  const { data: chapter, error } = await db
    .from('chapters')
    .insert({
      child_id: childId,
      number,
      title_en: `${FIXTURE_TITLE_EN}${number > 1 ? ` (${number})` : ''}`,
      title_ko: FIXTURE_TITLE_KO,
      lesson: (job?.lesson as string) ?? FIXTURE_LESSON,
      situation: (job?.situation as string) ?? null,
      pages,
      summary: FIXTURE_SUMMARY,
      // The parent gate is real: a chapter is born pending, never readable.
      review_status: 'pending',
      safety: {
        verdict: 'safe',
        concerns: [],
        checked_languages: ['en', 'ko'],
        model: 'e2e-fixture',
        latency_ms: 1,
      },
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`stub worker could not write the chapter: ${error.message}`);
  }

  if (job) {
    // Clients cannot update chapter_queue (there is no update policy), which is
    // the security property the queue relies on — so the stub worker asks the
    // privileged path to close the job, exactly as the real worker does.
    const { closeJob } = await import('./db-jobs');
    closeJob(job.id as string, chapter.id as string);
  }

  return chapter.id as string;
}
