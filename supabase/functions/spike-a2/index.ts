// Storyloom — Spike A "path 2": open-weights illustration via Replicate.
//
// ADR-0002 makes this the primary margin lever: illustrations are ~70% of COGS,
// so halving image cost matters more than anything else available.
//
// Spike-only bridge, same shape as spike-a. Keeps REPLICATE_API_TOKEN
// server-side and gives the local harness a signed URL for the identity
// reference so Replicate can fetch it without the bucket being public.
//
// Deploy: supabase functions deploy spike-a2

import { createClient } from "jsr:@supabase/supabase-js@2";

import { handlePreflight, jsonResponse } from "../_shared/cors.ts";

const REPLICATE = "https://api.replicate.com/v1";

interface RunRequest {
  mode: "run";
  /** e.g. "zsxkib/flux-pulid" or "black-forest-labs/flux-dev" */
  model: string;
  /** Optional pinned version hash; omit to use the model's default version. */
  version?: string;
  input: Record<string, unknown>;
  /** Sign this storage path and inject it as `input[reference_field]`. */
  reference_path?: string;
  reference_field?: string;
}

interface WhoAmIRequest {
  mode: "whoami";
}

type Req = RunRequest | WhoAmIRequest;

function token(): string {
  const t = Deno.env.get("REPLICATE_API_TOKEN");
  if (!t) {
    throw new Error("REPLICATE_API_TOKEN not set as an Edge Function secret");
  }
  return t;
}

async function signReference(path: string): Promise<string> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const [bucket, ...rest] = path.split("/");
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(rest.join("/"), 3600);
  if (error || !data?.signedUrl) {
    throw new Error(`could not sign ${path}: ${error?.message}`);
  }
  return data.signedUrl;
}

/** Creates a prediction and polls to completion. */
async function run(req: RunRequest) {
  const input = { ...req.input };

  if (req.reference_path && req.reference_field) {
    input[req.reference_field] = await signReference(req.reference_path);
  }

  const url = req.version
    ? `${REPLICATE}/predictions`
    : `${REPLICATE}/models/${req.model}/predictions`;
  const body = req.version ? { version: req.version, input } : { input };

  const started = Date.now();
  const create = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token()}`,
      "Content-Type": "application/json",
      // Ask Replicate to hold the connection briefly so short jobs need no poll.
      "Prefer": "wait=60",
    },
    body: JSON.stringify(body),
  });

  const raw = await create.text();
  if (!create.ok) {
    throw new Error(`create failed (${create.status}): ${raw.slice(0, 600)}`);
  }

  let prediction = JSON.parse(raw) as {
    id: string;
    status: string;
    output?: unknown;
    error?: string;
    metrics?: { predict_time?: number };
    urls?: { get?: string };
  };

  // Poll if `Prefer: wait` returned before the job finished.
  const deadline = Date.now() + 10 * 60 * 1000;
  while (
    ["starting", "processing"].includes(prediction.status)
    && Date.now() < deadline
  ) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(
      prediction.urls?.get ?? `${REPLICATE}/predictions/${prediction.id}`,
      { headers: { Authorization: `Bearer ${token()}` } },
    );
    prediction = JSON.parse(await poll.text());
  }

  const latency_ms = Date.now() - started;

  if (prediction.status !== "succeeded") {
    throw new Error(
      `prediction ${prediction.status}: ${prediction.error ?? "no error given"}`,
    );
  }

  // Output is a URL or an array of URLs depending on the model.
  const out = prediction.output;
  const urls = Array.isArray(out) ? out : [out];
  const images: string[] = [];
  for (const u of urls) {
    if (typeof u !== "string") {
      continue;
    }
    const res = await fetch(u);
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < buf.length; i += CHUNK) {
      bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
    }
    images.push(btoa(bin));
  }

  return {
    prediction_id: prediction.id,
    latency_ms,
    predict_seconds: prediction.metrics?.predict_time ?? null,
    images_base64: images,
  };
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) {
    return preflight;
  }

  try {
    const body = (await req.json()) as Req;

    if (body.mode === "whoami") {
      const res = await fetch(`${REPLICATE}/account`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const raw = await res.text();
      if (!res.ok) {
        throw new Error(`account check failed (${res.status}): ${raw.slice(0, 300)}`);
      }
      return jsonResponse({ ok: true, account: JSON.parse(raw) });
    }

    if (body.mode === "run") {
      return jsonResponse({ ok: true, ...(await run(body)) });
    }

    return jsonResponse({ ok: false, error: "mode must be 'whoami' or 'run'" }, { status: 400 });
  } catch (err) {
    return jsonResponse(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
});
