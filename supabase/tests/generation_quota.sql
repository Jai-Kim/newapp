-- Abuse & cost protection on the chapter-generation path (issue #6).
--
-- Three properties this asserts:
--   1. The rate limit: a user who starts p_rate_limit_max calls within the
--      window is refused the next one, across every child they own.
--   2. The month-to-date quota: a child who already has p_monthly_allowance
--      attempts this UTC calendar month is refused another, even from a
--      fresh rate-limit window (attempts spread out over the month, not
--      bunched together, must still trip it).
--   3. Isolation: an authenticated client cannot read this table, insert into
--      it directly, or get anything useful out of calling
--      reserve_generation_attempt() itself — every real reservation happens
--      under the service role, from inside an Edge Function that already
--      proved ownership of the child.
--
--   npx supabase db query --linked -f supabase/tests/generation_quota.sql
--
-- Runs in a rolled-back transaction against a synthetic actor, impersonated
-- via `request.jwt.claims`. Results go to a temp table because `raise notice`
-- does not surface through the Management API.

begin;

create temp table _g_results (n serial, assertion text) on commit drop;
grant select, insert on _g_results to authenticated;
grant usage on sequence _g_results_n_seq to authenticated;

-- FIXTURES, not accounts: no password, no identity, and the transaction is
-- rolled back, so nothing capable of signing in is created or left behind.
insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'quota-test-alice@example.invalid');

insert into families (id, auth_user_id, display_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', 'Alice family');

insert into children (id, family_id, first_name, age_band, primary_language) values
  ('aaaaaaaa-0000-0000-0000-000000000002',
   'aaaaaaaa-0000-0000-0000-000000000001', 'Ada', '5-6', 'en'),
  ('aaaaaaaa-0000-0000-0000-000000000003',
   'aaaaaaaa-0000-0000-0000-000000000001', 'Nia', '5-6', 'en');

do $$
declare
  alice uuid := '11111111-1111-1111-1111-111111111111';
  ada   uuid := 'aaaaaaaa-0000-0000-0000-000000000002';
  nia   uuid := 'aaaaaaaa-0000-0000-0000-000000000003';
  result jsonb;
  n int;
begin
  -- ======================================================================
  -- 1. Rate limit: 2 calls per 60s window, shared across every child Alice
  --    owns, so hammering a second child cannot dodge it.
  -- ======================================================================
  result := reserve_generation_attempt(alice, ada, 'enqueue-chapter', 2, 60000, 100);
  if not (result ->> 'allowed')::boolean then
    raise exception 'FAIL: first call in the window was refused';
  end if;
  insert into _g_results (assertion) values ('first call in the window is allowed');

  result := reserve_generation_attempt(alice, nia, 'enqueue-chapter', 2, 60000, 100);
  if not (result ->> 'allowed')::boolean then
    raise exception 'FAIL: second call in the window was refused';
  end if;
  insert into _g_results (assertion)
  values ('second call in the window is allowed, even against a different child');

  result := reserve_generation_attempt(alice, ada, 'enqueue-chapter', 2, 60000, 100);
  if (result ->> 'allowed')::boolean or result ->> 'reason' <> 'rate_limited' then
    raise exception 'FAIL: a third call within the window was not rate-limited (got %)', result;
  end if;
  insert into _g_results (assertion)
  values ('a third call within the window is rate-limited, not spent');

  select count(*) into n from generation_attempts where user_id = alice;
  if n <> 2 then
    raise exception 'FAIL: the refused call still reserved a row (count = %)', n;
  end if;
  insert into _g_results (assertion) values ('a rate-limited call reserves nothing');

  delete from generation_attempts;

  -- ======================================================================
  -- 2. Month-to-date quota: attempts spread across the month, not bunched
  --    together, must still trip it — a generous rate-limit window must not
  --    accidentally become the only guard.
  -- ======================================================================
  insert into generation_attempts (user_id, child_id, source, created_at)
  select alice, ada, 'enqueue-chapter',
         date_trunc('month', now() at time zone 'utc') at time zone 'utc'
           + (g::text || ' days')::interval
    from generate_series(0, 8) g; -- 9 attempts already this month

  result := reserve_generation_attempt(alice, ada, 'enqueue-chapter', 100, 60000, 10);
  if not (result ->> 'allowed')::boolean then
    raise exception 'FAIL: the 10th chapter this month was refused (got %)', result;
  end if;
  insert into _g_results (assertion) values ('the 10th chapter this month is allowed');

  result := reserve_generation_attempt(alice, ada, 'enqueue-chapter', 100, 60000, 10);
  if (result ->> 'allowed')::boolean or result ->> 'reason' <> 'monthly_quota_reached' then
    raise exception 'FAIL: an 11th chapter this month was not blocked (got %)', result;
  end if;
  if result ->> 'resets_at' is null then
    raise exception 'FAIL: a monthly block did not say when it resets';
  end if;
  insert into _g_results (assertion)
  values ('an 11th chapter this month is blocked with a reset time, not silently spent');

  -- A different child in the same family is unaffected: the quota is per
  -- child, mirroring one book per child, not per family.
  result := reserve_generation_attempt(alice, nia, 'enqueue-chapter', 100, 60000, 10);
  if not (result ->> 'allowed')::boolean then
    raise exception 'FAIL: a sibling child was blocked by the other child''s quota';
  end if;
  insert into _g_results (assertion)
  values ('the monthly quota is per child, not per family');

  delete from generation_attempts;
end $$;

-- ==========================================================================
-- 3. Isolation, as a real signed-in user. Even a caller in good standing
--    (their own user_id, their own child) gets nothing useful: no policy
--    grants `authenticated` any access to this table at all.
-- ==========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

do $$
declare
  n int;
  result jsonb;
begin
  select count(*) into n from generation_attempts;
  if n <> 0 then
    raise exception 'FAIL: an authenticated client can read generation_attempts';
  end if;
  insert into _g_results (assertion) values ('an authenticated client sees no rows at all');

  begin
    insert into generation_attempts (user_id, child_id, source)
    values ('11111111-1111-1111-1111-111111111111',
            'aaaaaaaa-0000-0000-0000-000000000002', 'enqueue-chapter');
    raise exception 'FAIL: an authenticated client inserted a row directly';
  exception when insufficient_privilege then
    insert into _g_results (assertion)
    values ('an authenticated client cannot insert a row directly, even for their own child');
  end;

  begin
    -- Calling the function directly buys nothing either: SECURITY INVOKER
    -- means this runs as `authenticated`, and the same deny-all RLS applies.
    perform reserve_generation_attempt(
      '11111111-1111-1111-1111-111111111111',
      'aaaaaaaa-0000-0000-0000-000000000002',
      'enqueue-chapter', 100, 60000, 100
    );
    raise exception 'FAIL: calling reserve_generation_attempt directly succeeded for a client';
  exception when insufficient_privilege then
    insert into _g_results (assertion)
    values ('calling reserve_generation_attempt directly is refused the same way a raw insert is');
  end;
end $$;

reset role;

select n, assertion from _g_results order by n;

rollback;
