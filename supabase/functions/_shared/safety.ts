// Storyloom — content filter (Spike D).
//
// Runs AFTER generation and BEFORE anything is offered to a parent for review.
// Deliberately a separate model call rather than trusting the storyteller to
// self-assess: the writer is optimising for a warm story and is the wrong judge
// of whether it landed safely.
//
// It reads BOTH languages. A filter that only checked English would be blind to
// half of every book — and the Korean is the half the child's grandparents will
// read aloud.

import Anthropic from "npm:@anthropic-ai/sdk@0.70.0";

export interface SafetyConcern {
  page: number;
  language: "en" | "ko" | "both";
  issue: string;
  severity: "note" | "concern" | "blocking";
}

export interface SafetyVerdict {
  /** safe = may be offered to the parent. blocked = never shown, regenerate. */
  verdict: "safe" | "blocked";
  concerns: SafetyConcern[];
  checked_languages: string[];
  model: string;
  latency_ms: number;
}

interface Page { page: number; en: string; ko: string }

const SYSTEM = `You are a child-safety reviewer for a bedtime story app. The
audience is a young child (age band given below) being read to at bedtime by a
parent or grandparent.

You will receive a chapter written in BOTH English and Korean, page by page.
Review BOTH languages independently — they were composed natively, not
translated, so one can contain something the other does not.

Block a chapter only for genuine, concrete problems:
  - frightening or threatening content likely to disturb a child at bedtime
    (peril, menace, gore, monsters presented as real threats, abandonment)
  - unsafe behaviour a child might copy (wandering off alone, hiding from
    parents, unsafe use of water/heat/height/medicine)
  - death, illness or loss handled bluntly, graphically, or without comfort
  - anything sexual, cruel, or discriminatory
  - content that would shame a child for a feeling (fear, anger, grief)

Do NOT block for:
  - sadness, worry or fear that is named gently and resolved with comfort — a
    bedtime story that helps a child through something HAS to name the thing
  - a medical visit, a death in the family, or a scary situation handled with
    honesty and warmth. These are the app's core purpose.
  - mild peril fully resolved within the chapter

Sensitivity handled well is the product working, not a failure. Reserve
"blocking" for content you would not want read to a five-year-old tonight.

Return ONLY the JSON object.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdict", "concerns"],
  properties: {
    verdict: { type: "string", enum: ["safe", "blocked"] },
    concerns: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["page", "language", "issue", "severity"],
        properties: {
          page: { type: "integer" },
          language: { type: "string", enum: ["en", "ko", "both"] },
          issue: { type: "string" },
          severity: { type: "string", enum: ["note", "concern", "blocking"] },
        },
      },
    },
  },
} as const;

const MODEL = "claude-opus-5";

export async function reviewChapter(
  apiKey: string,
  ageBand: string,
  titleEn: string,
  pages: Page[],
): Promise<SafetyVerdict> {
  const anthropic = new Anthropic({ apiKey });
  const started = Date.now();

  const body = pages
    .map((p) => `--- page ${p.page} ---\nEN: ${p.en}\nKO: ${p.ko}`)
    .join("\n\n");

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{
      role: "user",
      content: `Age band: ${ageBand}\nChapter title: ${titleEn}\n\n${body}`,
    }],
  });

  const latency_ms = Date.now() - started;

  // A refusal from the reviewer is itself a signal: fail closed.
  if (response.stop_reason === "refusal") {
    return {
      verdict: "blocked",
      concerns: [{
        page: 0,
        language: "both",
        issue: "safety reviewer declined to assess this chapter",
        severity: "blocking",
      }],
      checked_languages: ["en", "ko"],
      model: MODEL,
      latency_ms,
    };
  }

  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") {
    throw new Error("safety reviewer returned no text block");
  }

  const parsed = JSON.parse(text.text) as {
    verdict: "safe" | "blocked";
    concerns: SafetyConcern[];
  };

  // Belt and braces: any blocking concern forces a block even if the model
  // labelled the overall verdict safe.
  const hasBlocking = parsed.concerns.some((c) => c.severity === "blocking");

  return {
    verdict: hasBlocking ? "blocked" : parsed.verdict,
    concerns: parsed.concerns,
    checked_languages: ["en", "ko"],
    model: MODEL,
    latency_ms,
  };
}
