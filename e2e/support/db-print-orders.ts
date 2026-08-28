import { literal, sql } from './db';

/**
 * print_orders has no insert policy for `authenticated` at all — every write
 * happens server-side, under the service role, in submit-print-order (see
 * 0007_print_orders.sql). The stub for that function in stubs.ts needs the
 * same privileged path real generation never touches directly, so this
 * mirrors db-jobs.ts's role for chapter_queue.
 *
 * `literal()` from ./db is deliberately narrow (identifiers, UUIDs, emails) —
 * too narrow for free text like a recipient name or a JSON address, so this
 * file has its own escaping for those.
 */

function quote(value: string): string {
  return `'${value.replace(/'/g, '\'\'')}'`;
}

export type PrintOrderSeed = {
  childId: string;
  volumeIndex: number;
  chapterIds: string[];
  recipientName: string;
  shippingAddress: Record<string, unknown>;
  gift: boolean;
  giftMessage?: string | null;
  note?: string | null;
};

export function insertPrintOrder(
  order: PrintOrderSeed,
): { id: string; created_at: string } | null {
  const chapterIdsArray = order.chapterIds.length > 0
    ? `array[${order.chapterIds.map(literal).join(',')}]::uuid[]`
    : 'array[]::uuid[]';

  const rows = sql(`
    insert into print_orders (
      child_id, volume_index, chapter_ids, recipient_name, shipping_address,
      gift, gift_message, note
    ) values (
      ${literal(order.childId)}, ${order.volumeIndex}, ${chapterIdsArray},
      ${quote(order.recipientName)}, ${quote(JSON.stringify(order.shippingAddress))}::jsonb,
      ${order.gift}, ${order.giftMessage ? quote(order.giftMessage) : 'null'},
      ${order.note ? quote(order.note) : 'null'}
    )
    returning id, created_at;
  `);
  return (rows[0] as { id: string; created_at: string }) ?? null;
}

/** Live (non-cancelled) orders for one book — what the unique index protects. */
export function activePrintOrderCount(childId: string, volumeIndex: number): number {
  const rows = sql(`
    select count(*) as n from print_orders
    where child_id = ${literal(childId)} and volume_index = ${volumeIndex}
      and status <> 'cancelled';
  `);
  return Number(rows[0]?.n ?? 0);
}
