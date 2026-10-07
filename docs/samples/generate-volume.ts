/**
 * Taste-check: generate a full 10-chapter Volume for Boa through the real
 * pipeline, and export it as bilingual markdown.
 *
 * Not a test. This exists to answer a question no unit test can: does a whole
 * Volume read like one book? Continuity is the product's whole claim, and it
 * only shows up across ten nights — chapter 7 remembering what chapter 2
 * promised is the thing to look at.
 *
 * Chapters are generated STRICTLY IN SEQUENCE. Each one retrieves the Story
 * Bible as it stands, so generating them in parallel would produce ten
 * chapter ones that had never heard of each other.
 *
 *   npx tsx docs/samples/generate-volume.ts
 *
 * Reads .env for the project URL and anon key, and .env.e2e for the service
 * role key (used only to create the throwaway account this runs as).
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function readEnvFile(name: string): Record<string, string> {
  const file = path.join(process.cwd(), name);
  if (!fs.existsSync(file)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m) {
      out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  return out;
}

const env = { ...readEnvFile('.env'), ...readEnvFile('.env.e2e'), ...process.env };
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL!;
const ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY!;
const OUT = path.join(process.cwd(), 'docs/samples/boa-volume-1');

/**
 * Ten nights with a shape: settling in, a friendship, a setback, a promise
 * made, and — deliberately late — a promise kept. If cross-night memory works,
 * chapters 8-10 should be reaching back on their own.
 */
const LESSONS: { lesson: string; situation?: string }[] = [
  { lesson: 'being brave about something new', situation: 'first day at a new kindergarten' },
  { lesson: 'noticing when someone else is sad' },
  { lesson: 'sharing something you don\'t want to share' },
  { lesson: 'trying again after something goes wrong', situation: 'learning to ride a bike' },
  { lesson: 'telling the truth when it\'s hard' },
  { lesson: 'waiting for your turn' },
  { lesson: 'asking for help' },
  { lesson: 'being kind to someone left out' },
  { lesson: 'saying sorry and meaning it' },
  { lesson: 'finishing something you started' },
];

const BOA_LOOK = {
  presentation: 'girl',
  skin_tone: 'light-golden',
  hair_color: 'black',
  hair_texture: 'straight',
  hair_style: 'two-pigtails',
  fringe: 'blunt',
  eye_color: 'dark-brown',
  eye_shape: 'monolid',
  glasses: 'none',
  detail: 'mole-left',
  signature_color: 'terracotta',
  companion: 'magpie',
};

type Page = { page: number; en: string; ko: string; scene: string; wardrobe: string; illustrated?: boolean; image_path?: string };

function log(msg: string) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

async function main() {
  const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const email = `boa-sample-${randomUUID().replace(/-/g, '')}@storyloom-e2e.example.com`;
  const password = `Pw-${randomUUID().slice(0, 18)}`;

  log(`creating the account this runs as: ${email}`);
  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) {
    throw new Error(`could not create the sample account: ${createErr.message}`);
  }

  const db = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: session, error: signInErr } = await db.auth.signInWithPassword({ email, password });
  if (signInErr || !session.session) {
    throw new Error(`could not sign in: ${signInErr?.message}`);
  }
  const token = session.session.access_token;
  const call = async (fn: string, body: unknown) => {
    const res = await fetch(`${URL_}/functions/v1/${fn}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': ANON,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(`${fn} failed (${res.status}): ${JSON.stringify(json)?.slice(0, 300)}`);
    }
    return json as Record<string, unknown>;
  };

  // Family + child, written through the client so RLS decides ownership.
  const { data: family, error: famErr } = await db
    .from('families').insert({ auth_user_id: session.session.user.id }).select('id').single();
  if (famErr) {
    throw famErr;
  }
  const { data: child, error: childErr } = await db.from('children').insert({
    family_id: family.id,
    first_name: 'Boa',
    age_band: '5-6',
    primary_language: 'ko',
    interests: ['the sea', 'rain', 'birds', 'baking', 'drawing'],
  }).select('*').single();
  if (childErr) {
    throw childErr;
  }
  log(`child created: Boa (${child.id})`);

  log('locking the character sheet…');
  const sheet = await call('lock-character', { child_id: child.id, choices: BOA_LOOK });
  log(`sheet locked: ${sheet.image_path}`);

  fs.mkdirSync(OUT, { recursive: true });
  const meta: unknown[] = [];

  for (const [i, night] of LESSONS.entries()) {
    const n = i + 1;
    const started = Date.now();
    log(`chapter ${n}/10 — "${night.lesson}"…`);
    const result = await call('generate-chapter', {
      child_id: child.id,
      lesson: night.lesson,
      situation: night.situation,
    });
    const elapsed = Math.round((Date.now() - started) / 1000);
    fs.mkdirSync(OUT, { recursive: true });
    const chapter = result.chapter as { title_en: string; title_ko: string; summary: string; pages: Page[]; delta: Record<string, unknown> };
    const safety = result.safety as { verdict: string; concerns: unknown[] };
    log(`  → "${chapter.title_en}" / "${chapter.title_ko}" (${chapter.pages.length} pages, ${elapsed}s, safety=${safety.verdict})`);

    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(
      path.join(OUT, `chapter-${String(n).padStart(2, '0')}.md`),
      renderChapter(n, night.lesson, night.situation, chapter),
    );
    meta.push({
      number: n,
      lesson: night.lesson,
      situation: night.situation ?? null,
      title_en: chapter.title_en,
      title_ko: chapter.title_ko,
      summary: chapter.summary,
      pages: chapter.pages.length,
      latency_s: elapsed,
      safety: safety.verdict,
      chapter_id: result.chapter_id,
      delta: chapter.delta,
    });
    fs.writeFileSync(path.join(OUT, 'volume.json'), `${JSON.stringify({ child_id: child.id, email, chapters: meta }, null, 2)}\n`);
  }

  log('illustrating chapter 1 only…');
  const firstId = (meta[0] as { chapter_id: string }).chapter_id;
  try {
    const art = await call('illustrate-chapter', { chapter_id: firstId });
    log(`  → illustrated pages: ${JSON.stringify(art.illustrated)}`);
    fs.writeFileSync(path.join(OUT, 'chapter-01-art.json'), `${JSON.stringify(art, null, 2)}\n`);
  }
  catch (e) {
    log(`  ! illustration failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  log(`done. Output in ${OUT}`);
  log(`account left in place for inspection: ${email}`);
}

function renderChapter(
  n: number,
  lesson: string,
  situation: string | undefined,
  chapter: { title_en: string; title_ko: string; summary: string; pages: Page[] },
): string {
  const lines: string[] = [
    `# Chapter ${n} — ${chapter.title_en}`,
    '',
    `## ${chapter.title_ko}`,
    '',
    `> **Tonight's lesson:** ${lesson}`,
    ...(situation === undefined ? [] : [`> **What's happening:** ${situation}`]),
    '',
    `_${chapter.summary}_`,
    '',
    '---',
    '',
  ];

  for (const page of chapter.pages) {
    lines.push(`### Page ${page.page}${page.illustrated ? ' · illustrated' : ''}`, '');
    // Korean first: Boa's primary_language is ko, so this is the order her
    // family actually reads the page in (ADR-0001 §3).
    lines.push(page.ko, '', page.en, '');
    lines.push(`<sub>Scene: ${page.scene}</sub>`, '');
    lines.push(`<sub>Wardrobe: ${page.wardrobe}</sub>`, '');
  }
  return `${lines.join('\n')}\n`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
