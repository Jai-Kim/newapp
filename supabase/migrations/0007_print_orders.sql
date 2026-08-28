-- 0007_print_orders.sql
-- Concierge print capture (issue #22, ADR-0003, slice 4).
--
-- At Volume completion a parent can ask for the hardcover. There is no
-- print-on-demand integration yet -- the first 100 are fulfilled by hand --
-- so this table's only job is to capture the order + shipping details
-- reliably and let the team find it. No payment fields: this is intent
-- capture, not a charge.
--
-- This is the first table in the schema holding a real name and postal
-- address (children.first_name and everything else is deliberately minimal
-- PII). Treat it accordingly: strict RLS below, kept out of logs and never
-- client-cached (see src/lib/supabase/print-orders.ts). Retention period and
-- Korea PIPA consent copy are open questions for Jai -- see the PR that
-- introduced this file (issue #12 is the tracking issue for that work).

create table if not exists print_orders (
  id                uuid primary key default gen_random_uuid(),
  child_id          uuid not null references children(id) on delete cascade,

  -- Which book. Volumes are derived, not persisted (src/features/reader/
  -- volumes.ts, decision carried since PR #27) -- so the order itself has to
  -- be the durable record of what was actually in the book, or a later
  -- parent rejection could silently change what a fulfilled hardcover
  -- contained. chapter_ids is computed server-side in submit-print-order,
  -- never trusted from the client.
  volume_index      int not null check (volume_index > 0),
  chapter_ids       uuid[] not null,

  recipient_name    text not null,
  shipping_address  jsonb not null,
  gift              boolean not null default false,
  gift_message      text,
  note              text,

  -- No POD integration: fulfilled by hand for the first 100 (issue #22).
  -- 'captured' is the only status submit-print-order ever writes; 'fulfilled'
  -- and 'cancelled' are for whoever ships books by hand to set directly in
  -- the database until there is an ops screen for it.
  status            text not null default 'captured'
                       check (status in ('captured', 'fulfilled', 'cancelled')),

  requested_by      uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);

comment on table print_orders is
  'Concierge print order capture (issue #22). Intent + shipping details only '
  '-- no payment fields, no POD integration. Hand-fulfilled for the first 100.';

comment on column print_orders.chapter_ids is
  'Server-computed snapshot of the volume at order time, so a later rejection '
  'or renumbering cannot change what a fulfilled book contained.';

comment on column print_orders.shipping_address is
  'jsonb {line1, line2?, city, state?, postal_code, country}. Real PII -- see '
  'the table comment.';

-- One live order per book: a double-tap or a retry must not hand-fulfil the
-- same family's book twice. A cancelled order frees the volume to be
-- reordered. (Whether a family should be able to order more than one copy of
-- the same book -- e.g. one to keep, one to gift -- is an open product
-- question; this constraint says no for now rather than guessing.)
create unique index if not exists uniq_print_orders_active_volume
  on print_orders (child_id, volume_index)
  where status <> 'cancelled';

create index if not exists idx_print_orders_child
  on print_orders (child_id, created_at desc);

-- --------------------------------------------------------------------------
-- RLS. A parent may READ their own family's orders, full stop -- there is no
-- insert/update/delete policy for `authenticated` at all, so every write
-- (including the family's own) goes through submit-print-order under the
-- service role (which bypasses RLS by design, same as generate-chapter /
-- enqueue-chapter). That is deliberate here, not just convention: the
-- chapter_ids snapshot must be computed server-side against the real
-- child_readable_chapters, never accepted from a client.
-- --------------------------------------------------------------------------
alter table print_orders enable row level security;

drop policy if exists "own print orders" on print_orders;
create policy "own print orders" on print_orders
  for select
  using (child_id in (select owned_child_ids()));
