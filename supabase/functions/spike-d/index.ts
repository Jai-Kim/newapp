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
import { reviewChapter } from "../_shared/safety.ts";

interface Req {
  age_band?: string;
  title?: string;
  pages: { page: number; en: string; ko: string }[];
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) {
    return preflight;
  }

  try {
    const { age_band = "5-6", title = "(test fixture)", pages } =
      (await req.json()) as Req;

    if (!Array.isArray(pages) || pages.length === 0) {
      return jsonResponse({ ok: false, error: "pages[] required" }, { status: 400 });
    }

    const verdict = await reviewChapter(
      Deno.env.get("ANTHROPIC_API_KEY")!,
      age_band,
      title,
      pages,
    );

    return jsonResponse({ ok: true, safety: verdict });
  } catch (err) {
    return jsonResponse(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
});
