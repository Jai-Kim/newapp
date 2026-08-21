import type { CharacterChoices } from '@/lib/supabase/types';

/**
 * What the parent sees in the look picker.
 *
 * Labels only. The prompt fragment each value maps to lives server-side in
 * `supabase/functions/_shared/character.ts` — deliberately, because the wording
 * is the part Spike A proved is load-bearing, and a client that could send its
 * own descriptor text would be a free-text image prompt wearing a costume.
 *
 * The values here must therefore match that file exactly. `options.test.ts`
 * reads it and fails if they drift, which is the only thing holding the two
 * halves together.
 */

export type CharacterField = {
  key: keyof CharacterChoices;
  label: string;
  hint?: string;
  options: { value: string; label: string }[];
  /**
   * Fields that start on a value because "none" is a real answer. Everything
   * else starts UNSET on purpose: a preselected skin tone and hair colour would
   * be this app quietly proposing a default child, and the parent would have to
   * notice in order to disagree.
   */
  defaultValue?: string;
};

export const CHARACTER_FIELDS: CharacterField[] = [
  {
    key: 'presentation',
    label: 'How should we draw them?',
    options: [
      { value: 'girl', label: 'A girl' },
      { value: 'boy', label: 'A boy' },
      { value: 'child', label: 'Just a child' },
    ],
  },
  {
    key: 'skin_tone',
    label: 'Skin',
    options: [
      { value: 'porcelain', label: 'Porcelain' },
      { value: 'fair', label: 'Fair' },
      { value: 'light-golden', label: 'Light golden' },
      { value: 'olive', label: 'Olive' },
      { value: 'tan', label: 'Tan' },
      { value: 'golden-brown', label: 'Golden brown' },
      { value: 'deep-brown', label: 'Deep brown' },
      { value: 'rich-dark', label: 'Rich dark brown' },
    ],
  },
  {
    key: 'hair_color',
    label: 'Hair colour',
    options: [
      { value: 'black', label: 'Black' },
      { value: 'dark-brown', label: 'Dark brown' },
      { value: 'light-brown', label: 'Light brown' },
      { value: 'auburn', label: 'Auburn' },
      { value: 'red', label: 'Red' },
      { value: 'blonde', label: 'Blonde' },
      { value: 'platinum', label: 'Very light blonde' },
    ],
  },
  {
    key: 'hair_texture',
    label: 'Hair texture',
    options: [
      { value: 'straight', label: 'Straight' },
      { value: 'wavy', label: 'Wavy' },
      { value: 'curly', label: 'Curly' },
      { value: 'coily', label: 'Coily' },
    ],
  },
  {
    key: 'hair_style',
    label: 'Hair style',
    options: [
      { value: 'short-crop', label: 'Short crop' },
      { value: 'bob', label: 'Bob' },
      { value: 'shoulder-length', label: 'To the shoulders' },
      { value: 'long-loose', label: 'Long and loose' },
      { value: 'ponytail', label: 'Ponytail' },
      { value: 'two-pigtails', label: 'Two pigtails' },
      { value: 'two-puffs', label: 'Two puffs' },
      { value: 'braids', label: 'Braids' },
      { value: 'top-bun', label: 'Bun' },
    ],
  },
  {
    key: 'fringe',
    defaultValue: 'none',
    label: 'Fringe',
    options: [
      { value: 'none', label: 'No fringe' },
      { value: 'blunt', label: 'Blunt' },
      { value: 'side-swept', label: 'Side-swept' },
      { value: 'wispy', label: 'Wispy' },
    ],
  },
  {
    key: 'eye_shape',
    label: 'Eyes',
    options: [
      { value: 'round', label: 'Large and round' },
      { value: 'almond', label: 'Almond-shaped' },
      { value: 'monolid', label: 'Almond, with monolids' },
      { value: 'upturned', label: 'Upturned' },
    ],
  },
  {
    key: 'eye_color',
    label: 'Eye colour',
    options: [
      { value: 'dark-brown', label: 'Dark brown' },
      { value: 'brown', label: 'Brown' },
      { value: 'hazel', label: 'Hazel' },
      { value: 'green', label: 'Green' },
      { value: 'blue', label: 'Blue' },
      { value: 'grey', label: 'Grey-blue' },
    ],
  },
  {
    key: 'glasses',
    defaultValue: 'none',
    label: 'Glasses',
    hint: 'Glasses are part of who they are, so they stay on in every picture.',
    options: [
      { value: 'none', label: 'None' },
      { value: 'round', label: 'Round' },
      { value: 'oval', label: 'Oval' },
      { value: 'rectangular', label: 'Rectangular' },
    ],
  },
  {
    key: 'detail',
    defaultValue: 'none',
    label: 'One thing that is unmistakably them',
    hint: 'Small details are the first thing a drawing loses. Picking one gives '
      + 'you something to check at a glance.',
    options: [
      { value: 'none', label: 'Nothing in particular' },
      { value: 'freckles', label: 'Freckles' },
      { value: 'dimples', label: 'Dimples' },
      { value: 'mole-left', label: 'A mole under the left eye' },
      { value: 'gap-tooth', label: 'A gap in their front teeth' },
      { value: 'round-cheeks', label: 'Very round cheeks' },
    ],
  },
  {
    key: 'signature_color',
    label: 'Their colour',
    hint: 'Turns up again and again in what they wear.',
    options: [
      { value: 'terracotta', label: 'Terracotta' },
      { value: 'mustard', label: 'Mustard' },
      { value: 'sage', label: 'Sage green' },
      { value: 'dusty-teal', label: 'Dusty teal' },
      { value: 'coral', label: 'Coral' },
      { value: 'cream', label: 'Cream' },
      { value: 'plum', label: 'Plum' },
    ],
  },
  {
    key: 'companion',
    defaultValue: 'none',
    label: 'A companion?',
    hint: 'A small animal who turns up in every story. Choose now if you want '
      + 'one — adding it later means re-drawing the character sheet.',
    options: [
      { value: 'none', label: 'No companion' },
      { value: 'owl', label: 'An owl' },
      { value: 'magpie', label: 'A magpie' },
      { value: 'rabbit', label: 'A rabbit' },
      { value: 'cat', label: 'A cat' },
      { value: 'fox', label: 'A fox cub' },
      { value: 'turtle', label: 'A turtle' },
    ],
  },
];

/** The starting state: the optional fields answered "none", the rest blank. */
export const INITIAL_CHOICES: Partial<CharacterChoices> = CHARACTER_FIELDS.reduce(
  (acc, field) =>
    field.defaultValue === undefined
      ? acc
      : { ...acc, [field.key]: field.defaultValue },
  {} as Partial<CharacterChoices>,
);

/** True once every field the sheet needs has an answer. */
export function isComplete(
  choices: Partial<CharacterChoices>,
): choices is CharacterChoices {
  return CHARACTER_FIELDS.every(f => choices[f.key] !== undefined);
}

/** The fields still waiting on the parent, in the order they appear. */
export function missingFields(
  choices: Partial<CharacterChoices>,
): CharacterField[] {
  return CHARACTER_FIELDS.filter(f => choices[f.key] === undefined);
}
