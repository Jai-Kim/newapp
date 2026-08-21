/**
 * Slice-2 verification: do the picker's structured choices compose into a
 * prompt that actually produces a usable character sheet?
 *
 * Renders through the Spike A harness (same model, same server-held key) so
 * this exercises the real prompt builder, not a paraphrase of it.
 *
 * HISTORICAL: the `spike-a` bridge this posts to has since been deleted — it
 * was callable with the public anon key and spent money at a paid provider.
 * Kept as the record of how the committed sheets were produced. To re-run,
 * point it at `lock-character` with a real session instead.
 */
import fs from 'node:fs';
import path from 'node:path';

import {
  buildCompanionDescriptor,
  buildIdentityDescriptor,
  buildSheetPrompt,
  buildWardrobeDefault,
  validateChoices,
} from '../../../../supabase/functions/_shared/character.ts';

const HOUSE_STYLE
  = 'Children\'s picture-book illustration in soft gouache: warm limited palette '
    + 'of cream, terracotta, sage and dusty teal; visible paper grain; gentle '
    + 'rounded shapes; soft diffuse lighting; no hard black outlines; painterly '
    + 'brush texture. Cosy, reassuring, bedtime-story mood.';

const OUT = new URL('.', import.meta.url).pathname;

const CASES = [
  {
    // ADR-0001's first real user: a Korean-American girl. Directly comparable
    // to Spike A step 4, which had to be hand-written to get this right.
    slug: 'yuna-korean-girl',
    name: 'Yuna',
    age_band: '5-6',
    choices: {
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
    },
  },
  {
    // The de-gendering fix: a boy must not come out described as "her".
    slug: 'theo-boy-glasses',
    name: 'Theo',
    age_band: '5-6',
    choices: {
      presentation: 'boy',
      skin_tone: 'fair',
      hair_color: 'light-brown',
      hair_texture: 'wavy',
      hair_style: 'short-crop',
      fringe: 'side-swept',
      eye_color: 'green',
      eye_shape: 'round',
      glasses: 'round',
      detail: 'freckles',
      signature_color: 'sage',
      companion: 'fox',
    },
  },
  {
    // The neutral presentation option, plus coily hair and deep skin — the
    // combination most likely to be flattened toward a generic cartoon.
    slug: 'ama-neutral-coily',
    name: 'Ama',
    age_band: '7-8',
    choices: {
      presentation: 'child',
      skin_tone: 'deep-brown',
      hair_color: 'black',
      hair_texture: 'coily',
      hair_style: 'two-puffs',
      fringe: 'none',
      eye_color: 'dark-brown',
      eye_shape: 'almond',
      glasses: 'rectangular',
      detail: 'gap-tooth',
      signature_color: 'mustard',
      companion: 'turtle',
    },
  },
];

async function main() {
  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/spike-a`;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
  fs.mkdirSync(OUT, { recursive: true });

  // Merge rather than overwrite: the provider 503s under load, so a rerun is
  // usually finishing one case, not redoing all three.
  const metricsFile = path.join(OUT, 'metrics.json');
  const log: any[] = fs.existsSync(metricsFile)
    ? JSON.parse(fs.readFileSync(metricsFile, 'utf8'))
    : [];

  for (const c of CASES) {
    if (fs.existsSync(path.join(OUT, `${c.slug}.png`))) {
      console.log(`\n===== ${c.slug} — already rendered, skipping =====`);
      continue;
    }
    const picked = validateChoices(c.choices);
    const descriptor = buildIdentityDescriptor(c.name, c.age_band, picked);
    const wardrobe = buildWardrobeDefault(picked);
    const companion = buildCompanionDescriptor(picked);
    const prompt = buildSheetPrompt(descriptor, wardrobe, companion, HOUSE_STYLE);

    console.log(`\n===== ${c.slug} =====`);
    console.log('IDENTITY :', descriptor);
    console.log('WARDROBE :', wardrobe);

    const started = Date.now();
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'generate',
        model: 'gemini-2.5-flash-image',
        prompt,
        aspect_ratio: '4:3',
        image_size: '2K',
      }),
    });
    const latency = Date.now() - started;
    const body: any = await res.json();

    if (!res.ok || !body.image_base64) {
      console.log('FAILED', res.status, JSON.stringify(body).slice(0, 400));
      log.push({ slug: c.slug, ok: false, status: res.status, latency_ms: latency });
      continue;
    }

    const file = path.join(OUT, `${c.slug}.png`);
    fs.writeFileSync(file, Buffer.from(body.image_base64, 'base64'));
    const bytes = fs.statSync(file).size;
    console.log(`OK ${latency}ms  ${(bytes / 1024).toFixed(0)}KB  -> ${file}`);
    log.push({
      slug: c.slug,
      ok: true,
      latency_ms: latency,
      bytes,
      descriptor,
      wardrobe_default: wardrobe,
      companion,
    });
  }

  fs.writeFileSync(metricsFile, `${JSON.stringify(log, null, 2)}\n`);
}

main();
