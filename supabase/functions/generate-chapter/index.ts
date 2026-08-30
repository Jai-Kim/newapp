// Storyloom — generate-chapter Edge Function.
//
// The on-demand path: a parent asking for a chapter right now. The work itself
// lives in `_shared/generate.ts`, because the queue worker runs exactly the
// same thing without a user session (issue #9).
//
// This path is the fallback, not the main road. It takes ~93s, which is too
// long to stand in front of at bedtime — the nightly flow pre-generates via
// `enqueue-chapter` instead, and this remains for the first chapter and for
// the night someone skipped choosing.
//
// Deploy: supabase functions deploy generate-chapter

import { createClient } from "jsr:@supabase/supabase-js@2";

import { assertOwnsChild, requireUser, statusFor } from "../_shared/auth.ts";
import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { CrisisDetectedError, screenParentInput } from "../_shared/crisis.ts";
import { generateChapterFor } from "../_shared/generate.ts";
import { QuotaExceededError, reserveGenerationSlot } from "../_shared/quota.ts";

interface GenerateRequest {
  child_id: string;
  lesson: string; // the value/situation the parent chose for tonight
  situation?: string; // optional free-text context
  /** Return the retrieved canon in the response. Spike B evidence; off by default. */
  debug_canon?: boolean;
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) {
    return preflight;
  }

  try {
    const { child_id, lesson, situation, debug_canon } =
      (await req.json()) as GenerateRequest;

    if (!child_id || !lesson) {
      return jsonResponse(
        { ok: false, error: "child_id and lesson are required" },
        { status: 400 },
      );
    }

    // This function spends money at a paid provider, so it never serves an
    // anonymous caller, and never a child that is not the caller's (issue #6).
    const user = await requireUser(req);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await assertOwnsChild(supabase, child_id, user.id);

    // Screen what the parent typed before anything below costs money
    // (issue #13). A crisis-shaped situation should never generate.
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      throw new Error("ANTHROPIC_API_KEY not set");
    }
    await screenParentInput(anthropicKey, { lesson, situation });

    // The spend guard (issue #6): a per-user rate limit and a per-child
    // month-to-date quota, reserved before anything below costs money.
    await reserveGenerationSlot(supabase, user.id, child_id);

    const result = await generateChapterFor(supabase, child_id, lesson, situation);

    return jsonResponse({
      ok: true,
      chapter_id: result.chapter_id,
      number: result.number,
      chapter: result.chapter,
      safety: result.safety,
      // Always pending (or rejected) at birth — the parent gate is the point.
      review_status: result.safety.verdict === "blocked" ? "rejected" : "pending",
      latency_ms: result.latency_ms,
      usage: result.usage,
      ...(debug_canon
        ? { retrieved_canon: result.canon, canon_prompt: result.canon_prompt }
        : {}),
    });
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return jsonResponse(err.toBody(), { status: err.status });
    }
    if (err instanceof CrisisDetectedError) {
      return jsonResponse(err.toBody(), { status: err.status });
    }
    return jsonResponse(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: statusFor(err) },
    );
  }
});
