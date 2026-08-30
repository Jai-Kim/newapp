// Storyloom — turning a crisis-screener verdict into a response (issue #13).
//
// Deliberately split out of crisis.ts: crisis.ts imports the Anthropic SDK
// via a Deno `npm:` specifier, which Jest cannot resolve at all (the same
// reason safety.ts has no direct unit test). This file imports nothing but
// crisis-resources.ts, so it is fully unit-testable — everything worth
// testing about *what gets sent to the model* and *how a verdict is
// handled* (skipping a known-safe preset, fail-closed on refusal, the
// bilingual response shape, never implying we've contacted anyone) lives
// here, deterministically, rather than inside the untestable API call.
//
// What this file cannot test is whether the model's *judgment* is right for
// a given piece of Korean or English text — that needs a real call to a real
// model, which this sandbox has no network access or API key to make. See
// crisis-response.test.ts for the honest scope of what is and isn't covered.

import { CRISIS_RESOURCES, type CrisisResource } from "./crisis-resources.ts";

export type CrisisCategory = "abuse" | "self_harm" | "acute_grief" | "acute_danger";

/** The JSON shape the model returns, once parsed. */
export interface RawCrisisVerdict {
  signal: "none" | "crisis";
  category: CrisisCategory | "none";
  reasoning: string;
}

export interface CrisisScreenResult {
  blocked: boolean;
  category: CrisisCategory | null;
  reasoning: string;
}

/**
 * Builds what gets sent to the crisis screener from the raw request fields.
 *
 * `lesson` is only screened as free text when it does NOT match one of the
 * picker's own fixed presets — the app's picker only ever sends one of those
 * ten (src/features/nightly/lesson-picker.tsx, mirrored server-side as
 * FALLBACK_LESSONS in lessons.ts), so screening it on every single ordinary
 * request would be a real, needless model call on the common path. A
 * `lesson` that doesn't match a preset is only reachable by calling the API
 * directly, not through the app, and is screened like `situation` is.
 * Returns null when there is nothing worth a model call at all.
 */
export function buildScreeningText(
  fields: { lesson?: string; situation?: string },
  knownSafeLessons: ReadonlySet<string>,
): string | null {
  const lessonIsFreeText = fields.lesson !== undefined
    && !knownSafeLessons.has(fields.lesson);

  const text = [
    lessonIsFreeText ? `Requested topic: ${fields.lesson}` : null,
    fields.situation ? `Situation described: ${fields.situation}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return text.trim().length === 0 ? null : text;
}

/**
 * Turns a parsed model verdict (or a refusal) into a decision.
 *
 * A refusal is itself a signal, same as reviewChapter/reviewIllustration in
 * safety.ts: fail closed rather than silently generating from something the
 * model itself declined to look at. `category` is null in that case — we
 * don't know *why* it refused, only that it did.
 */
export function interpretCrisisVerdict(
  raw: RawCrisisVerdict,
  refused: boolean,
): CrisisScreenResult {
  if (refused) {
    return {
      blocked: true,
      category: null,
      reasoning: "crisis screener declined to assess this input",
    };
  }
  // Any "crisis" signal blocks, even if category came back "none" — a
  // model that flagged crisis but failed to categorise it is a malformed
  // response, not a reason to let it through.
  if (raw.signal === "crisis") {
    return {
      blocked: true,
      category: raw.category === "none" ? null : raw.category,
      reasoning: raw.reasoning,
    };
  }
  return { blocked: false, category: null, reasoning: raw.reasoning };
}

/**
 * Warm, bilingual, and deliberately the SAME message regardless of category —
 * a message that named "abuse" or "self-harm" back at a parent would read as
 * a diagnosis, which the app is not qualified to make. Acknowledges without
 * naming, says plainly this isn't the right tool, and never claims anyone has
 * been contacted or that anything is being kept confidential (issue #13).
 */
const CARE_COPY = {
  en: "Thank you for telling us. Storyloom writes bedtime stories — this isn't "
    + "the right place for what you've just described, so no chapter was "
    + "written. Please reach out to one of these instead:",
  ko: "말씀해 주셔서 감사해요. Storyloom은 잠자리 동화를 쓰는 곳이라, 지금 나눠주신 "
    + "내용에는 맞지 않아서 챕터를 만들지 않았어요. 대신 아래 연락처로 도움을 "
    + "요청해 주세요:",
};

/** Same standing as docs/privacy-policy.md — an honest draft, not legal advice. */
export const SENSITIVE_TOPIC_DISCLAIMER = {
  en: "Storyloom writes bedtime stories. It is not medical, psychological, or "
    + "therapeutic advice, and it is not a crisis service.",
  ko: "Storyloom은 잠자리 동화를 쓰는 서비스예요. 의료, 심리, 치료 상담이 아니며, "
    + "위기 상담 서비스도 아니에요.",
};

/**
 * Thrown by screenParentInput when the input describes something Storyloom
 * should not turn into a story. Mirrors QuotaExceededError's shape (quota.ts)
 * so the client-side handling is the same kind of thing: a machine-readable
 * `code`, warm bilingual copy the UI can render directly, never a bare error.
 */
export class CrisisDetectedError extends Error {
  readonly code = "crisis_detected";
  readonly category: CrisisCategory | null;
  readonly messageEn: string;
  readonly messageKo: string;
  readonly resources: CrisisResource[];
  /**
   * 422, not 429: this isn't rate limiting or a quota, it's "we understood
   * what you sent and have chosen not to act on it as a story request."
   */
  readonly status = 422;

  constructor(category: CrisisCategory | null) {
    super(CARE_COPY.en);
    this.name = "CrisisDetectedError";
    this.category = category;
    this.messageEn = CARE_COPY.en;
    this.messageKo = CARE_COPY.ko;
    this.resources = CRISIS_RESOURCES;
  }

  toBody(): Record<string, unknown> {
    return {
      ok: false,
      code: this.code,
      category: this.category,
      error: this.messageEn,
      message_en: this.messageEn,
      message_ko: this.messageKo,
      disclaimer_en: SENSITIVE_TOPIC_DISCLAIMER.en,
      disclaimer_ko: SENSITIVE_TOPIC_DISCLAIMER.ko,
      resources: this.resources,
    };
  }
}
