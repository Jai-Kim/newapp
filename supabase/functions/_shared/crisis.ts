// Storyloom — crisis-input screening (issue #13).
//
// safety.ts reviews generated OUTPUT: it checks a finished chapter for
// content that shouldn't be shown to a child. It has no opinion about what a
// parent typed to get there. That is the gap this file closes — a parent
// typing "her uncle touches her and she's scared to sleep" would previously
// have gone straight into a warm bedtime story generated about it, because
// the output filter is looking for frightening content, not for a
// disclosure, and would very plausibly pass it as "sensitivity handled well".
//
// Runs BEFORE anything that costs money: before reserveGenerationSlot, before
// generation. A blocked request never queues a job and never consumes a
// month-to-date allowance slot.
//
// Deliberately a separate model call in the same style as reviewChapter, not
// keyword matching — keyword matching is far weaker in Korean (spacing,
// particles, honorifics all defeat a naive substring match) and this has to
// screen Korean and English with equal rigour.

import Anthropic from "npm:@anthropic-ai/sdk@0.70.0";

import {
  buildScreeningText,
  CrisisDetectedError,
  interpretCrisisVerdict,
  type RawCrisisVerdict,
} from "./crisis-response.ts";
import { FALLBACK_LESSONS } from "./lessons.ts";

/** Re-exported so callers only need one import path for both. */
export { CrisisDetectedError };

const SAFE_PRESET_LESSONS = new Set(FALLBACK_LESSONS);

// Opus, not a cheaper model, despite this being a 4-option classifier on the
// hot path every free-text request takes (issue #6 exists to bound that
// per-request cost). The false-negative side of this call is a disclosure of
// abuse, self-harm, or a child in acute danger going unnoticed — bilingual
// (EN+KO) nuance around acuteness ("a death last week" vs. "a grandparent
// who died a while ago", per SYSTEM above) is exactly where a weaker model is
// most likely to miss the real signal or, worse, silently drift toward never
// flagging. That risk is judged worth the cost here; revisit if the cost
// becomes a problem before the risk does.
const MODEL = "claude-opus-5";

const SYSTEM = `You are a first-line screener for a bedtime-story app for
young children. A parent has just typed what tomorrow's chapter should be
about, or a situation happening in the child's life. You do not write stories
and you do not give advice or a diagnosis — your only job is to notice a
small number of situations where writing a bedtime story is not the right
response, so the parent can be pointed to a human resource instead.

You will be shown the requested topic and/or the situation the parent typed,
which may be in English, Korean, or both.

Flag "crisis" ONLY for a clear, concrete signal of one of these:
  - abuse: a disclosure or strong suspicion of physical, sexual, or emotional
    abuse, or neglect, of the child (category: "abuse")
  - self_harm: the parent or the child having thoughts of suicide or of
    hurting themselves, now or recently (category: "self_harm")
  - acute_grief: a death in the immediate family that is fresh and raw —
    days or a couple of weeks ago, described as a crisis the family is
    currently in the middle of. This is NOT a story request that simply
    involves loss as a theme (category: "acute_grief")
  - acute_danger: violence happening in the home, or a child in danger right
    now (category: "acute_danger")

Do NOT flag — these are exactly what this app exists for, and a gentle story
is a good response to them, not a bad one:
  - a hospital visit, an illness, a scary medical procedure
  - a pet dying
  - a divorce or parents separating
  - starting a new school, moving house, a new sibling arriving
  - a child being scared, shy, anxious, or sad about something ordinary
  - a grandparent or family member who died a while ago, or grief being
    processed as a story theme rather than described as an unfolding crisis
  - anything vague, mild, or ambiguous

When genuinely unsure, do NOT flag. A story that gently helps a child through
something hard is this app working as intended, not a failure — a false
alarm costs a family their night's chapter and a moment of feeling judged for
something ordinary. Reserve "crisis" for a signal you would act on yourself.

Return ONLY the JSON object.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["signal", "category", "reasoning"],
  properties: {
    signal: { type: "string", enum: ["none", "crisis"] },
    category: {
      type: "string",
      enum: ["none", "abuse", "self_harm", "acute_grief", "acute_danger"],
    },
    reasoning: { type: "string" },
  },
} as const;

export interface ScreenInputFields {
  lesson?: string;
  situation?: string;
}

/**
 * Screens what a parent typed before it reaches generation.
 *
 * Resolves silently when there is nothing to worry about, or nothing worth
 * spending a model call on: the common "you choose for me" path with no
 * situation typed skips it entirely, and a `lesson` that exactly matches one
 * of the picker's own fixed presets (FALLBACK_LESSONS) is never screened,
 * because the picker never sends anything else — screening it on every
 * single ordinary request would be a real, needless cost. A `lesson` that
 * does NOT match a preset (only reachable by calling the API directly, not
 * through the app's picker) is free text and is screened like `situation`.
 * Throws CrisisDetectedError when the caller must stop: no chapter, no
 * provider spend, no quota consumed.
 */
export async function screenParentInput(
  apiKey: string,
  fields: ScreenInputFields,
): Promise<void> {
  const text = buildScreeningText(fields, SAFE_PRESET_LESSONS);
  if (text === null) {
    return;
  }

  const anthropic = new Anthropic({ apiKey });

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 500,
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: text }],
  });

  // A refusal from the screener is itself a signal: fail closed, same
  // convention as reviewChapter/reviewIllustration in safety.ts.
  if (response.stop_reason === "refusal") {
    const result = interpretCrisisVerdict(
      { signal: "crisis", category: "none", reasoning: "" },
      true,
    );
    throw new CrisisDetectedError(result.category);
  }

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("crisis screener returned no text block");
  }

  // A malformed body is not expected — output_config enforces the schema —
  // but a screener response we can't parse gets the same fail-closed
  // treatment as a refusal, not a generic 500.
  let raw: RawCrisisVerdict;
  try {
    raw = JSON.parse(block.text) as RawCrisisVerdict;
  }
  catch {
    const result = interpretCrisisVerdict(
      { signal: "crisis", category: "none", reasoning: "" },
      true,
    );
    throw new CrisisDetectedError(result.category);
  }

  const result = interpretCrisisVerdict(raw, false);
  if (result.blocked) {
    throw new CrisisDetectedError(result.category);
  }
}
