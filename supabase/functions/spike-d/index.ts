// Storyloom — Spike D harness: exercise the content filter in isolation.
//
// Spike-only, like spike-a. It exists to answer one question the happy path
// cannot: does the filter actually BLOCK anything? Three sensitive chapters all
// passing is only reassuring if the filter is capable of failing something.
//
// Takes pages directly, so an unsafe fixture can be tested without ever asking
// the storyteller to write unsafe content or persisting it as canon.
//
// Deploy: supabase functions deploy spike-d

import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { reviewChapter, reviewIllustration } from "../_shared/safety.ts";

interface Req {
  age_band?: string;
  title?: string;
  pages?: { page: number; en: string; ko: string }[];
  /** Image-mode fixture: review a single illustration instead of text. */
  image_base64?: string;
  scene?: string;
  mime_type?: string;
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) {
    return preflight;
  }

  try {
    const body = (await req.json()) as Req;
    const { age_band = "5-6", title = "(test fixture)" } = body;
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY")!;

    if (body.image_base64) {
      const verdict = await reviewIllustration(
        apiKey, age_band, 1, body.scene ?? "", body.image_base64,
        body.mime_type ?? "image/png",
      );
      return jsonResponse({ ok: true, image_safety: verdict });
    }

    if (!Array.isArray(body.pages) || body.pages.length === 0) {
      return jsonResponse(
        { ok: false, error: "pages[] or image_base64 required" },
        { status: 400 },
      );
    }

    const verdict = await reviewChapter(apiKey, age_band, title, body.pages);
    return jsonResponse({ ok: true, safety: verdict });
  } catch (err) {
    return jsonResponse(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
});
