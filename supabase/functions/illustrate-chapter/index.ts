// Storyloom — illustrate-chapter Edge Function.
//
// Deliberately SEPARATE from generate-chapter. Text takes ~71s and images take
// ~9s each; folding them into one request would push a single call past two
// minutes, make the whole chapter fail if one image did, and prevent the pages
// from being illustrated in parallel. Splitting also lets a parent read the text
// while art is still arriving.
//
// Reads the child's LOCKED identity reference from Storage, illustrates the
// chosen pages using each page's own wardrobe, writes the PNGs back to Storage,
// and records image_path on the page.
//
// Deploy: supabase functions deploy illustrate-chapter

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { choosePages, illustratePage } from "../_shared/illustrate.ts";

interface Req {
  chapter_id: string;
  /** How many pages get full art. Spike C's recommended shape is 3. */
  illustrations?: number;
  /** Return image bytes in the response (spike harness). Off by default. */
  return_images?: boolean;
}

interface Page {
  page: number;
  en: string;
  ko: string;
  scene: string;
  wardrobe: string;
  image_path?: string;
}

async function loadIdentity(supabase: SupabaseClient, childId: string) {
  const { data: child, error } = await supabase
    .from("children")
    .select("first_name,character_ref")
    .eq("id", childId)
    .single();

  if (error || !child) {
    throw new Error(`child not found: ${error?.message}`);
  }
  const ref = child.character_ref as
    | { identity?: { image_path?: string; descriptor?: string } }
    | null;
  const path = ref?.identity?.image_path;
  const descriptor = ref?.identity?.descriptor;
  if (!path || !descriptor) {
    throw new Error("child.character_ref.identity is missing image_path or descriptor");
  }

  const [bucket, ...rest] = path.split("/");
  const { data: blob, error: dlErr } = await supabase.storage
    .from(bucket)
    .download(rest.join("/"));
  if (dlErr || !blob) {
    throw new Error(`identity reference unreadable at ${path}: ${dlErr?.message}`);
  }

  return {
    png: new Uint8Array(await blob.arrayBuffer()),
    descriptor,
    name: child.first_name as string,
  };
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) {
    return preflight;
  }

  try {
    const { chapter_id, illustrations = 3, return_images = false } =
      (await req.json()) as Req;
    if (!chapter_id) {
      return jsonResponse({ ok: false, error: "chapter_id required" }, { status: 400 });
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not set");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: chapter, error: chErr } = await supabase
      .from("chapters")
      .select("id,child_id,number,pages,review_status,safety")
      .eq("id", chapter_id)
      .single();
    if (chErr || !chapter) {
      throw new Error(`chapter not found: ${chErr?.message}`);
    }

    // Never spend money illustrating something the filter rejected.
    if ((chapter.safety as { verdict?: string } | null)?.verdict === "blocked") {
      return jsonResponse(
        { ok: false, error: "chapter was blocked by the content filter; not illustrating" },
        { status: 409 },
      );
    }

    const identity = await loadIdentity(supabase, chapter.child_id as string);
    const pages = chapter.pages as Page[];
    const targets = choosePages(pages.length, illustrations);

    // Pages are independent, so illustrate them concurrently — this is the
    // difference between ~9s and ~27s for three pages.
    const settled = await Promise.allSettled(
      targets.map((n) => {
        const p = pages.find((x) => x.page === n)!;
        return illustratePage(
          apiKey, identity.png, identity.descriptor, p.page, p.scene, p.wardrobe,
        );
      }),
    );

    const results: { page: number; image_path?: string; latency_ms?: number; error?: string }[] = [];
    const images: { page: number; image_base64: string }[] = [];

    for (const [i, outcome] of settled.entries()) {
      const pageNo = targets[i];
      if (outcome.status === "rejected") {
        results.push({ page: pageNo, error: String(outcome.reason) });
        continue;
      }
      const r = outcome.value;
      const bytes = Uint8Array.from(atob(r.image_base64), (c) => c.charCodeAt(0));
      const objectPath = `${chapter.child_id}/ch${chapter.number}/p${pageNo}.png`;

      const { error: upErr } = await supabase.storage
        .from("illustrations")
        .upload(objectPath, bytes, { contentType: "image/png", upsert: true });
      if (upErr) {
        results.push({ page: pageNo, error: `upload failed: ${upErr.message}` });
        continue;
      }

      const stored = `illustrations/${objectPath}`;
      const target = pages.find((p) => p.page === pageNo);
      if (target) {
        target.image_path = stored;
      }
      results.push({ page: pageNo, image_path: stored, latency_ms: r.latency_ms });
      if (return_images) {
        images.push({ page: pageNo, image_base64: r.image_base64 });
      }
    }

    // Write image_path back onto the pages so the reader knows what's ready.
    const { error: saveErr } = await supabase
      .from("chapters").update({ pages }).eq("id", chapter_id);
    if (saveErr) {
      throw new Error(`failed to save image paths: ${saveErr.message}`);
    }

    const failed = results.filter((r) => r.error);
    return jsonResponse({
      ok: failed.length === 0,
      chapter_id,
      illustrated: results.filter((r) => r.image_path).map((r) => r.page),
      failed,
      results,
      ...(return_images ? { images } : {}),
    }, { status: failed.length === 0 ? 200 : 207 });
  } catch (err) {
    return jsonResponse(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
});
