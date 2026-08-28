// Storyloom — submit-print-order Edge Function (issue #22, ADR-0003, slice 4).
//
// Concierge print: at Volume completion a parent can ask for the hardcover.
// There is no print-on-demand integration yet -- the first 100 are fulfilled
// by hand -- so this function's job is narrow: capture the order + shipping
// details against a chapter snapshot computed HERE, server-side, from the
// real child_readable_chapters, and tell the team an order landed. No
// payment fields, no charge.
//
// Deploy: supabase functions deploy submit-print-order

import { createClient } from "jsr:@supabase/supabase-js@2";

import { assertOwnsChild, requireUser, statusFor } from "../_shared/auth.ts";
import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { completedVolumeChapterIds } from "../_shared/volumes.ts";

interface ShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postal_code: string;
  country: string;
}

interface Req {
  child_id: string;
  volume_index: number;
  recipient_name: string;
  shipping_address: ShippingAddress;
  gift?: boolean;
  gift_message?: string;
  note?: string;
}

const REQUIRED_ADDRESS_FIELDS = ["line1", "city", "postal_code", "country"] as const;

function missingAddressFields(address: unknown): string | null {
  const addr = (address ?? {}) as Record<string, unknown>;
  const missing = REQUIRED_ADDRESS_FIELDS.filter(
    key => String(addr[key] ?? "").trim().length === 0,
  );
  return missing.length > 0
    ? `shipping address missing: ${missing.join(", ")}`
    : null;
}

/**
 * Supabase Edge Functions keep running after the response when work is
 * handed to waitUntil -- same pattern as enqueue-chapter, for the
 * fire-and-forget team notification below.
 */
declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void } | undefined;

function runInBackground(promise: Promise<unknown>): void {
  if (typeof EdgeRuntime !== "undefined") {
    EdgeRuntime.waitUntil(promise);
    return;
  }
  void promise;
}

/**
 * Tells the team an order landed. Deliberately PII-free -- no recipient name
 * or address leaves this function in the notification, only enough to find
 * the row in the database. No notification channel has been provided yet, so
 * this is a no-op (besides a log line) until PRINT_ORDER_NOTIFY_WEBHOOK_URL
 * is configured -- see the PR description for what Jai needs to set up.
 */
async function notifyTeam(order: {
  id: string;
  child_id: string;
  volume_index: number;
  gift: boolean;
}): Promise<void> {
  const webhook = Deno.env.get("PRINT_ORDER_NOTIFY_WEBHOOK_URL");
  if (!webhook) {
    console.log(
      `[submit-print-order] new order ${order.id} for child ${order.child_id}, `
      + `volume ${order.volume_index}${order.gift ? " (gift)" : ""} `
      + `(no notify webhook configured, see PRINT_ORDER_NOTIFY_WEBHOOK_URL)`,
    );
    return;
  }
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `New hardcover order — child ${order.child_id}, volume `
          + `${order.volume_index}${order.gift ? " (gift)" : ""}. Order id ${order.id}.`,
      }),
    });
  } catch (err) {
    console.error(`[submit-print-order] notify failed for ${order.id}:`, err);
  }
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) {
    return preflight;
  }

  try {
    const body = (await req.json()) as Partial<Req>;
    const { child_id, volume_index, recipient_name, shipping_address, gift, gift_message, note } = body;

    if (!child_id || !Number.isInteger(volume_index) || (volume_index as number) < 1) {
      return jsonResponse(
        { ok: false, error: "child_id and a valid volume_index are required" },
        { status: 400 },
      );
    }
    if (!recipient_name || recipient_name.trim().length === 0) {
      return jsonResponse({ ok: false, error: "recipient_name is required" }, { status: 400 });
    }
    const addressError = missingAddressFields(shipping_address);
    if (addressError) {
      return jsonResponse({ ok: false, error: addressError }, { status: 400 });
    }

    const user = await requireUser(req);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await assertOwnsChild(supabase, child_id, user.id);

    // The snapshot is computed here, from the real gate-enforcing view, and
    // never trusted from the client -- see 0007_print_orders.sql.
    const { data: readable, error: readErr } = await supabase
      .from("child_readable_chapters")
      .select("id,number")
      .eq("child_id", child_id);
    if (readErr) {
      throw readErr;
    }

    const chapterIds = completedVolumeChapterIds(readable ?? [], volume_index as number);
    if (!chapterIds) {
      return jsonResponse(
        { ok: false, error: "that volume is not complete yet" },
        { status: 409 },
      );
    }

    const { data: order, error: insertErr } = await supabase
      .from("print_orders")
      .insert({
        child_id,
        volume_index,
        chapter_ids: chapterIds,
        recipient_name: recipient_name.trim(),
        shipping_address,
        gift: Boolean(gift),
        gift_message: gift_message?.trim() || null,
        note: note?.trim() || null,
        requested_by: user.id,
      })
      .select("id,created_at")
      .single();

    if (insertErr) {
      // The one-live-order-per-volume index. A double-tap or a retry must not
      // hand-fulfil the same family's book twice.
      if (insertErr.code === "23505") {
        return jsonResponse({
          ok: true,
          already_ordered: true,
          message: "this book has already been ordered",
        });
      }
      throw insertErr;
    }

    runInBackground(notifyTeam({
      id: order.id as string,
      child_id: child_id as string,
      volume_index: volume_index as number,
      gift: Boolean(gift),
    }));

    return jsonResponse({ ok: true, order_id: order.id, created_at: order.created_at });
  } catch (err) {
    return jsonResponse(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: statusFor(err) },
    );
  }
});
