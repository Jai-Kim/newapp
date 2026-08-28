-- 0008_generation_quota.sql
-- Abuse & cost protection on the chapter-generation path (issue #6).
--
-- `requireUser`/`assertOwnsChild` (auth.ts) already prove a call to
-- generate-chapter or enqueue-chapter is a real signed-in parent touching
-- their own child. That answers WHO is calling, not HOW MUCH they can spend —
-- a single compromised token, a runaway retry loop, or an over-eager parent
-- could otherwise burn budget at two paid providers without limit. This
-- migration adds the ledger and the check; supabase/functions/_shared/quota.ts
-- is what calls it.
--
-- Two independent guards, enforced together in reserve_generation_attempt():
--   1. a short rate-limit window per user, across every child they own;
--   2. a month-to-date quota per child, mirroring the ~one-book/month rhythm
--      (VOLUME_SIZE = 10 in src/features/reader/volumes.ts, PR #27) so the
--      spend guard and the family-facing allowance describe the same book.
--
-- The numbers themselves are config, not baked in here — see .env.example
-- and the module comment in quota.ts. This migration only shapes the ledger
-- and the atomic check; it does not decide what the limits should be.

create table if not exists generation_attempts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  child_id   uuid not null references children(id) on delete cascade,
  source     text not null check (source in ('generate-chapter', 'enqueue-chapter')),
  created_at timestamptz not null default now()
);

comment on table generation_attempts is
  'One row reserved per paid generation call, written before the call spends '
  'anything (issue #6). Backs both the per-user rate limit and the per-child '
  'month-to-date quota. No client-facing policy exists at all — every row is '
  'written by reserve_generation_attempt() under the service role.';

create index if not exists idx_generation_attempts_user_recent
  on generation_attempts (user_id, created_at desc);

create index if not exists idx_generation_attempts_child_month
  on generation_attempts (child_id, created_at desc);

-- --------------------------------------------------------------------------
-- RLS: deliberately no policy for `authenticated`. RLS enabled with zero
-- policies denies every row to every role except service_role (which has
-- BYPASSRLS) — a parent has no legitimate reason to read or write this spend
-- ledger directly; the allowance they see is the derived, family-facing one
-- the app shows, not this table. 0006_grants.sql's blanket table grant still
-- applies (it is the door, not the lock), so this is the only gate.
-- --------------------------------------------------------------------------
alter table generation_attempts enable row level security;

-- --------------------------------------------------------------------------
-- reserve_generation_attempt: checks both guards and reserves the slot by
-- inserting the row, all inside one advisory-locked transaction.
--
-- Why the lock: a plain "count, then insert" has a race — two requests from
-- the same user, close enough together, could both count zero rows under the
-- cap and both insert, spending twice what the cap allowed. The advisory
-- lock, keyed on the user, serializes concurrent calls from that user for the
-- rest of the transaction, so the second call's count always sees the first
-- call's insert. It is released automatically at commit or rollback.
--
-- SECURITY INVOKER (the default — not restated as SECURITY DEFINER) is
-- deliberate: this function is called only from Edge Functions under the
-- service role, which bypasses RLS on the table directly. If an authenticated
-- client called it directly instead, it would run as that client, and the
-- table's deny-all RLS above would refuse the insert exactly as it would a
-- direct write — the function grants no extra privilege of its own.
-- --------------------------------------------------------------------------
create or replace function reserve_generation_attempt(
  p_user_id uuid,
  p_child_id uuid,
  p_source text,
  p_rate_limit_max int,
  p_rate_window_ms bigint,
  p_monthly_allowance int
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  window_start timestamptz := now() - (p_rate_window_ms::text || ' milliseconds')::interval;
  -- UTC calendar month, matching the client-side allowance's convention
  -- (paywall branch, currently gated) so the two describe the same window.
  month_start  timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  month_end    timestamptz := month_start + interval '1 month';
  recent_count int;
  month_count  int;
begin
  if p_source not in ('generate-chapter', 'enqueue-chapter') then
    raise exception 'invalid source: %', p_source;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select count(*) into recent_count
    from generation_attempts
   where user_id = p_user_id
     and created_at >= window_start;

  if recent_count >= p_rate_limit_max then
    return jsonb_build_object('allowed', false, 'reason', 'rate_limited');
  end if;

  select count(*) into month_count
    from generation_attempts
   where child_id = p_child_id
     and created_at >= month_start
     and created_at < month_end;

  if month_count >= p_monthly_allowance then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'monthly_quota_reached',
      'resets_at', month_end
    );
  end if;

  insert into generation_attempts (user_id, child_id, source)
  values (p_user_id, p_child_id, p_source);

  return jsonb_build_object('allowed', true);
end;
$$;

comment on function reserve_generation_attempt is
  'Atomically checks the per-user rate limit and per-child month-to-date '
  'quota, then reserves a slot by inserting the attempt row (issue #6). '
  'Called only from Edge Functions under the service role; SECURITY INVOKER '
  '(the default) is deliberate — see the comment above the definition.';
