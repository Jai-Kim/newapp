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
import { monthlyAttemptCount } from './db-generation-attempts';
import { insertPrintOrder } from './db-print-orders';

/**
 * Volume grouping (issue #22, ADR-0003), a third copy for a third runtime.
 * src/features/reader/volumes.ts (the app) and supabase/functions/_shared/
 * volumes.ts (Deno) already duplicate this for the same reason this one does:
 * each runtime has its own toolchain (the app is bundled by Metro, the Edge
 * Function by Deno, this harness by Node/Playwright with the root tsconfig
 * excluding supabase/), so importing across them is more fragile than a
 * ten-line duplication. Keep VOLUME_SIZE and the rule in lockstep by hand.
 */
const VOLUME_SIZE = 10;

/**
 * The month-to-date chapter allowance (issue #6), a fourth copy for a fourth
 * runtime — same justification as VOLUME_SIZE above. Importing supabase/
 * functions/_shared/quota.ts here would pull in a `Deno.env.get` reference
 * this harness's Node process cannot satisfy, and this only needs the shape
 * of a blocked response, not the real config loading.
 */
const CHAPTER_MONTHLY_ALLOWANCE = 10;
const MONTHLY_QUOTA_COPY = {
  en: "This month's book is finished! A new one starts next month.",
  ko: '이번 달 책이 완성되었어요! 다음 달에 새 책이 시작돼요.',
};

function completedVolumeChapterIds(
  chapters: { id: string; number: number }[],
  volumeIndex: number,
): string[] | null {
  const ordered = [...chapters].sort((a, b) => a.number - b.number);
  const start = (volumeIndex - 1) * VOLUME_SIZE;
  const slice = ordered.slice(start, start + VOLUME_SIZE);
  return slice.length === VOLUME_SIZE ? slice.map(c => c.id) : null;
}

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

  // The server-side spend guard (issue #6). The real reserve_generation_
  // attempt() also enforces a per-user rate limit, which is exercised by
  // supabase/tests/generation_quota.sql instead — rate limiting depends on
  // wall-clock timing, which would make a browser e2e test flaky for no real
  // coverage gain. This mirrors the response shape the real Edge Function
  // returns (code + bilingual copy), not a bare error.
  if (monthlyAttemptCount(childId) >= CHAPTER_MONTHLY_ALLOWANCE) {
    return json(route, {
      ok: false,
      code: 'monthly_quota_exceeded',
      error: MONTHLY_QUOTA_COPY.en,
      message_en: MONTHLY_QUOTA_COPY.en,
      message_ko: MONTHLY_QUOTA_COPY.ko,
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

/**
 * Concierge print capture (issue #22). Mirrors the real submit-print-order
 * function's contract: the chapter snapshot is computed here from
 * `child_readable_chapters`, using the same grouping rule as the real
 * function, never trusted from the request body — and the write goes through
 * the same privileged path the real function's service role would use,
 * because print_orders has no client-facing insert policy.
 */
async function stubSubmitPrintOrder(route: Route, ctx: Ctx) {
  const childId = ctx.childId();
  if (!childId) {
    return json(route, { ok: false, error: 'no child yet' }, 400);
  }

  const body = route.request().postDataJSON() as {
    volume_index?: number;
    recipient_name?: string;
    shipping_address?: Record<string, unknown>;
    gift?: boolean;
    gift_message?: string;
    note?: string;
  };

  const volumeIndex = body.volume_index ?? 0;
  if (!Number.isInteger(volumeIndex) || volumeIndex < 1) {
    return json(route, { ok: false, error: 'a valid volume_index is required' }, 400);
  }
  const recipientName = body.recipient_name;
  if (!recipientName) {
    return json(route, { ok: false, error: 'recipient_name is required' }, 400);
  }

  const { data: readable } = await ctx.db
    .from('child_readable_chapters')
    .select('id,number')
    .eq('child_id', childId);

  const chapterIds = completedVolumeChapterIds(readable ?? [], volumeIndex);
  if (!chapterIds) {
    return json(route, { ok: false, error: 'that volume is not complete yet' }, 409);
  }

  // insertPrintOrder goes through the privileged CLI path (print_orders has
  // no client-facing insert policy), which can throw for reasons the real
  // function never sees this way — e.g. the CLI itself failing. An unhandled
  // throw here would leave the route (and the page waiting on it) hanging
  // rather than resolving, so this gets the same top-level catch the real
  // submit-print-order function has, translating it into the same shape.
  try {
    const order = insertPrintOrder({
      childId,
      volumeIndex,
      chapterIds,
      recipientName,
      shippingAddress: body.shipping_address ?? {},
      gift: Boolean(body.gift),
      giftMessage: body.gift_message ?? null,
      note: body.note ?? null,
    });

    // The one-live-order-per-volume index. A double-tap or a retry must not
    // hand-fulfil the same family's book twice — see insertPrintOrder.
    if (order === 'already_ordered') {
      return json(route, {
        ok: true,
        already_ordered: true,
        message: 'this book has already been ordered',
      });
    }

    return json(route, { ok: true, order_id: order.id, created_at: order.created_at });
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // A 500 here reads as "confirmation never appeared" from the test's side
    // — no locator names the cause. Log the real error so a future failure
    // names itself in the CI log instead of requiring a re-run to diagnose.
    console.error('[stubSubmitPrintOrder] insertPrintOrder failed:', message);
    return json(route, { ok: false, error: message }, 500);
  }
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
  await ctx.page.route('**/functions/v1/submit-print-order', r => stubSubmitPrintOrder(r, ctx));
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
