// Storyloom — illustrate-chapter Edge Function.
//
// Deliberately SEPARATE from generate-chapter. Text takes ~93s and images take
// ~9s each; folding them into one request would push a single call past two
// minutes, make the whole chapter fail if one image did, and prevent the pages
// from being illustrated in parallel. Splitting also lets a parent read the
// text while art is still arriving.
//
// The work lives in `_shared/illustrate-run.ts` — the queue worker runs the
// same thing with no user session (issue #9). This is the on-demand shell:
// authorize, then call it.
//
// Deploy: supabase functions deploy illustrate-chapter

import { createClient } from "jsr:@supabase/supabase-js@2";

import { assertOwnsChild, requireUser, statusFor } from "../_shared/auth.ts";
import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { ChapterBlockedError, illustrateChapter } from "../_shared/illustrate-run.ts";

interface Req {
  chapter_id: string;
  /** Upper bound on illustrated pages. ADR-0002 settles on ~4. */
  illustrations?: number;
  /** Return image bytes in the response (spike harness). Off by default. */
  return_images?: boolean;
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) {
    return preflight;
  }

  try {
    const { chapter_id, illustrations = 4, return_images = false } =
      (await req.json()) as Req;
    if (!chapter_id) {
      return jsonResponse({ ok: false, error: "chapter_id required" }, { status: 400 });
    }

    // Images cost money too — same gate as generate-chapter (issue #6).
    const user = await requireUser(req);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: chapter, error: chErr } = await supabase
      .from("chapters").select("child_id").eq("id", chapter_id).single();
    if (chErr || !chapter) {
      return jsonResponse({ ok: false, error: "chapter not found" }, { status: 404 });
    }
    await assertOwnsChild(supabase, chapter.child_id as string, user.id);

    const result = await illustrateChapter(supabase, chapter_id, {
      illustrations,
      returnImages: return_images,
    });

    return jsonResponse({
      ok: result.ok,
      chapter_id,
      illustrated: result.illustrated,
      blocked: result.blocked,
      failed: result.failed,
      results: result.results,
      image_safety: result.image_safety,
      ...(return_images ? { images: result.images } : {}),
    }, { status: result.ok ? 200 : 207 });
  } catch (err) {
    if (err instanceof ChapterBlockedError) {
      return jsonResponse({ ok: false, error: err.message }, { status: 409 });
    }
    return jsonResponse(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: statusFor(err) },
    );
  }
});
