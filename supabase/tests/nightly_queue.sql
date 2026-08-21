-- Pre-generation queue guarantees (issue #9).
--
-- Three properties this asserts, all of which cost real money or real trust if
-- they are wrong:
--
--   1. One live job per child. Generation bills two paid providers, so a
--      double-tap, a retry, or a second device must not buy two chapters.
--   2. A client can create work but never complete it. The worker's status
--      transitions are the record of what was actually spent; a client that
--      could write 'done' could also fake a chapter that does not exist.
--   3. Isolation. One family's queue is invisible to another, and no one can
--      queue work against someone else's child.
--
--   npx supabase db query --linked -f supabase/tests/nightly_queue.sql
--
-- Runs in a rolled-back transaction against two synthetic actors, impersonated
-- via `request.jwt.claims`. Results go to a temp table because `raise notice`
-- does not surface through the Management API.

begin;

create temp table _q_results (n serial, assertion text) on commit drop;
grant select, insert on _q_results to authenticated;
grant usage on sequence _q_results_n_seq to authenticated;

-- FIXTURES, not accounts: no password, no identity, and the transaction is
-- rolled back, so nothing capable of signing in is created or left behind.
insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'queue-test-alice@example.invalid'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'queue-test-bob@example.invalid');

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

-- An approved chapter for Ada, and one still pending, so "tonight's chapter"
-- and the parent gate can both be exercised.
insert into chapters (id, child_id, number, title_en, pages, summary, safety, review_status)
values
  ('aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000002',
   1, 'Ada approved', '[]'::jsonb, 'summary', '{"verdict":"safe"}'::jsonb, 'approved'),
  ('aaaaaaaa-0000-0000-0000-0000000000c2', 'aaaaaaaa-0000-0000-0000-000000000002',
   2, 'Ada pending',  '[]'::jsonb, 'summary', '{"verdict":"safe"}'::jsonb, 'pending');

do $$
declare
  n int;
  ok boolean;
begin
  -- ======================================================================
  -- 1. One live job per child
  -- ======================================================================
  insert into chapter_queue (child_id, lesson)
  values ('aaaaaaaa-0000-0000-0000-000000000002', 'being brave');
  insert into _q_results (assertion) values ('a job can be queued');

  begin
    insert into chapter_queue (child_id, lesson)
    values ('aaaaaaaa-0000-0000-0000-000000000002', 'sharing');
    raise exception 'FAIL: a second live job was allowed for the same child';
  exception when unique_violation then
    insert into _q_results (assertion)
    values ('a second live job is refused — a double-tap cannot buy two chapters');
  end;

  -- A finished job must not keep blocking the next night.
  update chapter_queue set status = 'done', finished_at = now()
   where child_id = 'aaaaaaaa-0000-0000-0000-000000000002';
  insert into chapter_queue (child_id, lesson)
  values ('aaaaaaaa-0000-0000-0000-000000000002', 'tomorrow');
  insert into _q_results (assertion)
  values ('once a job is done the next one can be queued');

  -- A failed job must not block forever either, or one bad night ends the app.
  update chapter_queue set status = 'failed' where status = 'queued';
  insert into chapter_queue (child_id, lesson)
  values ('aaaaaaaa-0000-0000-0000-000000000002', 'after a failure');
  insert into _q_results (assertion)
  values ('a failed job does not block the queue forever');

  update chapter_queue set status = 'done' where status = 'queued';

  -- ======================================================================
  -- 2. mark_chapter_read
  -- ======================================================================
  perform mark_chapter_read('aaaaaaaa-0000-0000-0000-0000000000c1');
  select read_at is not null into ok from chapters
   where id = 'aaaaaaaa-0000-0000-0000-0000000000c1';
  if not ok then
    raise exception 'FAIL: read_at was not stamped';
  end if;
  insert into _q_results (assertion) values ('finishing a chapter stamps read_at');

  begin
    -- An unapproved chapter is not readable, so it cannot be marked read —
    -- otherwise the gate could be walked around from the reader.
    perform mark_chapter_read('aaaaaaaa-0000-0000-0000-0000000000c2');
    raise exception 'FAIL: a pending chapter was marked read';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
    insert into _q_results (assertion)
    values ('an unapproved chapter cannot be marked read');
  end;
end $$;

-- ==========================================================================
-- 3. Isolation, as real signed-in users
-- ==========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

do $$
declare
  n int;
begin
  select count(*) into n from chapter_queue;
  if n = 0 then
    raise exception 'FAIL: Alice cannot see her own queue';
  end if;
  insert into _q_results (assertion) values ('Alice sees her own queue');

  select count(*) into n from chapter_queue
   where child_id = 'bbbbbbbb-0000-0000-0000-000000000002';
  if n <> 0 then
    raise exception 'FAIL: Alice can see Bob''s queue';
  end if;
  insert into _q_results (assertion) values ('Alice cannot see the other family''s queue');

  begin
    insert into chapter_queue (child_id, lesson)
    values ('bbbbbbbb-0000-0000-0000-000000000002', 'spending Bob''s money');
    raise exception 'FAIL: Alice queued work against another family''s child';
  exception when insufficient_privilege then
    insert into _q_results (assertion)
    values ('Alice cannot queue work against another family''s child');
  end;

  begin
    -- The status check in the insert policy. A client that could insert
    -- 'done' could fabricate a chapter that was never generated.
    insert into chapter_queue (child_id, lesson, status)
    values ('aaaaaaaa-0000-0000-0000-000000000002', 'pretending', 'done');
    raise exception 'FAIL: a client created a job already marked done';
  exception when insufficient_privilege then
    insert into _q_results (assertion)
    values ('a client can create work but cannot pre-declare it finished');
  end;
end $$;

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

do $$
declare
  n int;
begin
  -- Bob's half mirrors Alice's deliberately: a policy that hardcoded one side
  -- would pass every assertion above and fail here.
  select count(*) into n from chapter_queue;
  if n <> 0 then
    raise exception 'FAIL: Bob can see the other family''s queue';
  end if;
  insert into _q_results (assertion) values ('Bob sees no queue of his own or anyone else''s');

  select count(*) into n from child_readable_chapters;
  if n <> 0 then
    raise exception 'FAIL: Bob can read the other family''s chapters';
  end if;
  insert into _q_results (assertion) values ('Bob cannot read the other family''s chapters');
end $$;

reset role;

select n, assertion from _q_results order by n;

rollback;
