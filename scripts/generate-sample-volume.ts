#!/usr/bin/env -S pnpm tsx
/**
 * Storyloom — taste-check harness (issue #22).
 *
 * NOT a feature and NOT part of the test suite. A one-off, human-run script
 * for judging story and Korean quality — the thing green CI has never once
 * had an opinion about. It drives the REAL pipeline exactly the way the app
 * does: the same Edge Functions, the same providers, the same spend guard —
 * never a reimplementation of `_shared/generate.ts`/`illustrate.ts` — and
 * exports the result as plain markdown so a person can read all 10 nights.
 *
 * It creates one throwaway parent account and one child ("Boa" by default),
 * locks a character sheet, generates a full 10-chapter Volume (one real
 * `generate-chapter` call per night, sequentially — each call reads the
 * chapters already persisted by the one before it, so continuity is genuine,
 * not scripted), approves each chapter (the parent-preview gate, same as a
 * real parent tapping Approve), illustrates chapter 1 only, and writes
 * everything to `docs/samples/<slug>/`.
 *
 * This spends real money at two paid providers. It does not spend anything
 * this run did not ask for: one transient-error retry per call at most, no
 * extra illustration beyond chapter 1.
 *
 * Requires, read from `.env`/`.env.e2e` (same convention as
 * e2e/support/env.ts) or the process environment:
 *   EXPO_PUBLIC_SUPABASE_URL
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY   -- to create one pre-confirmed throwaway
 *                                  account only; never used for anything else
 *                                  and never sent to a provider.
 *
 * The Edge Functions read ANTHROPIC_API_KEY / GEMINI_API_KEY from the
 * SUPABASE PROJECT's own secrets (`supabase secrets set`), not from this
 * script's environment — this script never touches a provider key directly.
 *
 * Run:
 *   pnpm tsx scripts/generate-sample-volume.ts
 *   pnpm tsx scripts/generate-sample-volume.ts --name Boa --age 5-6 --lead ko \
 *     --interests "the sea,drawing,gardens" --slug boa-volume-1
 */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

type AgeBand = '3-4' | '5-6' | '7-8';
type Language = 'en' | 'ko';

type Args = {
  name: string;
  ageBand: AgeBand;
  lead: Language;
  interests: string[];
  slug: string;
  illustrations: number;
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string, fallback: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
  };
  const name = get('--name', 'Boa');
  return {
    name,
    ageBand: get('--age', '5-6') as AgeBand,
    lead: get('--lead', 'ko') as Language,
    interests: get('--interests', 'the sea,drawing,gardens')
      .split(',').map(s => s.trim()).filter(Boolean),
    slug: get('--slug', `${name.toLowerCase()}-volume-1`),
    illustrations: Number(get('--illustrations', '4')),
  };
}

/**
 * `value` mirrors the server's fallback lesson list byte for byte
 * (`FALLBACK_LESSONS` in supabase/functions/_shared/lessons.ts) — the crisis
 * screener special-cases an exact match against that list to skip a model
 * call, so using these verbatim (rather than inventing new lessons) is also
 * the cheaper path. One per chapter is exactly ten, which is exactly one
 * Volume (ADR-0003).
 */
const LESSONS: string[] = [
  'trying again after something goes wrong',
  'sharing something you don\'t want to share',
  'being brave about something new',
  'saying sorry and meaning it',
  'noticing when someone else is sad',
  'waiting for your turn',
  'telling the truth when it\'s hard',
  'asking for help',
  'being kind to someone left out',
  'finishing something you started',
];

/**
 * The character-choice fixture already established in
 * e2e/support/flow.ts's `lockCharacterLook` — a Korean-presenting girl, built
 * from `_shared/character.ts`'s own catalogue (which is written specifically
 * to be able to express a real Korean child rather than a generic "Asian"
 * cartoon face, per that file's comments). Reused as-is for consistency with
 * the one other place in this repo that draws this same reference child.
 */
const CHARACTER_CHOICES = {
  presentation: 'girl',
  skin_tone: 'light-golden',
  hair_color: 'black',
  hair_texture: 'straight',
  hair_style: 'two-pigtails',
  fringe: 'blunt',
  eye_shape: 'monolid',
  eye_color: 'dark-brown',
  glasses: 'none',
  detail: 'mole-left',
  signature_color: 'terracotta',
  companion: 'magpie',
};

/**
 * PRICING IS AN ESTIMATE, NOT A FACT. Verify against
 * https://www.anthropic.com/pricing and
 * https://ai.google.dev/gemini-api/docs/pricing before trusting the total —
 * provider prices change, and this script has no way to check them at run
 * time. It also only prices the STORYTELLER's own token usage (the `usage`
 * field generate-chapter returns) and the images actually generated; it
 * cannot price the safety-reviewer's calls (one per chapter, one per
 * generated image, one for the character sheet) because the Edge Functions
 * do not return that usage — so the real total is measurably higher than
 * this estimate. The script always prints the raw token/image counts too, so
 * the true total can be recomputed from a provider dashboard.
 */
const PRICING = {
  claudeOpus5: { inputPerMTok: 15, outputPerMTok: 75 },
  geminiFlashImage: { perImage: 0.039 },
};

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

function readEnvFile(name: string): Record<string, string> {
  const file = path.join(process.cwd(), name);
  if (!fs.existsSync(file)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (match) {
      out[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  return out;
}

const dotenv = { ...readEnvFile('.env'), ...readEnvFile('.env.e2e') };

function required(name: string): string {
  const value = process.env[name] ?? dotenv[name];
  if (!value) {
    throw new Error(
      `${name} is not set. This script needs the app's .env (or the same `
      + 'values in the environment) plus SUPABASE_SERVICE_ROLE_KEY to reach '
      + 'the real Supabase project. See the header of this file.',
    );
  }
  return value;
}

const SUPABASE_URL = required('EXPO_PUBLIC_SUPABASE_URL');
const SUPABASE_ANON_KEY = required('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const SERVICE_ROLE_KEY = required('SUPABASE_SERVICE_ROLE_KEY');

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function log(msg: string) {
  console.log(`[taste-check] ${msg}`);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * supabase-js reports any non-2xx `functions.invoke` call as a generic
 * FunctionsHttpError; the useful part is the response body on `.context`.
 * Mirrors `bodyOf` in src/lib/supabase/nightly.ts.
 */
async function bodyOf(error: unknown): Promise<Record<string, unknown> | null> {
  const context = (error as { context?: unknown } | null)?.context;
  if (!(context instanceof Response)) {
    return null;
  }
  try {
    return (await context.clone().json()) as Record<string, unknown>;
  }
  catch {
    return null;
  }
}

/** One retry on a transient provider error — a bad minute, not a bad prompt. */
function isTransient(message: string): boolean {
  return /\b(429|500|502|503|504)\b|high demand|UNAVAILABLE|overloaded|rate limit|timeout/i
    .test(message);
}

/** Calls an Edge Function under the signed-in child's own session, with one retry. */
async function invoke<T>(
  client: SupabaseClient,
  name: string,
  options: { body: Record<string, unknown>; attempts?: number },
): Promise<T> {
  const attempts = options.attempts ?? 2;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const { data, error } = await client.functions.invoke(name, { body: options.body });
    if (!error) {
      return data as T;
    }
    lastErr = error;
    const parsed = await bodyOf(error);
    const message = typeof parsed?.error === 'string' ? parsed.error : error.message;
    if (attempt < attempts && isTransient(message)) {
      log(`${name}: transient failure ("${message}"), retrying once...`);
      await sleep(5_000);
      continue;
    }
    throw new Error(`${name} failed: ${message}${parsed ? ` (${JSON.stringify(parsed)})` : ''}`);
  }
  throw lastErr;
}

type ChapterPage = {
  page: number;
  en: string;
  ko: string;
  scene: string;
  wardrobe: string;
  illustrated: boolean;
  image_path?: string;
};

type GeneratedChapter = {
  title_en: string;
  title_ko: string;
  summary: string;
  pages: ChapterPage[];
  delta: {
    new_characters: { name: string; role: string; traits: string }[];
    new_world: { name: string; type: string; description: string }[];
    threads_opened: { summary: string }[];
    threads_resolved: { id: string; how: string }[];
  };
};

type GenerateResponse = {
  ok: boolean;
  chapter_id: string;
  number: number;
  chapter: GeneratedChapter;
  safety: { verdict: string; issue?: string | null };
  review_status: string;
  latency_ms: number;
  usage: { input_tokens?: number; output_tokens?: number } | null;
};

type IllustrateResponse = {
  ok: boolean;
  illustrated: number[];
  blocked: { page: number; blocked?: string }[];
  failed: { page: number; error?: string }[];
  images: { page: number; image_base64: string }[];
};

type VolumeChapter = {
  number: number;
  chapterId: string;
  chapter: GeneratedChapter;
  lesson: string;
};

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

/** Creates one pre-confirmed throwaway account — no confirmation mail sent. */
async function provisionParent(): Promise<{ email: string; password: string; userId: string }> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `taste-check-${randomUUID().replace(/-/g, '')}@storyloom-e2e.example.com`;
  const password = `Pw-${randomUUID().slice(0, 18)}`;

  log(`Creating throwaway parent account ${email} ...`);
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`could not create the test parent: ${error?.message}`);
  }
  return { email, password, userId: data.user.id };
}

/** A client signed in as the parent, same anon key and RLS the app itself uses. */
async function signInAsParent(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`could not sign in as the test parent: ${error.message}`);
  }
  return client;
}

/** One family, one child — the client-side path, the same RLS-checked one onboarding uses. */
async function createFamilyAndChild(
  client: SupabaseClient,
  userId: string,
  args: Args,
): Promise<string> {
  log('Creating family + child ...');
  const { data: family, error: familyErr } = await client
    .from('families').insert({ auth_user_id: userId }).select('id').single();
  if (familyErr || !family) {
    throw new Error(`could not create the family: ${familyErr?.message}`);
  }

  const { data: child, error: childErr } = await client
    .from('children')
    .insert({
      family_id: family.id,
      first_name: args.name,
      age_band: args.ageBand,
      primary_language: args.lead,
      interests: args.interests,
    })
    .select('id')
    .single();
  if (childErr || !child) {
    throw new Error(`could not create the child: ${childErr?.message}`);
  }
  log(`Child id: ${child.id}`);
  return child.id as string;
}

async function lockCharacter(client: SupabaseClient, childId: string): Promise<void> {
  log('Locking character sheet ...');
  const lock = await invoke<{ ok: boolean; image_path: string }>(client, 'lock-character', {
    body: { child_id: childId, choices: CHARACTER_CHOICES },
  });
  log(`Character locked: ${lock.image_path}`);
}

/** One real generate-chapter call, plus the parent-preview approve, per night. */
async function generateOneChapter(
  client: SupabaseClient,
  childId: string,
  night: { lesson: string; index: number },
): Promise<{ chapter: VolumeChapter; inputTokens: number; outputTokens: number }> {
  const { lesson, index } = night;
  log(`Generating chapter ${index + 1}/${LESSONS.length} — "${lesson}" ...`);
  const started = Date.now();
  const result = await invoke<GenerateResponse>(client, 'generate-chapter', {
    body: { child_id: childId, lesson },
  });
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  if (result.safety.verdict === 'blocked') {
    // Stop rather than let a blocked chapter silently break continuity for
    // the rest of the volume — see it, decide by hand, don't guess.
    throw new Error(
      `chapter ${result.number} was blocked by the content filter: `
      + `${result.safety.issue ?? '(no reason given)'}. Stopping — a blocked `
      + 'chapter never joins the Story Bible, so continuing would just '
      + 'restart the arc from here.',
    );
  }

  const inputTokens = result.usage?.input_tokens ?? 0;
  const outputTokens = result.usage?.output_tokens ?? 0;
  const usd = (inputTokens / 1_000_000) * PRICING.claudeOpus5.inputPerMTok
    + (outputTokens / 1_000_000) * PRICING.claudeOpus5.outputPerMTok;

  log(`  -> "${result.chapter.title_en}" / "${result.chapter.title_ko}" `
    + `(${result.chapter.pages.length} pages, ${elapsed}s, `
    + `${inputTokens}+${outputTokens} tokens, ~$${usd.toFixed(4)})`);

  log(`  Approving chapter ${result.number} (parent-preview gate) ...`);
  const { error: approveErr } = await client.rpc('approve_chapter', {
    p_chapter_id: result.chapter_id,
    p_approved: true,
  });
  if (approveErr) {
    throw new Error(`could not approve chapter ${result.number}: ${approveErr.message}`);
  }

  return {
    chapter: {
      number: result.number,
      chapterId: result.chapter_id,
      chapter: result.chapter,
      lesson,
    },
    inputTokens,
    outputTokens,
  };
}

/** The whole 10-night arc, sequentially — each night's canon includes every night before it. */
async function generateVolume(
  client: SupabaseClient,
  childId: string,
): Promise<{ chapters: VolumeChapter[]; inputTokens: number; outputTokens: number }> {
  const chapters: VolumeChapter[] = [];
  let inputTokens = 0;
  let outputTokens = 0;

  for (let i = 0; i < LESSONS.length; i++) {
    const outcome = await generateOneChapter(client, childId, { lesson: LESSONS[i], index: i });
    chapters.push(outcome.chapter);
    inputTokens += outcome.inputTokens;
    outputTokens += outcome.outputTokens;

    // Stay comfortably under GENERATION_RATE_LIMIT_MAX (default 3/60s/user) —
    // generate-chapter itself takes ~93s, so this is a floor, not the reason
    // for the pause.
    if (i < LESSONS.length - 1) {
      await sleep(2_000);
    }
  }
  return { chapters, inputTokens, outputTokens };
}

/** Illustrates chapter 1's marked emotional-beat pages and saves the images to disk. */
async function illustrateChapterOne(
  client: SupabaseClient,
  chapter1: VolumeChapter,
  options: { imagesDir: string; illustrations: number },
): Promise<{ imageCount: number; imageCostUsd: number }> {
  const { imagesDir, illustrations } = options;
  log('Illustrating chapter 1 only (to control cost) ...');
  const result = await invoke<IllustrateResponse>(client, 'illustrate-chapter', {
    body: { chapter_id: chapter1.chapterId, illustrations, return_images: true },
  });

  const imageCostUsd = result.images.length * PRICING.geminiFlashImage.perImage;
  log(`  -> illustrated pages: ${result.illustrated.join(', ')} `
    + `(${result.images.length} image(s), ~$${imageCostUsd.toFixed(4)})`);
  if (result.blocked.length) {
    log(`  -> blocked by image review: ${JSON.stringify(result.blocked)}`);
  }
  if (result.failed.length) {
    log(`  -> failed: ${JSON.stringify(result.failed)}`);
  }

  for (const img of result.images) {
    const filename = `ch1-p${img.page}.png`;
    fs.writeFileSync(path.join(imagesDir, filename), Buffer.from(img.image_base64, 'base64'));
    const page = chapter1.chapter.pages.find(pg => pg.page === img.page);
    if (page) {
      page.image_path = `images/${filename}`;
    }
  }

  return { imageCount: result.images.length, imageCostUsd };
}

// ---------------------------------------------------------------------------
// Markdown export
// ---------------------------------------------------------------------------

function pageMarkdown(p: ChapterPage): string {
  const image = p.image_path ? `![Page ${p.page}](${p.image_path})\n\n` : '';
  const beat = p.illustrated ? ' — _emotional beat, marked for illustration_' : '';
  return [
    `### Page ${p.page}${beat}`,
    '',
    `${image}**EN:** ${p.en}`,
    '',
    `**KO:** ${p.ko}`,
    '',
    `> Scene: ${p.scene}`,
    `> Wardrobe: ${p.wardrobe}`,
    '',
  ].join('\n');
}

function deltaMarkdown(chapter: GeneratedChapter): string {
  const d = chapter.delta;
  const lines: string[] = [];
  if (d.new_characters.length) {
    lines.push(`**New characters:** ${d.new_characters
      .map(c => `${c.name} (${c.role}) — ${c.traits}`).join('; ')}`);
  }
  if (d.new_world.length) {
    lines.push(`**New places/objects:** ${d.new_world
      .map(w => `${w.name} (${w.type}) — ${w.description}`).join('; ')}`);
  }
  if (d.threads_opened.length) {
    lines.push(`**Threads opened:** ${d.threads_opened.map(t => t.summary).join('; ')}`);
  }
  if (d.threads_resolved.length) {
    lines.push(`**Threads resolved:** ${d.threads_resolved.map(t => t.how).join('; ')}`);
  }
  return lines.length ? `${lines.join('\n\n')}\n` : '';
}

function chapterMarkdown(number: number, lesson: string, chapter: GeneratedChapter): string {
  return [
    `# Chapter ${number} — ${chapter.title_en} / ${chapter.title_ko}`,
    '',
    `**Tonight's lesson:** ${lesson}`,
    '',
    `**Summary:** ${chapter.summary}`,
    '',
    deltaMarkdown(chapter),
    '---',
    '',
    chapter.pages.map(pageMarkdown).join('\n'),
  ].join('\n');
}

type CostTotals = {
  inputTokens: number;
  outputTokens: number;
  textUsd: number;
  imageCount: number;
  imageCostUsd: number;
};

function costMarkdown(totals: CostTotals): string {
  const { inputTokens, outputTokens, textUsd, imageCount, imageCostUsd } = totals;
  return [
    '## Cost (see caveats)',
    '',
    `- Storyteller text generation, 10 chapters: ${inputTokens} input + `
    + `${outputTokens} output tokens ≈ **$${textUsd.toFixed(4)}**`,
    `- Chapter-1 illustration: ${imageCount} image(s) ≈ **$${imageCostUsd.toFixed(4)}**`,
    `- **Estimated total: ~$${(textUsd + imageCostUsd).toFixed(4)}**`,
    '',
    '**This total is an underestimate and the per-token prices are not '
    + 'verified live.** It only prices the storyteller\'s own `usage` field '
    + 'and the images actually generated — it does NOT include the safety '
    + 'reviewer\'s own model calls (one per chapter, one per generated image, '
    + 'one for the character sheet), because the Edge Functions do not return '
    + 'that usage. Check your Anthropic and Google AI Studio dashboards for '
    + 'the authoritative total for this time window.',
    '',
  ].join('\n');
}

type IndexMeta = {
  args: Args;
  email: string;
  childId: string;
  chapters: VolumeChapter[];
  totals: CostTotals;
};

function writeIndex(outDir: string, meta: IndexMeta): void {
  const { args, email, childId, chapters, totals } = meta;
  const { imageCount } = totals;
  const chapterLinks = chapters.map(({ number, chapter, lesson }) =>
    `1. [Chapter ${number} — ${chapter.title_en} / ${chapter.title_ko}]`
    + `(./chapter-${String(number).padStart(2, '0')}.md) — lesson: _${lesson}_`);

  const index = [
    `# ${args.name}'s first Volume — taste-check sample`,
    '',
    'Generated by `scripts/generate-sample-volume.ts` against the real '
    + 'pipeline (issue #22) for human review — not a feature, not fixtures.',
    '',
    '## Child',
    '',
    `- Name: ${args.name}`,
    `- Age band: ${args.ageBand}`,
    `- Primary language: ${args.lead}`,
    `- Interests: ${args.interests.join(', ')}`,
    `- Test account: \`${email}\` (throwaway; safe to delete)`,
    `- Child id: \`${childId}\``,
    '',
    '## Chapters',
    '',
    ...chapterLinks,
    '',
    '## Illustration',
    '',
    `Only chapter 1 was illustrated (${imageCount} of its marked emotional-beat `
    + 'pages), per the taste-check instruction to control cost. Chapters 2–10 '
    + 'are text-only; each page still records the `scene`/`wardrobe` the '
    + 'storyteller wrote for the illustrator, so the full page feel for those '
    + 'nights can still be judged from the prose plus those notes.',
    '',
    costMarkdown(totals),
    '## Cleanup',
    '',
    'This created one real throwaway account. To remove it and everything '
    + 'under it (cascades: auth user → family → child → chapters/characters/'
    + 'world/threads):',
    '',
    '```sql',
    `delete from auth.users where email = '${email}';`,
    '```',
    '',
  ].join('\n');

  fs.writeFileSync(path.join(outDir, 'README.md'), index);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();
  const outDir = path.join(process.cwd(), 'docs', 'samples', args.slug);
  const imagesDir = path.join(outDir, 'images');
  fs.mkdirSync(imagesDir, { recursive: true });

  log(`Child: ${args.name}, age ${args.ageBand}, lead ${args.lead}, `
    + `interests: ${args.interests.join(', ')}`);
  log(`Output: ${outDir}`);

  const { email, password, userId } = await provisionParent();
  const client = await signInAsParent(email, password);
  const childId = await createFamilyAndChild(client, userId, args);

  await lockCharacter(client, childId);
  const { chapters, inputTokens, outputTokens } = await generateVolume(client, childId);
  const { imageCount, imageCostUsd } = await illustrateChapterOne(
    client, chapters[0], { imagesDir, illustrations: args.illustrations },
  );

  log('Writing markdown export ...');
  for (const { number, lesson, chapter } of chapters) {
    const filename = `chapter-${String(number).padStart(2, '0')}.md`;
    fs.writeFileSync(path.join(outDir, filename), chapterMarkdown(number, lesson, chapter));
  }

  const textUsd = (inputTokens / 1_000_000) * PRICING.claudeOpus5.inputPerMTok
    + (outputTokens / 1_000_000) * PRICING.claudeOpus5.outputPerMTok;
  writeIndex(outDir, {
    args,
    email,
    childId,
    chapters,
    totals: { inputTokens, outputTokens, textUsd, imageCount, imageCostUsd },
  });

  log('Done.');
  log(`Estimated cost: ~$${(textUsd + imageCostUsd).toFixed(4)} (see README.md "Cost" section for caveats)`);
  log(`Exported to: ${outDir}`);
}

main().catch((err) => {
  console.error('[taste-check] FAILED:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
