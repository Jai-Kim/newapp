-- print_orders RLS isolation (issue #22, ADR-0003, slice 4).
--
-- This table holds the first real name + postal address in the schema, so
-- getting isolation right matters more here than anywhere else so far. Same
-- three-actor shape as rls_isolation.sql: Alice, Bob, signed-out -- plus one
-- more check specific to this table: nobody may write to it directly, not
-- even for their own child, because the chapter_ids snapshot has to be
-- computed server-side (see 0007_print_orders.sql).
--
--   npx supabase db query --linked -f supabase/tests/print_orders_rls.sql

begin;

create temp table _rls_results (n serial, assertion text) on commit drop;
grant select, insert on _rls_results to authenticated;
grant usage on sequence _rls_results_n_seq to authenticated;

insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rls-test-alice@example.invalid'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rls-test-bob@example.invalid');

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

-- Seeded as the table owner (bypasses RLS) -- the way the real function,
-- writing under the service role, would produce these rows.
insert into print_orders (
  child_id, volume_index, chapter_ids, recipient_name, shipping_address, gift
) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 1, array[]::uuid[], 'Ada''s Grandma',
   '{"line1":"1 Ada Way","city":"Springfield","postal_code":"00001","country":"US"}'::jsonb,
   true),
  ('bbbbbbbb-0000-0000-0000-000000000002', 1, array[]::uuid[], 'Bo Kim',
   '{"line1":"1 Bo Ave","city":"Seoul","postal_code":"00002","country":"KR"}'::jsonb,
   false);

set local role authenticated;

-- ---------------------------------------------------------------------------
-- Act as Alice.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111"}', true);

do $$
declare n int;
begin
  select count(*) into n from print_orders;
  if n <> 1 then
    raise exception 'Alice sees % print orders, expected 1', n;
  end if;
  insert into _rls_results (assertion) values ('Alice sees exactly her own order');

  select count(*) into n from print_orders where recipient_name = 'Bo Kim';
  if n <> 0 then
    raise exception 'LEAK: Alice can see another family''s print order';
  end if;
  insert into _rls_results (assertion) values ('Alice cannot see the other family''s order');
end $$;

-- There is no insert policy at all -- every write goes through the service
-- role -- so even Alice ordering a book for her OWN child must be rejected
-- here. This is the property the whole "snapshot computed server-side" design
-- depends on: if a client could insert directly, it could invent chapter_ids.
do $$
begin
  begin
    insert into print_orders (
      child_id, volume_index, chapter_ids, recipient_name, shipping_address
    ) values (
      'aaaaaaaa-0000-0000-0000-000000000002', 2, array[]::uuid[], 'Direct insert',
      '{"line1":"x","city":"x","postal_code":"x","country":"x"}'::jsonb
    );
    raise exception 'LEAK: a client inserted a print order directly';
  exception
    when insufficient_privilege then
      insert into _rls_results (assertion)
        values ('a client cannot insert a print order directly, even for their own child');
    when others then
      if sqlerrm like '%row-level security%' then
        insert into _rls_results (assertion)
          values ('a client cannot insert a print order directly, even for their own child');
      else
        raise;
      end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Act as Bob -- the mirror image, so a policy that accidentally hardcodes one
-- side cannot pass.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222"}', true);

do $$
declare n int;
begin
  select count(*) into n from print_orders;
  if n <> 1 then
    raise exception 'Bob sees % print orders, expected 1', n;
  end if;
  insert into _rls_results (assertion) values ('Bob sees exactly his own order');

  select count(*) into n from print_orders where recipient_name = 'Ada''s Grandma';
  if n <> 0 then
    raise exception 'LEAK: Bob can see another family''s print order';
  end if;
  insert into _rls_results (assertion) values ('Bob cannot see the other family''s order');
end $$;

-- ---------------------------------------------------------------------------
-- Act as a signed-out visitor.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{}', true);

do $$
declare n int;
begin
  select count(*) into n from print_orders;
  if n <> 0 then
    raise exception 'LEAK: a signed-out visitor sees % print orders', n;
  end if;
  insert into _rls_results (assertion) values ('a signed-out visitor sees nothing');
end $$;

select n, assertion from _rls_results order by n;

rollback;
