-- Privacy consent RLS (issue #12).
--
-- Two properties: a parent can record and read consent for their own family
-- only, and no client-supplied family_id lets them do it for anyone else's.
--
--   npx supabase db query --linked -f supabase/tests/privacy_consents.sql
--
-- Runs in a rolled-back transaction against two synthetic actors, impersonated
-- via `request.jwt.claims`, following the same pattern as rls_isolation.sql.

begin;

create temp table _pc_results (n serial, assertion text) on commit drop;
grant select, insert on _pc_results to authenticated;
grant usage on sequence _pc_results_n_seq to authenticated;

insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'consent-test-alice@example.invalid'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'consent-test-bob@example.invalid');

insert into families (id, auth_user_id, display_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', 'Alice family'),
  ('bbbbbbbb-0000-0000-0000-000000000001',
   '22222222-2222-2222-2222-222222222222', 'Bob family');

set local role authenticated;

-- ---------------------------------------------------------------------------
-- Act as Alice.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111"}', true);

do $$
declare n int;
begin
  insert into privacy_consents (family_id, policy_version)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'v1');
  insert into _pc_results (assertion) values ('Alice can record consent for her own family');

  select count(*) into n from privacy_consents;
  if n <> 1 then
    raise exception 'Alice sees % consent rows, expected 1', n;
  end if;
  insert into _pc_results (assertion) values ('Alice sees exactly her own consent');
end $$;

-- Writing consent against another family must fail, not just reading it.
do $$
begin
  begin
    insert into privacy_consents (family_id, policy_version)
    values ('bbbbbbbb-0000-0000-0000-000000000001', 'v1');
    raise exception 'LEAK: Alice recorded consent for another family';
  exception
    when insufficient_privilege then
      insert into _pc_results (assertion)
        values ('Alice cannot record consent for another family');
    when others then
      if sqlerrm like '%row-level security%' then
        insert into _pc_results (assertion)
          values ('Alice cannot record consent for another family');
      else
        raise;
      end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Act as Bob — the mirror image, so a policy hardcoding one side cannot pass.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222"}', true);

do $$
declare n int;
begin
  select count(*) into n from privacy_consents;
  if n <> 0 then
    raise exception 'LEAK: Bob can see Alice''s consent';
  end if;
  insert into _pc_results (assertion) values ('Bob sees no consent of Alice''s');

  insert into privacy_consents (family_id, policy_version)
  values ('bbbbbbbb-0000-0000-0000-000000000001', 'v1');
  insert into _pc_results (assertion) values ('Bob can record consent for his own family');
end $$;

-- ---------------------------------------------------------------------------
-- Act as a signed-out visitor.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{}', true);

do $$
declare n int;
begin
  select count(*) into n from privacy_consents;
  if n <> 0 then
    raise exception 'LEAK: a signed-out visitor sees % consent rows', n;
  end if;
  insert into _pc_results (assertion) values ('a signed-out visitor sees no consent');
end $$;

reset role;

select n, assertion from _pc_results order by n;

rollback;
