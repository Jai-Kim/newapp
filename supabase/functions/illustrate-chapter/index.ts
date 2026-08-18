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

import { assertOwnsChild, requireUser, statusFor } from "../_shared/auth.ts";
import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { choosePages, illustratePage } from "../_shared/illustrate.ts";
import { reviewIllustration, type IllustrationVerdict } from "../_shared/safety.ts";

interface Req {
  chapter_id: string;
  /** Upper bound on illustrated pages. ADR-0002 settles on ~4. */
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
  illustrated?: boolean;
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
    const { chapter_id, illustrations = 4, return_images = false } =
      (await req.json()) as Req;
    if (!chapter_id) {
      return jsonResponse({ ok: false, error: "chapter_id required" }, { status: 400 });
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not set");
    }

    // Images cost money too — same gate as generate-chapter (issue #6).
    const user = await requireUser(req);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: chapter, error: chErr } = await supabase
      .from("chapters")
      .select("id,child_id,number,pages,review_status,safety,lesson")
      .eq("id", chapter_id)
      .single();
    if (chErr || !chapter) {
      throw new Error(`chapter not found: ${chErr?.message}`);
    }

    await assertOwnsChild(supabase, chapter.child_id as string, user.id);

    // Never spend money illustrating something the filter rejected.
    if ((chapter.safety as { verdict?: string } | null)?.verdict === "blocked") {
      return jsonResponse(
        { ok: false, error: "chapter was blocked by the content filter; not illustrating" },
        { status: 409 },
      );
    }

    const identity = await loadIdentity(supabase, chapter.child_id as string);

    const { data: childRow } = await supabase
      .from("children").select("age_band").eq("id", chapter.child_id).single();
    const ageBand = (childRow?.age_band as string) ?? "5-6";
    const pages = chapter.pages as Page[];

    // The storyteller marks the emotional beats (ADR-0002); it knows where the
    // feeling turns and an even spread does not. choosePages is only a fallback
    // for chapters written before the flag existed.
    const marked = pages.filter((p) => p.illustrated).map((p) => p.page);
    const targets = marked.length > 0
      ? marked.slice(0, illustrations)
      : choosePages(pages.length, illustrations);

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

    const results: {
      page: number;
      image_path?: string;
      latency_ms?: number;
      error?: string;
      blocked?: string;
    }[] = [];
    const images: { page: number; image_base64: string }[] = [];
    const imageSafety: IllustrationVerdict[] = [];

    for (const [i, outcome] of settled.entries()) {
      const pageNo = targets[i];
      if (outcome.status === "rejected") {
        results.push({ page: pageNo, error: String(outcome.reason) });
        continue;
      }
      const r = outcome.value;

      // Review BEFORE storing. The image model never saw the safety rules, so a
      // gentle page can still be given a frightening picture — and a blocked
      // illustration should never reach the bucket at all.
      const page = pages.find((p) => p.page === pageNo);
      const verdict = await reviewIllustration(
        Deno.env.get("ANTHROPIC_API_KEY")!,
        ageBand,
        pageNo,
        page?.scene ?? "",
        r.image_base64,
        r.mime_type,
      );
      imageSafety.push(verdict);

      if (verdict.verdict === "blocked") {
        // Degrade to a text-only page rather than failing the chapter.
        results.push({ page: pageNo, blocked: verdict.issue ?? "blocked by image review" });
        continue;
      }

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
      if (page) {
        page.image_path = stored;
      }
      results.push({ page: pageNo, image_path: stored, latency_ms: r.latency_ms });
      if (return_images) {
        images.push({ page: pageNo, image_base64: r.image_base64 });
      }
    }

    // Write image_path back onto the pages, and record the image verdicts
    // alongside the text ones so a parent sees both in one place.
    const mergedSafety = {
      ...(chapter.safety as Record<string, unknown> ?? {}),
      illustrations: imageSafety,
    };
    const { error: saveErr } = await supabase
      .from("chapters").update({ pages, safety: mergedSafety }).eq("id", chapter_id);
    if (saveErr) {
      throw new Error(`failed to save image paths: ${saveErr.message}`);
    }

    const failed = results.filter((r) => r.error);
    const blocked = results.filter((r) => r.blocked);
    return jsonResponse({
      ok: failed.length === 0,
      chapter_id,
      illustrated: results.filter((r) => r.image_path).map((r) => r.page),
      blocked,
      failed,
      results,
      image_safety: imageSafety,
      ...(return_images ? { images } : {}),
    }, { status: failed.length === 0 ? 200 : 207 });
  } catch (err) {
    return jsonResponse(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: statusFor(err) },
    );
  }
});
