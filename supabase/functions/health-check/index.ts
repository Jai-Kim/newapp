// Storyloom — health-check Edge Function
//
// Spike 0's done-condition: prove the server layer can reach Supabase, Claude,
// and the image provider using SERVER-SIDE keys only. Nothing here touches the
// client bundle (ARCHITECTURE §5).
//
// Deploy: supabase functions deploy health-check
// Secrets: supabase secrets set --env-file .env
// Call:    supabase functions invoke health-check

import Anthropic from "npm:@anthropic-ai/sdk@0.70.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface ProviderCheck {
  ok: boolean;
  detail: string;
  latency_ms?: number;
}

interface HealthCheckResponse {
  ok: boolean;
  checks: {
    supabase: ProviderCheck;
    anthropic: ProviderCheck;
    image: ProviderCheck;
  };
}

/** Times a check and turns a throw into a failed (not crashed) result. */
async function timed(
  name: string,
  fn: () => Promise<string>,
): Promise<ProviderCheck> {
  const started = Date.now();
  try {
    const detail = await fn();
    return { ok: true, detail, latency_ms: Date.now() - started };
  } catch (err) {
    return {
      ok: false,
      detail: `${name} failed: ${err instanceof Error ? err.message : String(err)}`,
      latency_ms: Date.now() - started,
    };
  }
}

/** Can we reach Postgres and see the Story Bible schema? */
function checkSupabase(): Promise<ProviderCheck> {
  return timed("supabase", async () => {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) {
      throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
    }

    const supabase = createClient(url, serviceKey);
    // head+count touches the table without pulling rows. Proves schema.sql ran.
    const { error, count } = await supabase
      .from("chapters")
      .select("id", { count: "exact", head: true });

    if (error) {
      throw new Error(error.message);
    }
    return `reached Postgres; chapters table exists (${count ?? 0} rows)`;
  });
}

/** Can we reach the Anthropic API with a server-side key? */
function checkAnthropic(): Promise<ProviderCheck> {
  return timed("anthropic", async () => {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY not set");
    }

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 64,
      // A ping wants a one-word answer, so thinking is off and max_tokens is
      // small. On Opus 5 thinking is ON by default and shares the max_tokens
      // budget with the reply — leaving it on here would truncate the answer.
      // Disabling is only legal at effort `high` or below, which is the default.
      thinking: { type: "disabled" },
      messages: [{ role: "user", content: "Reply with the single word: OK" }],
    });

    if (response.stop_reason === "refusal") {
      throw new Error("request was declined by safety classifiers");
    }

    const text = response.content.find((block) => block.type === "text");
    return `${response.model} replied "${text?.type === "text" ? text.text.trim() : ""}"`;
  });
}

/**
 * Can we reach the illustration provider? Spike A decides which one wins, so
 * IMAGE_PROVIDER selects the path. Both checks are cheap metadata reads — no
 * image is generated and nothing is billed.
 */
function checkImageProvider(): Promise<ProviderCheck> {
  return timed("image", async () => {
    const provider = Deno.env.get("IMAGE_PROVIDER");

    if (provider === "gemini") {
      const key = Deno.env.get("GEMINI_API_KEY");
      if (!key) {
        throw new Error("GEMINI_API_KEY not set");
      }
      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models",
        { headers: { "x-goog-api-key": key } },
      );
      if (!res.ok) {
        throw new Error(`Gemini returned ${res.status} ${res.statusText}`);
      }
      const body = (await res.json()) as { models?: unknown[] };
      return `Gemini reachable; ${body.models?.length ?? 0} models visible`;
    }

    if (provider === "replicate") {
      const token = Deno.env.get("REPLICATE_API_TOKEN");
      if (!token) {
        throw new Error("REPLICATE_API_TOKEN not set");
      }
      const res = await fetch("https://api.replicate.com/v1/account", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(`Replicate returned ${res.status} ${res.statusText}`);
      }
      const body = (await res.json()) as { username?: string };
      return `Replicate reachable as "${body.username ?? "unknown"}"`;
    }

    throw new Error(
      `IMAGE_PROVIDER must be "gemini" or "replicate" (got ${provider ?? "unset"})`,
    );
  });
}

Deno.serve(async () => {
  const [supabase, anthropic, image] = await Promise.all([
    checkSupabase(),
    checkAnthropic(),
    checkImageProvider(),
  ]);

  const checks = { supabase, anthropic, image };
  const ok = supabase.ok && anthropic.ok && image.ok;

  // 503 when a provider is down so `supabase functions invoke` fails loudly.
  return Response.json({ ok, checks } satisfies HealthCheckResponse, {
    status: ok ? 200 : 503,
  });
});
