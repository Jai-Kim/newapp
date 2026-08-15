// Storyloom — Spike A harness (character & style consistency)
//
// Thin server-side bridge to the Gemini image API so the provider key stays
// where it belongs (ARCHITECTURE §5). This exists to run the Week 1 spike and
// should be deleted — or folded into the real illustration step — once Spike A
// is decided. It is NOT part of the product surface.
//
// Modes:
//   {"mode":"list"}      → which image-capable models this key can see
//   {"mode":"generate"}  → generate one image, optionally conditioned on
//                          reference images for identity preservation
//
// Deploy: supabase functions deploy spike-a

import { handlePreflight, jsonResponse } from "../_shared/cors.ts";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

interface ReferenceImage {
  mime_type: string;
  data: string; // base64, no data: prefix
}

interface GenerateRequest {
  mode: "generate";
  model: string;
  prompt: string;
  /** Reference images sent before the prompt — the identity anchor. */
  references?: ReferenceImage[];
  aspect_ratio?: string;
  image_size?: string;
}

interface ListRequest {
  mode: "list";
}

type SpikeRequest = GenerateRequest | ListRequest;

function apiKey(): string {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) {
    throw new Error("GEMINI_API_KEY not set");
  }
  return key;
}

async function listModels() {
  const res = await fetch(`${GEMINI_BASE}/models?pageSize=200`, {
    headers: { "x-goog-api-key": apiKey() },
  });
  if (!res.ok) {
    throw new Error(`list failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as {
    models?: {
      name: string;
      supportedGenerationMethods?: string[];
      description?: string;
    }[];
  };

  // Surface only what can plausibly emit images, so the caller can pick.
  const all = body.models ?? [];
  const imageish = all
    .filter((m) => /image/i.test(m.name) || /image/i.test(m.description ?? ""))
    .map((m) => ({
      name: m.name.replace(/^models\//, ""),
      methods: m.supportedGenerationMethods ?? [],
    }));

  return { total: all.length, image_models: imageish };
}

async function generate(req: GenerateRequest) {
  const started = Date.now();

  // Reference images go FIRST, then the instruction. Gemini attends to the
  // images as context for the text that follows; leading with the prompt tends
  // to produce a fresh character rather than a re-render of the reference.
  const parts: unknown[] = [];
  for (const ref of req.references ?? []) {
    parts.push({ inline_data: { mime_type: ref.mime_type, data: ref.data } });
  }
  parts.push({ text: req.prompt });

  const generationConfig: Record<string, unknown> = {
    responseModalities: ["IMAGE"],
  };
  if (req.aspect_ratio || req.image_size) {
    generationConfig.imageConfig = {
      ...(req.aspect_ratio ? { aspectRatio: req.aspect_ratio } : {}),
      ...(req.image_size ? { imageSize: req.image_size } : {}),
    };
  }

  const res = await fetch(
    `${GEMINI_BASE}/models/${req.model}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig,
      }),
    },
  );

  const latency_ms = Date.now() - started;
  const raw = await res.text();

  if (!res.ok) {
    throw new Error(`generate failed (${res.status}) after ${latency_ms}ms: ${raw.slice(0, 800)}`);
  }

  const body = JSON.parse(raw) as {
    candidates?: {
      content?: { parts?: { inlineData?: { mimeType: string; data: string } }[] };
      finishReason?: string;
    }[];
    usageMetadata?: Record<string, number>;
    promptFeedback?: unknown;
  };

  const candidate = body.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find((p) => p.inlineData);

  if (!imagePart?.inlineData) {
    throw new Error(
      `no image in response (finishReason=${candidate?.finishReason ?? "none"}, `
      + `feedback=${JSON.stringify(body.promptFeedback ?? null)})`,
    );
  }

  return {
    latency_ms,
    mime_type: imagePart.inlineData.mimeType,
    image_base64: imagePart.inlineData.data,
    usage: body.usageMetadata ?? {},
    finish_reason: candidate?.finishReason ?? null,
  };
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) {
    return preflight;
  }

  try {
    const body = (await req.json()) as SpikeRequest;

    if (body.mode === "list") {
      return jsonResponse({ ok: true, ...(await listModels()) });
    }
    if (body.mode === "generate") {
      return jsonResponse({ ok: true, ...(await generate(body)) });
    }
    return jsonResponse({ ok: false, error: "mode must be 'list' or 'generate'" }, { status: 400 });
  } catch (err) {
    return jsonResponse(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
});
