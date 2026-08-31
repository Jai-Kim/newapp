import fs from 'node:fs';
import path from 'node:path';

import { CHARACTER_FIELDS, INITIAL_CHOICES, isComplete } from './options';

/**
 * The picker's option values live here; the prompt fragments they map to live
 * in the Edge Function's `_shared/character.ts`. Nothing at compile time
 * connects the two — a value renamed on one side would show up as a runtime
 * 400 the first time a parent picked it, and only for that one option.
 *
 * So this test reads the server file and checks the two agree. It parses text,
 * which is unlovely, but the alternative is shipping the prompt fragments to
 * the client, and those are exactly what must not be client-settable.
 */

const SERVER_FILE = path.join(
  __dirname,
  '../../../supabase/functions/_shared/character.ts',
);

/** Field key → the const holding its fragments on the server. */
const TABLE_FOR: Record<string, string> = {
  presentation: 'PRESENTATION',
  skin_tone: 'SKIN_TONE',
  hair_color: 'HAIR_COLOR',
  hair_texture: 'HAIR_TEXTURE',
  hair_style: 'HAIR_STYLE',
  fringe: 'FRINGE',
  eye_color: 'EYE_COLOR',
  eye_shape: 'EYE_SHAPE',
  glasses: 'GLASSES',
  detail: 'DETAIL',
  signature_color: 'SIGNATURE_COLOR',
  companion: 'COMPANION',
};

/**
 * Keys of a top-level object literal assigned to `const NAME`.
 *
 * Parses text, so it's only as good as `character.ts`'s literal formatting:
 * 2-space indented keys, and each table closed by a `};` on its own line.
 * Quote style is deliberately not part of that contract (bare, single- or
 * double-quoted keys all match) — a formatter is free to change it.
 */
function serverKeys(source: string, constName: string): string[] {
  const start = source.indexOf(`const ${constName}`);
  if (start === -1) {
    throw new Error(`${constName} not found in ${SERVER_FILE}`);
  }
  const open = source.indexOf('{', start);
  const end = source.indexOf('\n};', open);
  const body = source.slice(open, end);

  const keys = [...body.matchAll(/^ {2}['"]?([a-z][a-z-]*)['"]?:/gm)].map(m => m[1]);
  if (keys.length === 0) {
    throw new Error(
      `no keys parsed for ${constName} in ${SERVER_FILE} — did its formatting change?`,
    );
  }
  return keys;
}

describe('character options', () => {
  const source = fs.readFileSync(SERVER_FILE, 'utf8');

  it.each(CHARACTER_FIELDS.map(f => [f.key, f] as const))(
    '%s offers exactly what the server can describe',
    (key, field) => {
      const theirs = serverKeys(source, TABLE_FOR[key]).sort();
      const ours = field.options.map(o => o.value).sort();
      expect(ours).toEqual(theirs);
    },
  );

  it('covers every field the server validates', () => {
    // Catches the other direction: a field added server-side that the picker
    // never asks about would make every submission fail validation.
    const validated = [...source.matchAll(/^ {2}(\w+): [A-Z_]+,$/gm)].map(m => m[1]);
    const asked = CHARACTER_FIELDS.map(f => f.key as string);
    for (const field of validated) {
      expect(asked).toContain(field);
    }
    expect(validated.length).toBeGreaterThan(0);
  });

  it('starts with the look unset, so no default child is proposed', () => {
    expect(isComplete(INITIAL_CHOICES)).toBe(false);
    expect(INITIAL_CHOICES.skin_tone).toBeUndefined();
    expect(INITIAL_CHOICES.hair_color).toBeUndefined();
    expect(INITIAL_CHOICES.presentation).toBeUndefined();
    // The genuinely optional ones do start answered.
    expect(INITIAL_CHOICES.glasses).toBe('none');
    expect(INITIAL_CHOICES.companion).toBe('none');
  });

  it('is complete once every field is answered', () => {
    const filled = CHARACTER_FIELDS.reduce(
      (acc, f) => ({ ...acc, [f.key]: f.options[0].value }),
      {},
    );
    expect(isComplete(filled)).toBe(true);
  });
});
