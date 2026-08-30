-- 0010_generation_quota.sql
-- Server-side spend guard for chapter generation (issue #6).
--
-- generate-chapter and enqueue-chapter already require a signed-in owner
-- (_shared/auth.ts's requireUser/assertOwnsChild) -- that stops an anonymous
-- or cross-family caller. It does not stop a signed-in owner from generating
-- an unbounded number of chapters, which is the actual spend risk: every
-- chapter costs money at two paid providers (text + images). This migration
-- is the missing half -- a per-user rate limit and a per-child month-to-date
-- quota, enforced atomically before either function does anything that costs
-- money.
--
-- Numbered past 0008/0009: those numbers belong to two other branches that
-- had not merged yet when this was written (this one previously existed as
-- an unmergeable branch itself -- see the PR description for why it was
-- re-cut from scratch rather than fixed in place).

create table if not exists generation_attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  child_id    uuid not null references children(id) on delete cascade,
  created_at  timestamptz not null default now()
);

comment on table generation_attempts is
  'Server-side ledger backing reserve_generation_attempt() (issue #6). Every '
  'row is one reserved generation slot -- reserved BEFORE generation runs, so '
  'a chapter that fails at the provider still costs the family one of the '
  'month''s -- the safe direction for spend, though a product call, not a '
  'technical one.';

-- Rate limiting scans recent rows for this user, across every child they own.
create index if not exists idx_generation_attempts_user_recent
  on generation_attempts (user_id, created_at desc);

-- The monthly quota is per child, not per family, matching VOLUME_SIZE (a
-- Volume belongs to one child) -- src/features/reader/volumes.ts.
create index if not exists idx_generation_attempts_child_month
  on generation_attempts (child_id, created_at);

-- --------------------------------------------------------------------------
-- RLS: deny-all to `authenticated`. There is no policy at all below, on
-- purpose -- same pattern as 0007_print_orders.sql's insert path. Reservation
-- must be atomic (count-then-insert under a lock) and must trust the
-- caller-supplied user_id/child_id only when the caller IS the service role,
-- which bypasses RLS entirely. A signed-in client reading or writing this
-- table directly, or calling reserve_generation_attempt() directly with
-- someone else's ids, gets nothing: RLS denies the select and the insert
-- both, function-internal or not (see the function comment below).
-- --------------------------------------------------------------------------
alter table generation_attempts enable row level security;

-- --------------------------------------------------------------------------
-- reserve_generation_attempt: the atomic spend guard.
--
-- SECURITY INVOKER, matching mark_chapter_read (0005_nightly_queue.sql): when
-- called by the Edge Function's service-role client, RLS is bypassed anyway,
-- so this runs with full access to the table. If a signed-in client ever
-- called this function directly via rpc(), SECURITY INVOKER means it runs
-- under ITS OWN privileges -- and generation_attempts has no policy granting
-- `authenticated` anything, so the select and the insert are both denied by
-- RLS. That is deliberate defense in depth against a client passing someone
-- else's user_id/child_id to read or burn their quota.
--
-- pg_advisory_xact_lock on the user serializes concurrent calls from the same
-- user for the lifetime of the transaction, so two requests racing the same
-- millisecond cannot both read "2 of 3 used" and both proceed.
--
-- Returns a plain text code rather than raising, so the calling Edge Function
-- can turn it into a warm, bilingual response instead of a bare Postgres
-- error: 'ok' | 'rate_limited' | 'monthly_quota_exceeded'.
-- --------------------------------------------------------------------------
create or replace function reserve_generation_attempt(
  p_user_id uuid,
  p_child_id uuid,
  p_rate_limit_max int,
  p_rate_limit_window_ms bigint,
  p_monthly_allowance int
)
returns text
language plpgsql
security invoker
as $$
declare
  recent_count int;
  monthly_count int;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select count(*) into recent_count
    from generation_attempts
   where user_id = p_user_id
     and created_at > now() - (p_rate_limit_window_ms || ' milliseconds')::interval;

  if recent_count >= p_rate_limit_max then
    return 'rate_limited';
  end if;

  -- UTC calendar month, matching the client-side allowance's window: cast the
  -- truncated naive timestamp back to timestamptz via `at time zone` rather
  -- than comparing a naive timestamp against created_at directly, which would
  -- silently reinterpret it in the session's timezone instead of UTC.
  select count(*) into monthly_count
    from generation_attempts
   where child_id = p_child_id
     and created_at >= (date_trunc('month', now() at time zone 'utc') at time zone 'utc');

  if monthly_count >= p_monthly_allowance then
    return 'monthly_quota_exceeded';
  end if;

  insert into generation_attempts (user_id, child_id) values (p_user_id, p_child_id);
  return 'ok';
end;
$$;

comment on function reserve_generation_attempt is
  'Atomically checks the per-user rate limit and per-child month-to-date '
  'quota, then reserves the slot by inserting -- all under one advisory lock '
  'so two concurrent calls cannot both slip under a cap (issue #6).';
