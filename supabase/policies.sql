-- Storyloom — RLS policies for the child-scoped Story Bible tables.
--
-- schema.sql enables RLS on every table and defines policies for `families` and
-- `children`, then leaves this NOTE:
--   "repeat an equivalent child-ownership policy for characters, world,
--    threads, chapters, lessons_taught (join child_id -> children -> families)"
-- This file is that repeat. Run it AFTER schema.sql.
--
--   psql "$DATABASE_URL" -f supabase/schema.sql
--   psql "$DATABASE_URL" -f supabase/policies.sql
--
-- Note on Edge Functions: generate-chapter connects with the SERVICE ROLE key,
-- which bypasses RLS by design. These policies protect the client (anon key)
-- path — the app can only ever read/write rows under its own family.

-- Helper: the set of child ids owned by the calling auth user. SECURITY DEFINER
-- + a stable search_path so the policy body can't be shadowed.
create or replace function public.owned_child_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from children c
  join families f on f.id = c.family_id
  where f.auth_user_id = auth.uid();
$$;

revoke all on function public.owned_child_ids() from public;
grant execute on function public.owned_child_ids() to authenticated;

-- Recurring cast.
drop policy if exists "own characters" on characters;
create policy "own characters" on characters
  for all
  using (child_id in (select owned_child_ids()))
  with check (child_id in (select owned_child_ids()));

-- Places, objects, lore.
drop policy if exists "own world" on world;
create policy "own world" on world
  for all
  using (child_id in (select owned_child_ids()))
  with check (child_id in (select owned_child_ids()));

-- Open narrative arcs & promises.
drop policy if exists "own threads" on threads;
create policy "own threads" on threads
  for all
  using (child_id in (select owned_child_ids()))
  with check (child_id in (select owned_child_ids()));

-- The chapters themselves.
drop policy if exists "own chapters" on chapters;
create policy "own chapters" on chapters
  for all
  using (child_id in (select owned_child_ids()))
  with check (child_id in (select owned_child_ids()));

-- Lesson log.
drop policy if exists "own lessons_taught" on lessons_taught;
create policy "own lessons_taught" on lessons_taught
  for all
  using (child_id in (select owned_child_ids()))
  with check (child_id in (select owned_child_ids()));

-- schema.sql's `children` and `families` policies have a USING clause but no
-- WITH CHECK, so inserts are not constrained. Tighten both.
drop policy if exists "own children" on children;
create policy "own children" on children
  for all
  using (family_id in (select id from families where auth_user_id = auth.uid()))
  with check (family_id in (select id from families where auth_user_id = auth.uid()));

drop policy if exists "family owns self" on families;
create policy "family owns self" on families
  for all
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());
