-- Server-side spend guard on chapter generation (issue #6).
--
-- Four properties this asserts, all of which cost real money or real trust if
-- they are wrong:
--
--   1. Rate limiting. A user calling faster than the configured rate is
--      refused, and the limit clears once the window has passed.
--   2. Month-to-date quota. A child's allowance is tracked across the whole
--      UTC calendar month (attempts spread across many days, not bunched at
--      one instant), not just "recently".
--   3. Scoping. The monthly quota belongs to a child, not a family or user —
--      one child's allowance running out must not freeze a sibling's.
--   4. RLS isolation. Nobody signed in — not even a parent reserving a slot
--      for their own child — can read the ledger or reserve a slot directly.
--      Only the service role (which bypasses RLS) can actually do that,
--      which is what makes reserve_generation_attempt() trustworthy to call
--      with caller-supplied ids in the first place.
--
--   npx supabase db query --linked -f supabase/tests/generation_quota.sql
--
-- Runs in a rolled-back transaction against two synthetic actors, impersonated
-- via `request.jwt.claims`. Results go to a temp table because `raise notice`
-- does not surface through the Management API.

begin;

create temp table _gq_results (n serial, assertion text) on commit drop;
grant select, insert on _gq_results to authenticated;
grant usage on sequence _gq_results_n_seq to authenticated;

-- FIXTURES, not accounts: no password, no identity, and the transaction is
-- rolled back, so nothing capable of signing in is created or left behind.
insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'quota-test-alice@example.invalid'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'quota-test-bob@example.invalid');

insert into families (id, auth_user_id, display_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', 'Alice family'),
  ('bbbbbbbb-0000-0000-0000-000000000001',
   '22222222-2222-2222-2222-222222222222', 'Bob family');

-- Alice has two children, so per-child scoping (property 3) can be checked.
insert into children (id, family_id, first_name, age_band, primary_language) values
  ('aaaaaaaa-0000-0000-0000-000000000002',
   'aaaaaaaa-0000-0000-0000-000000000001', 'Ada',  '5-6', 'en'),
  ('aaaaaaaa-0000-0000-0000-000000000003',
   'aaaaaaaa-0000-0000-0000-000000000001', 'Mina', '5-6', 'en'),
  ('bbbbbbbb-0000-0000-0000-000000000002',
   'bbbbbbbb-0000-0000-0000-000000000001', 'Bo',  '5-6', 'ko');

-- ============================================================================
-- Calls below run as the table owner (bypassing RLS), the same privilege
-- level the Edge Functions run under via the service role. The RLS section at
-- the end switches to `authenticated` deliberately.
-- ============================================================================

do $$
declare
  code text;
  i int;
begin
  -- ======================================================================
  -- 1. Rate limiting
  -- ======================================================================
  for i in 1..3 loop
    select reserve_generation_attempt(
      '11111111-1111-1111-1111-111111111111'::uuid,
      'aaaaaaaa-0000-0000-0000-000000000002'::uuid,
      3, 60000, 100
    ) into code;
    if code <> 'ok' then
      raise exception 'FAIL: attempt % within the rate limit expected ok, got %', i, code;
    end if;
  end loop;
  insert into _gq_results (assertion) values ('three attempts within the rate limit all succeed');

  select reserve_generation_attempt(
    '11111111-1111-1111-1111-111111111111'::uuid,
    'aaaaaaaa-0000-0000-0000-000000000002'::uuid,
    3, 60000, 100
  ) into code;
  if code <> 'rate_limited' then
    raise exception 'FAIL: a 4th rapid attempt should be rate_limited, got %', code;
  end if;
  insert into _gq_results (assertion) values ('a 4th attempt within the same window is rate-limited');

  -- Backdate the recorded attempts outside the window and confirm the limit
  -- clears -- a family that waits is not punished forever.
  update generation_attempts
     set created_at = now() - interval '2 minutes'
   where user_id = '11111111-1111-1111-1111-111111111111';

  select reserve_generation_attempt(
    '11111111-1111-1111-1111-111111111111'::uuid,
    'aaaaaaaa-0000-0000-0000-000000000002'::uuid,
    3, 60000, 100
  ) into code;
  if code <> 'ok' then
    raise exception 'FAIL: an attempt outside the rate-limit window should succeed, got %', code;
  end if;
  insert into _gq_results (assertion) values ('the rate limit clears once the window has passed');
end $$;

-- Clean slate for the monthly-quota checks below, so the rate-limit fixtures
-- above cannot be mistaken for this month's chapter count.
delete from generation_attempts;

do $$
declare code text;
begin
  -- ======================================================================
  -- 2. Month-to-date quota, spread across the month rather than bunched --
  -- proving the query sums the whole UTC calendar month, not just "recent"
  -- activity. All nine land within the first ~17 days of the month, so this
  -- is safe to run on any day of any month.
  -- ======================================================================
  insert into generation_attempts (user_id, child_id, created_at)
  select
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-0000-0000-0000-000000000002',
    (date_trunc('month', now() at time zone 'utc') at time zone 'utc') + (n * interval '2 days')
  from generate_series(0, 8) as n;

  -- A huge rate-limit headroom here isolates this section from property 1 --
  -- what is under test is the monthly cap, not the per-minute one.
  select reserve_generation_attempt(
    '11111111-1111-1111-1111-111111111111'::uuid,
    'aaaaaaaa-0000-0000-0000-000000000002'::uuid,
    1000, 60000, 10
  ) into code;
  if code <> 'ok' then
    raise exception 'FAIL: the 10th chapter this month should still be allowed, got %', code;
  end if;
  insert into _gq_results (assertion) values ('the 10th chapter in a UTC calendar month is still allowed');

  select reserve_generation_attempt(
    '11111111-1111-1111-1111-111111111111'::uuid,
    'aaaaaaaa-0000-0000-0000-000000000002'::uuid,
    1000, 60000, 10
  ) into code;
  if code <> 'monthly_quota_exceeded' then
    raise exception 'FAIL: an 11th chapter this month should be blocked, got %', code;
  end if;
  insert into _gq_results (assertion)
    values ('an 11th chapter in the same month is blocked -- month-to-date, not "recent"');

  -- ======================================================================
  -- 3. Scoping: Ada's exhausted allowance must not touch her sibling Mina's.
  -- ======================================================================
  select reserve_generation_attempt(
    '11111111-1111-1111-1111-111111111111'::uuid,
    'aaaaaaaa-0000-0000-0000-000000000003'::uuid, -- Mina, Ada's sibling
    1000, 60000, 10
  ) into code;
  if code <> 'ok' then
    raise exception 'FAIL: a sibling''s allowance must not be shared, got %', code;
  end if;
  insert into _gq_results (assertion)
    values ('the monthly quota is scoped per child, not per family or user');
end $$;

-- ============================================================================
-- 4. RLS isolation, as a signed-in parent (Alice) -- not the service role.
-- ============================================================================
set local role authenticated;

select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111"}', true);

do $$
declare n int;
begin
  select count(*) into n from generation_attempts;
  if n <> 0 then
    raise exception 'LEAK: a signed-in parent sees % generation_attempts rows, expected 0', n;
  end if;
  insert into _gq_results (assertion)
    values ('a signed-in parent cannot read the generation_attempts ledger directly');
end $$;

-- There is no insert policy at all -- even a parent reserving a slot for
-- their OWN child must be rejected here. This is the property the whole
-- "trust caller-supplied ids only from the service role" design depends on.
do $$
begin
  begin
    insert into generation_attempts (user_id, child_id) values (
      '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000002'
    );
    raise exception 'LEAK: a client inserted a generation_attempts row directly';
  exception
    when insufficient_privilege then
      insert into _gq_results (assertion)
        values ('a client cannot insert a generation_attempts row directly, even for their own child');
    when others then
      if sqlerrm like '%row-level security%' then
        insert into _gq_results (assertion)
          values ('a client cannot insert a generation_attempts row directly, even for their own child');
      else
        raise;
      end if;
  end;
end $$;

-- Even calling the reservation function directly, for their own child, is
-- denied -- SECURITY INVOKER means it runs under the caller's own RLS, same
-- as a direct insert. Only the service role (which bypasses RLS) can reserve
-- a slot, which is what makes it safe to trust caller-supplied ids at all.
do $$
begin
  begin
    perform reserve_generation_attempt(
      '11111111-1111-1111-1111-111111111111'::uuid,
      'aaaaaaaa-0000-0000-0000-000000000002'::uuid,
      1000, 60000, 10
    );
    raise exception 'LEAK: a client reserved a generation slot by calling the function directly';
  exception
    when insufficient_privilege then
      insert into _gq_results (assertion)
        values ('a client cannot reserve a slot by calling reserve_generation_attempt() directly');
    when others then
      if sqlerrm like '%row-level security%' then
        insert into _gq_results (assertion)
          values ('a client cannot reserve a slot by calling reserve_generation_attempt() directly');
      else
        raise;
      end if;
  end;
end $$;

select n, assertion from _gq_results order by n;

rollback;
