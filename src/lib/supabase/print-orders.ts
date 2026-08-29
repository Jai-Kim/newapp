import type { PrintOrder, ShippingAddress } from './types';

import { supabase } from './client';

/**
 * Concierge print capture (issue #22, ADR-0003, slice 4).
 *
 * Submission goes through the submit-print-order Edge Function, not a direct
 * insert — print_orders has no client-facing insert policy at all, because
 * the chapter snapshot has to be computed server-side against the real
 * child_readable_chapters, never trusted from the client (0007_print_orders.sql).
 * Listing is a plain RLS-scoped read, same as everywhere else.
 */

export type PrintOrderDraft = {
  child_id: string;
  volume_index: number;
  recipient_name: string;
  shipping_address: ShippingAddress;
  gift: boolean;
  gift_message?: string;
  note?: string;
};

export type SubmitPrintOrderResult = {
  ok: boolean;
  order_id?: string;
  created_at?: string;
  already_ordered?: boolean;
};

/**
 * supabase-js reports any non-2xx as a FunctionsHttpError whose message is
 * just "Edge Function returned a non-2xx status code" — the useful part is
 * the response body, which has to be read off the attached Response.
 */
async function bodyOf(error: unknown): Promise<Record<string, unknown> | null> {
  const context = (error as { context?: unknown }).context;
  if (!(context instanceof Response)) {
    return null;
  }
  try {
    return (await context.clone().json()) as Record<string, unknown>;
  }
  catch {
    return null;
  }
}

export async function submitPrintOrder(
  draft: PrintOrderDraft,
): Promise<SubmitPrintOrderResult> {
  const { data, error } = await supabase.functions.invoke<SubmitPrintOrderResult>(
    'submit-print-order',
    { body: draft },
  );

  if (error) {
    const body = await bodyOf(error);
    throw new Error(typeof body?.error === 'string' ? body.error : error.message);
  }
  if (!data) {
    throw new Error('submit-print-order returned no data');
  }
  return data;
}

/** For the parent to confirm an order was captured — the acceptance criterion is "retrievable". */
export async function listPrintOrders(childId: string): Promise<PrintOrder[]> {
  const { data, error } = await supabase
    .from('print_orders')
    .select('*')
    .eq('child_id', childId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }
  return data as PrintOrder[];
}
