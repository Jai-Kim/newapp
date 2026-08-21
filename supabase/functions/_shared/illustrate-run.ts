// Storyloom — illustrating a stored chapter, end to end.
//
// Extracted from the illustrate-chapter handler for the same reason as the
// storyteller core: the queue worker runs this with no user session, straight
// after generation, so that a pre-generated chapter arrives complete rather
// than as text a parent then has to wait on again (issue #9).
//
// Nothing here knows about requests or users. The caller establishes ownership.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";

import { choosePages, illustratePage } from "./illustrate.ts";
import { reviewIllustration, type IllustrationVerdict } from "./safety.ts";

interface Page {
  page: number;
  en: string;
  ko: string;
  scene: string;
  wardrobe: string;
  illustrated?: boolean;
  image_path?: string;
}

export interface PageResult {
  page: number;
  image_path?: string;
  latency_ms?: number;
  error?: string;
  blocked?: string;
}

export interface IllustrateChapterResult {
  ok: boolean;
  illustrated: number[];
  blocked: PageResult[];
  failed: PageResult[];
  results: PageResult[];
  image_safety: IllustrationVerdict[];
  images: { page: number; image_base64: string }[];
}

/** The child's locked identity reference, loaded from the private bucket. */
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
    // The look picker has not run. Worth saying plainly, because it is a setup
    // step the parent skipped rather than anything going wrong.
    throw new Error(
      "this child has no locked character sheet yet — run the look picker first",
    );
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

export class ChapterBlockedError extends Error {}

export async function illustrateChapter(
  supabase: SupabaseClient,
  chapterId: string,
  options: { illustrations?: number; returnImages?: boolean } = {},
): Promise<IllustrateChapterResult> {
  const { illustrations = 4, returnImages = false } = options;

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set");
  }

  const { data: chapter, error: chErr } = await supabase
    .from("chapters")
    .select("id,child_id,number,pages,review_status,safety,lesson")
    .eq("id", chapterId)
    .single();
  if (chErr || !chapter) {
    throw new Error(`chapter not found: ${chErr?.message}`);
  }

  // Never spend money illustrating something the filter rejected.
  if ((chapter.safety as { verdict?: string } | null)?.verdict === "blocked") {
    throw new ChapterBlockedError(
      "chapter was blocked by the content filter; not illustrating",
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

  const results: PageResult[] = [];
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
    if (returnImages) {
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
    .from("chapters").update({ pages, safety: mergedSafety }).eq("id", chapterId);
  if (saveErr) {
    throw new Error(`failed to save image paths: ${saveErr.message}`);
  }

  const failed = results.filter((r) => r.error);
  return {
    ok: failed.length === 0,
    illustrated: results.filter((r) => r.image_path).map((r) => r.page),
    blocked: results.filter((r) => r.blocked),
    failed,
    results,
    image_safety: imageSafety,
    images,
  };
}
