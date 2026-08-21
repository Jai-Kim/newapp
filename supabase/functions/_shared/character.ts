// Storyloom — the child's locked character identity.
//
// A parent cannot write a good character prompt. Spike A showed the difference
// between a sheet that holds and one that drifts is entirely in wording that no
// one would think to type: naming the identity anchors explicitly, refusing the
// anime default, and repeating the same sentence verbatim on every render. So
// the parent picks from structured options and this file writes the prompt.
//
// Two strings come out of a set of choices, and the split between them is the
// whole point (ADR-0001 §5):
//
//   identity descriptor — face, hair, eyes, glasses. Pasted VERBATIM into every
//                         page prompt for the life of the book. Never changes.
//   wardrobe default    — clothing. Overridden per page, because a scene needs
//                         pyjamas or a swimsuit without the face moving.
//
// The descriptor is composed ONCE and stored on the child. Later edits to the
// fragments below must not retroactively change a book already being drawn, so
// nothing downstream recomposes it — it is read back out of `character_ref`.

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

// The same model the pages use, deliberately. Spike A rated Flash *closer* to
// the gouache house style than Pro, and a reference drawn by a different model
// than the pages would anchor them to a style they can't reproduce. Matching the
// models matters more here than one-shot quality — and at $0.04 a sheet, a
// parent can press "try another" as often as they like.
const MODEL = "gemini-2.5-flash-image";

export type Presentation = "girl" | "boy" | "child";

export interface CharacterChoices {
  presentation: Presentation;
  skin_tone: string;
  hair_color: string;
  hair_texture: string;
  hair_style: string;
  fringe: string;
  eye_color: string;
  eye_shape: string;
  glasses: string;
  detail: string;
  signature_color: string;
  companion: string;
}

interface Pronouns {
  noun: string;
  subject: string;
  possessive: string;
  /** Verb forms, so the neutral option conjugates instead of reading "they has". */
  has: string;
  wears: string;
  looks: string;
}

const PRESENTATION: Record<Presentation, Pronouns> = {
  girl: {
    noun: "girl",
    subject: "she",
    possessive: "her",
    has: "has",
    wears: "wears",
    looks: "looks",
  },
  boy: {
    noun: "boy",
    subject: "he",
    possessive: "his",
    has: "has",
    wears: "wears",
    looks: "looks",
  },
  // The neutral option. It has to read as natural English in a prompt, not as a
  // placeholder, or the model treats it as a description it cannot draw.
  child: {
    noun: "child",
    subject: "they",
    possessive: "their",
    has: "have",
    wears: "wear",
    looks: "look",
  },
};

// ---------------------------------------------------------------------------
// The option catalogue.
//
// Every value maps to a fragment written the way Spike A's working prompts were
// written: concrete, physical, and specific enough that a reviewer can check it
// against the picture. Vague fragments ("nice hair") are what produce drift.
//
// These are physical descriptions, deliberately not ethnic categories — a
// parent picks what they can see. But the descriptions have to be able to
// express a real Korean child specifically (ADR-0001's first user), because
// Spike A's step 4 found that under-describing East Asian features makes the
// model fall back on a generic pan-"Asian" cartoon face.
// ---------------------------------------------------------------------------

const SKIN_TONE: Record<string, string> = {
  "porcelain": "very fair porcelain skin with cool undertones",
  "fair": "fair skin with warm peach undertones",
  "light-golden": "light golden skin",
  "olive": "warm olive skin",
  "tan": "warm tan skin",
  "golden-brown": "golden brown skin",
  "deep-brown": "deep brown skin",
  "rich-dark": "rich dark brown skin",
};

const HAIR_COLOR: Record<string, string> = {
  "black": "black",
  "dark-brown": "dark brown",
  "light-brown": "light brown",
  "auburn": "warm auburn",
  "red": "coppery red",
  "blonde": "golden blonde",
  "platinum": "very pale blonde",
};

const HAIR_TEXTURE: Record<string, string> = {
  "straight": "straight",
  "wavy": "softly wavy",
  "curly": "springy curly",
  "coily": "tightly coiled",
};

const HAIR_STYLE: Record<string, string> = {
  "short-crop": "cut short and neat, close to the head",
  "bob": "cut in a chin-length bob",
  "shoulder-length": "worn loose to the shoulders",
  "long-loose": "worn long and loose down the back",
  "ponytail": "gathered into a high ponytail",
  "two-pigtails": "worn in two low pigtails",
  "two-puffs": "worn in two round puffs, one on each side",
  "braids": "worn in two neat braids",
  "top-bun": "gathered into a small bun on top of the head",
};

// A fringe changes the silhouette more than anything else on this list, which
// makes it one of the strongest things to hold constant across pages.
const FRINGE: Record<string, string> = {
  "none": "",
  "blunt": ", with a blunt fringe cut straight across above the eyebrows",
  "side-swept": ", with a side-swept fringe falling across one eyebrow",
  "wispy": ", with a soft wispy fringe",
};

const EYE_COLOR: Record<string, string> = {
  "dark-brown": "dark brown",
  "brown": "warm brown",
  "hazel": "hazel",
  "green": "green",
  "blue": "blue",
  "grey": "grey-blue",
};

// Written as post-modifiers ("eyes are dark brown, almond-shaped") rather than
// adjectives, because "almond-shaped, with gentle monolids" cannot sit in front
// of a colour without producing word salad.
const EYE_SHAPE: Record<string, string> = {
  "round": "large and round",
  "almond": "almond-shaped",
  "monolid": "almond-shaped with gentle monolids",
  "upturned": "upturned, crinkling at the outer corners",
};

// Glasses are identity, not wardrobe — they stay on in the bath scene. The
// frame picks up the signature colour so the two choices agree.
const GLASSES: Record<string, string> = {
  "none": "",
  // "glasses with sage green rims", not "sage green-rimmed glasses" — the
  // signature colours are two words, and the hyphenated form reads as though
  // only the second word describes the rim.
  "round": "round glasses with {color} rims",
  "oval": "oval glasses with {color} rims",
  "rectangular": "small rectangular glasses with {color} rims",
};

// One fine detail, and the reason to offer it is not decoration: Spike A found
// small features are the FIRST thing a model drops when it drifts. A mole the
// parent chose is a drift alarm they can check in two seconds.
const DETAIL: Record<string, string> = {
  "none": "",
  "freckles": "a light scatter of freckles across the nose and cheeks",
  "dimples": "deep dimples that show when smiling",
  "mole-left": "a tiny dark mole just below the LEFT eye",
  "gap-tooth": "a gap between the two front teeth, visible when smiling",
  "round-cheeks": "very round full cheeks",
};

// Constrained to the house palette (cream, terracotta, sage, dusty teal and
// close neighbours). A colour from outside it would fight the gouache style on
// every single page.
const SIGNATURE_COLOR: Record<string, string> = {
  "terracotta": "terracotta",
  "mustard": "mustard yellow",
  "sage": "sage green",
  "dusty-teal": "dusty teal",
  "coral": "soft coral",
  "cream": "warm cream",
  "plum": "muted plum",
};

// Optional, and offered now rather than later on purpose: adding a companion
// after the sheet is locked would mean re-drawing the sheet, and every chapter
// already illustrated from the old one would no longer match.
const COMPANION: Record<string, string> = {
  "none": "",
  "owl": "a small round owl, about the size of a teapot, with a fluffy body, "
    + "large amber eyes and a tiny hooked beak",
  "magpie": "a small round magpie, about the size of a teapot, with a glossy "
    + "black head and back, a crisp white belly and blue-sheen tail feathers",
  "rabbit": "a small round rabbit, about the size of a teapot, with soft "
    + "grey-brown fur, long ears and dark gentle eyes",
  "cat": "a small round cat, about the size of a teapot, with soft ginger fur, "
    + "white paws and wide green eyes",
  "fox": "a small round fox cub, about the size of a teapot, with russet fur, "
    + "a white-tipped brushy tail and bright dark eyes",
  "turtle": "a small round turtle, about the size of a teapot, with a "
    + "sage-green patterned shell and a slow friendly face",
};

const CATALOGUE: Record<keyof Omit<CharacterChoices, "presentation">, Record<string, string>> = {
  skin_tone: SKIN_TONE,
  hair_color: HAIR_COLOR,
  hair_texture: HAIR_TEXTURE,
  hair_style: HAIR_STYLE,
  fringe: FRINGE,
  eye_color: EYE_COLOR,
  eye_shape: EYE_SHAPE,
  glasses: GLASSES,
  detail: DETAIL,
  signature_color: SIGNATURE_COLOR,
  companion: COMPANION,
};

/** Every legal value, so the app and a test can check itself against this file. */
export function optionValues(): Record<string, string[]> {
  const out: Record<string, string[]> = {
    presentation: Object.keys(PRESENTATION),
  };
  for (const [field, table] of Object.entries(CATALOGUE)) {
    out[field] = Object.keys(table);
  }
  return out;
}

/**
 * Rejects anything not in the catalogue.
 *
 * The picker only emits legal values, but this function is reachable by anyone
 * with a session — and an unvalidated field would be free-text injected straight
 * into an image prompt, which is exactly what the picker exists to prevent.
 */
export function validateChoices(input: unknown): CharacterChoices {
  if (typeof input !== "object" || input === null) {
    throw new Error("choices must be an object");
  }
  const raw = input as Record<string, unknown>;

  const presentation = raw.presentation;
  if (typeof presentation !== "string" || !(presentation in PRESENTATION)) {
    throw new Error(`presentation must be one of: ${Object.keys(PRESENTATION).join(", ")}`);
  }

  const out = { presentation } as CharacterChoices;
  for (const [field, table] of Object.entries(CATALOGUE)) {
    const value = raw[field];
    if (typeof value !== "string" || !(value in table)) {
      throw new Error(
        `${field} must be one of: ${Object.keys(table).join(", ")}`,
      );
    }
    (out as unknown as Record<string, string>)[field] = value;
  }
  return out;
}

/** Middle of the age band — "a 5-year-old" reads better than "a 5-6-year-old". */
function ageOf(ageBand: string): number {
  const [lo, hi] = ageBand.split("-").map(Number);
  return Number.isFinite(lo) && Number.isFinite(hi) ? Math.round((lo + hi) / 2) : 5;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "an 8-year-old", not "a 8-year-old". Only 8 and 11 need it in this range. */
function article(n: number): string {
  return n === 8 || n === 11 || n === 18 ? "an" : "a";
}

/**
 * The locked identity sentence. This exact text is pasted into every page
 * prompt, forever — which is why it lists only things that must never change.
 * No clothing appears here.
 */
export function buildIdentityDescriptor(
  name: string,
  ageBand: string,
  c: CharacterChoices,
): string {
  const p = PRESENTATION[c.presentation];
  const colour = SIGNATURE_COLOR[c.signature_color];
  const age = ageOf(ageBand);

  // One short sentence per feature. An earlier draft packed skin, hair, eyes,
  // glasses and the distinguishing detail into two long sentences, and the
  // fragments collided into things like "almond-shaped, with gentle monolids
  // dark brown eyes" — which the image model then drew as best it could.
  const sentences = [
    `${name} is ${article(age)} ${age}-year-old ${p.noun}.`,
    `${capitalise(p.subject)} ${p.has} ${SKIN_TONE[c.skin_tone]}.`,
    `${capitalise(p.possessive)} hair is ${HAIR_TEXTURE[c.hair_texture]} and `
    + `${HAIR_COLOR[c.hair_color]}, ${HAIR_STYLE[c.hair_style]}`
    + `${FRINGE[c.fringe]}.`,
    `${capitalise(p.possessive)} eyes are ${EYE_COLOR[c.eye_color]}, `
    + `${EYE_SHAPE[c.eye_shape]}.`,
  ];

  const glasses = GLASSES[c.glasses].replace("{color}", colour);
  if (glasses) {
    sentences.push(`${capitalise(p.subject)} ${p.wears} ${glasses}.`);
  }
  if (DETAIL[c.detail]) {
    sentences.push(`${capitalise(p.subject)} ${p.has} ${DETAIL[c.detail]}.`);
  }

  // Spike A step 4: without this the model reaches for a generic cartoon face,
  // and for an East Asian child it reaches for anime specifically.
  sentences.push(
    `${capitalise(p.subject)} ${p.looks} like a real child, drawn with specific, `
    + `individual features — never a generic cartoon and never in an anime or `
    + `manga style.`,
  );

  return sentences.join(" ");
}

/**
 * Everyday clothes. Separate from identity so a page can put the child in
 * pyjamas without the face moving — the failure Spike A actually hit.
 */
export function buildWardrobeDefault(c: CharacterChoices): string {
  const colour = SIGNATURE_COLOR[c.signature_color];
  return `simple, comfortable everyday clothes with ${colour} as the recurring `
    + `accent — for example a ${colour} cardigan, jumper or boots.`;
}

/** The companion fragment, or an empty string when the parent chose none. */
export function buildCompanionDescriptor(c: CharacterChoices): string {
  const base = COMPANION[c.companion];
  if (!base) {
    return "";
  }
  const colour = SIGNATURE_COLOR[c.signature_color];
  return `${capitalise(base)}, wearing a small knitted ${colour} scarf.`;
}

/**
 * The model-sheet prompt: three views of the same child plus a close-up, on a
 * blank ground. Three views rather than one portrait because the pages need
 * three-quarter and full-body angles, and a model asked for those from a single
 * front portrait invents them differently every time.
 */
export function buildSheetPrompt(
  identityDescriptor: string,
  wardrobeDefault: string,
  companionDescriptor: string,
  houseStyle: string,
): string {
  const companionBlock = companionDescriptor
    ? `\nThen, at the lower right, one full-body view of the child's animal `
      + `companion:\n${companionDescriptor}\n`
    : "\n";

  return `Draw a CHARACTER MODEL SHEET for a children's picture book, on a plain
neutral cream background with no scenery and no props.

Layout: three views of the SAME child across the sheet —
  (1) full-body front view, standing, neutral expression, arms at their sides
  (2) full-body three-quarter view, turned slightly to one side
  (3) head-and-shoulders close-up, smiling warmly
${companionBlock}
THE CHILD:
${identityDescriptor}

CLOTHING for this sheet only: ${wardrobeDefault}
The clothing is not part of the character's identity and will change from page
to page. The face, hair and glasses will not.

Every view must be unmistakably the same child: identical face shape, identical
hair, identical skin tone, and every distinguishing detail above present in all
three views including the close-up. This sheet is the definitive reference and
every later illustration will be drawn from it.

NO LETTERING. Do not label the views, and do not draw any words, titles,
captions or handwriting anywhere on the sheet. Figures only.

Art style: ${houseStyle}`;
}

export interface SheetResult {
  image_base64: string;
  mime_type: string;
  latency_ms: number;
  model: string;
}

/** Text-to-image, no reference — this IS the reference everything else uses. */
export async function generateSheet(
  apiKey: string,
  prompt: string,
): Promise<SheetResult> {
  const started = Date.now();

  const res = await fetch(`${GEMINI_BASE}/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        // 4:3 matches the page renders, and 2K because every future
        // illustration is conditioned on this image — detail lost here is
        // detail no page can recover.
        imageConfig: { aspectRatio: "4:3", imageSize: "2K" },
      },
    }),
  });

  const latency_ms = Date.now() - started;
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`sheet generation failed (${res.status}): ${raw.slice(0, 400)}`);
  }

  const body = JSON.parse(raw) as {
    candidates?: {
      content?: { parts?: { inlineData?: { mimeType: string; data: string } }[] };
      finishReason?: string;
    }[];
  };
  const part = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part?.inlineData) {
    throw new Error(
      `no image returned (finish=${body.candidates?.[0]?.finishReason})`,
    );
  }

  return {
    image_base64: part.inlineData.data,
    mime_type: part.inlineData.mimeType,
    latency_ms,
    model: MODEL,
  };
}
