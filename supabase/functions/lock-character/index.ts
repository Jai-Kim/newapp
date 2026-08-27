// Storyloom — lock-character Edge Function.
//
// Turns a parent's structured choices into the child's LOCKED identity: it
// draws the character model sheet, has it reviewed, stores it in the private
// character-refs bucket, and writes `children.character_ref`. Every
// illustration the child ever gets is conditioned on the image this produces.
//
// "Locked" is meant literally. Re-drawing the sheet after chapters have been
// illustrated would leave a book whose early pages show a different child, so
// re-locking is refused unless the caller asks for it explicitly.
//
// Deploy: supabase functions deploy lock-character

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

import { assertOwnsChild, requireUser, statusFor } from "../_shared/auth.ts";
import {
  buildCompanionDescriptor,
  buildIdentityDescriptor,
  buildSheetPrompt,
  buildWardrobeDefault,
  generateSheet,
  validateChoices,
} from "../_shared/character.ts";
import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { HOUSE_STYLE } from "../_shared/illustrate.ts";
import {
  friendlyProviderMessage,
  isTransientProviderError,
  withRetry,
} from "../_shared/retry.ts";
import { reviewIllustration } from "../_shared/safety.ts";

interface Req {
  child_id: string;
  choices: unknown;
  /** Required to overwrite a sheet that already exists. */
  relock?: boolean;
}

/** How many pages are already drawn from the current sheet. */
async function illustratedPageCount(
  supabase: SupabaseClient,
  childId: string,
): Promise<number> {
  const { data } = await supabase
    .from("chapters")
    .select("pages")
    .eq("child_id", childId);

  return (data ?? []).reduce(
    (n, row) =>
      n + ((row.pages ?? []) as { image_path?: string }[])
        .filter((p) => p.image_path).length,
    0,
  );
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) {
    return preflight;
  }

  try {
    const { child_id, choices, relock = false } = (await req.json()) as Req;
    if (!child_id) {
      return jsonResponse({ ok: false, error: "child_id required" }, { status: 400 });
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not set");
    }

    // Drawing a 2K sheet costs money at a paid provider (issue #6).
    const user = await requireUser(req);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await assertOwnsChild(supabase, child_id, user.id);

    // Validate before spending anything: an unknown option value is free-text
    // reaching an image prompt, which is the one thing the picker exists to
    // prevent.
    const picked = validateChoices(choices);

    const { data: child, error: childErr } = await supabase
      .from("children")
      .select("first_name,age_band,character_ref")
      .eq("id", child_id)
      .single();
    if (childErr || !child) {
      throw new Error(`child not found: ${childErr?.message}`);
    }

    if (child.character_ref && !relock) {
      const drawn = await illustratedPageCount(supabase, child_id);
      return jsonResponse({
        ok: false,
        error: "this child already has a locked character sheet",
        already_locked: true,
        illustrated_pages: drawn,
        // The number is the whole message: re-locking with nothing drawn is
        // free, and re-locking with 20 pages drawn splits the book in two.
        hint: "send relock: true to replace it; pages already illustrated will "
          + "keep the old look and no longer match",
      }, { status: 409 });
    }

    const descriptor = buildIdentityDescriptor(
      child.first_name as string,
      child.age_band as string,
      picked,
    );
    const wardrobeDefault = buildWardrobeDefault(picked);
    const companion = buildCompanionDescriptor(picked);

    // Three attempts, matching chapter generation. Nothing has been written
    // yet at this point, so a failure here costs the parent a wait and
    // nothing else — no half-locked child, no orphaned sheet in the bucket.
    const prompt = buildSheetPrompt(descriptor, wardrobeDefault, companion, HOUSE_STYLE);
    let sheet;
    try {
      sheet = await withRetry(() => generateSheet(apiKey, prompt), {
        label: `lock-character sheet for child ${child_id}`,
      });
    }
    catch (err) {
      // A provider having a bad minute is not a server error on our side, and
      // it is worth the client being able to tell the two apart: 503 means
      // "try again shortly", 502 means "we could not reach them at all".
      return jsonResponse({
        ok: false,
        error: friendlyProviderMessage(err),
        retryable: isTransientProviderError(err),
        provider_detail: err instanceof Error ? err.message : String(err),
      }, { status: isTransientProviderError(err) ? 503 : 502 });
    }

    // Review before it is stored, same rule as page art: the image model never
    // saw the safety brief, and this one picture becomes the seed for every
    // later illustration — a bad sheet propagates rather than staying local.
    const verdict = await reviewIllustration(
      Deno.env.get("ANTHROPIC_API_KEY")!,
      child.age_band as string,
      0,
      "character model sheet: three views of the child on a plain background",
      sheet.image_base64,
      sheet.mime_type,
    );
    if (verdict.verdict === "blocked") {
      return jsonResponse({
        ok: false,
        error: "the drawing was blocked by the safety reviewer; nothing was saved",
        issue: verdict.issue,
      }, { status: 422 });
    }

    // A fresh filename per lock rather than a fixed one. Overwriting would pull
    // the reference out from under pages already drawn from it, and storage is
    // far cheaper than a book that stops matching itself.
    const objectPath = `${child_id}/${crypto.randomUUID()}.png`;
    const bytes = Uint8Array.from(atob(sheet.image_base64), (c) => c.charCodeAt(0));

    const { error: upErr } = await supabase.storage
      .from("character-refs")
      .upload(objectPath, bytes, { contentType: "image/png", upsert: false });
    if (upErr) {
      throw new Error(`could not store the sheet: ${upErr.message}`);
    }

    const image_path = `character-refs/${objectPath}`;
    const character_ref = {
      identity: { image_path, descriptor },
      wardrobe_default: wardrobeDefault,
      companion: companion || null,
      // Kept so the picker can reopen on the parent's own answers instead of
      // making them rebuild the child from memory.
      choices: picked,
      locked_at: new Date().toISOString(),
      model: sheet.model,
    };

    const { error: saveErr } = await supabase
      .from("children")
      .update({ character_ref })
      .eq("id", child_id);
    if (saveErr) {
      throw new Error(`could not save the character reference: ${saveErr.message}`);
    }

    // Signed here under the service role so the parent can see the sheet
    // straight away; the client's own read policy also allows it, but only
    // after character_ref points at this path.
    const { data: signed } = await supabase.storage
      .from("character-refs")
      .createSignedUrl(objectPath, 3600);

    return jsonResponse({
      ok: true,
      child_id,
      image_path,
      preview_url: signed?.signedUrl ?? null,
      descriptor,
      wardrobe_default: wardrobeDefault,
      latency_ms: sheet.latency_ms,
      model: sheet.model,
    });
  } catch (err) {
    return jsonResponse(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: statusFor(err) },
    );
  }
});
