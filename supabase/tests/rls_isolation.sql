-- RLS multi-tenant isolation test.
--
-- Week 2 is the first time real signed-in users exist, so the RLS written in
-- Spike 0 finally has something to protect. This asserts the property that
-- matters: one family must never see another's child, chapters or threads.
--
-- It runs entirely in a rolled-back transaction against two synthetic actors,
-- impersonating each in turn via `request.jwt.claims` — the same input
-- PostgREST feeds `auth.uid()`.
--
--   npx supabase db query --linked -f supabase/tests/rls_isolation.sql
--
-- Any leak raises and aborts the run. Passing assertions are collected into a
-- temp table and selected at the end, because `raise notice` output does not
-- surface through the Management API — a silent success would be no evidence.

begin;

create temp table _rls_results (n serial, assertion text) on commit drop;

-- The assertions run as `authenticated` (that is the point), so that role needs
-- to be able to record them. Needing this grant is itself a small confirmation
-- that the impersonation below is real.
grant select, insert on _rls_results to authenticated;
grant usage on sequence _rls_results_n_seq to authenticated;

-- families.auth_user_id references auth.users, so the two actors need rows
-- there. These are FIXTURES, not accounts: no password, no identity, no email
-- confirmation, and the surrounding transaction is rolled back, so nothing
-- capable of signing in is ever created or left behind.
insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rls-test-alice@example.invalid'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rls-test-bob@example.invalid');

-- Seeded as the table owner, which bypasses RLS, so both families exist.
insert into families (id, auth_user_id, display_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', 'Alice family'),
  ('bbbbbbbb-0000-0000-0000-000000000001',
   '22222222-2222-2222-2222-222222222222', 'Bob family');

insert into children (id, family_id, first_name, age_band, primary_language) values
  ('aaaaaaaa-0000-0000-0000-000000000002',
   'aaaaaaaa-0000-0000-0000-000000000001', 'Ada', '5-6', 'en'),
  ('bbbbbbbb-0000-0000-0000-000000000002',
   'bbbbbbbb-0000-0000-0000-000000000001', 'Bo',  '5-6', 'ko');

insert into chapters (child_id, number, title_en, pages, summary, safety, review_status)
values
  ('aaaaaaaa-0000-0000-0000-000000000002', 1, 'Ada chapter', '[]'::jsonb,
   'Ada summary', '{"verdict":"safe"}'::jsonb, 'approved'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 1, 'Bo chapter', '[]'::jsonb,
   'Bo summary', '{"verdict":"safe"}'::jsonb, 'approved');

insert into threads (child_id, summary, status) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Ada thread', 'open'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Bo thread',  'open');

set local role authenticated;

-- ---------------------------------------------------------------------------
-- Act as Alice.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111"}', true);

do $$
declare n int;
begin
  select count(*) into n from children;
  if n <> 1 then
    raise exception 'Alice sees % children, expected 1', n;
  end if;
  insert into _rls_results (assertion) values ('Alice sees exactly her own child');

  select count(*) into n from children where first_name = 'Bo';
  if n <> 0 then
    raise exception 'LEAK: Alice can see another family''s child';
  end if;
  insert into _rls_results (assertion) values ('Alice cannot see the other child');

  select count(*) into n from chapters where title_en = 'Bo chapter';
  if n <> 0 then
    raise exception 'LEAK: Alice can see another family''s chapter';
  end if;
  insert into _rls_results (assertion) values ('Alice cannot see the other chapters');

  select count(*) into n from child_readable_chapters where title_en = 'Bo chapter';
  if n <> 0 then
    raise exception 'LEAK: another family''s chapter visible via the reader view';
  end if;
  insert into _rls_results (assertion)
    values ('the child-readable view is family-scoped too');

  select count(*) into n from threads where summary = 'Bo thread';
  if n <> 0 then
    raise exception 'LEAK: Alice can see another family''s threads';
  end if;
  insert into _rls_results (assertion) values ('Alice cannot see the other threads');
end $$;

-- Reading is only half of it — Alice must not be able to WRITE into Bob's
-- family either.
do $$
begin
  begin
    insert into children (family_id, first_name, age_band, primary_language)
    values ('bbbbbbbb-0000-0000-0000-000000000001', 'Intruder', '5-6', 'en');
    raise exception 'LEAK: Alice inserted a child into another family';
  exception
    when insufficient_privilege then
      insert into _rls_results (assertion)
        values ('Alice cannot insert into the other family');
    when others then
      if sqlerrm like '%row-level security%' then
        insert into _rls_results (assertion)
          values ('Alice cannot insert into the other family');
      else
        raise;
      end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Act as Bob — the mirror image, so a policy that accidentally hardcodes one
-- side cannot pass.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222"}', true);

do $$
declare n int;
begin
  select count(*) into n from children;
  if n <> 1 then
    raise exception 'Bob sees % children, expected 1', n;
  end if;
  insert into _rls_results (assertion) values ('Bob sees exactly his own child');

  select count(*) into n from chapters where title_en = 'Ada chapter';
  if n <> 0 then
    raise exception 'LEAK: Bob can see another family''s chapter';
  end if;
  insert into _rls_results (assertion) values ('Bob cannot see the other chapters');
end $$;

-- ---------------------------------------------------------------------------
-- Act as a signed-out visitor.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{}', true);

do $$
declare n int;
begin
  select count(*) into n from children;
  if n <> 0 then
    raise exception 'LEAK: a signed-out visitor sees % children', n;
  end if;
  insert into _rls_results (assertion) values ('a signed-out visitor sees nothing');
end $$;

select n, assertion from _rls_results order by n;

rollback;
