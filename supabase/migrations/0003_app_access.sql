-- 0003_app_access.sql
-- Lets the app actually read its own data once a parent is signed in.
--
-- Two gaps blocked the reader and review screens:
--   1. Illustrations live in a private Storage bucket with no read policy, so
--      even a signed-in parent could not create a signed URL for their own
--      child's pictures.
--   2. Nothing linked a Supabase auth user to a family, so RLS (which keys off
--      families.auth_user_id) matched nothing.

-- --------------------------------------------------------------------------
-- Storage: a parent may read illustrations for their own children only.
-- Object paths are '<child_id>/ch<n>/p<n>.png', so the first path segment is
-- the child id and can be joined back to the family.
-- --------------------------------------------------------------------------
drop policy if exists "own child illustrations" on storage.objects;
create policy "own child illustrations" on storage.objects
  for select using (
    bucket_id = 'illustrations'
    and (storage.foldername(name))[1]::uuid in (
      select c.id from children c
      join families f on f.id = c.family_id
      where f.auth_user_id = auth.uid()
    )
  );

-- Character reference sheets, same rule but keyed by the child's own ref path.
drop policy if exists "own character refs" on storage.objects;
create policy "own character refs" on storage.objects
  for select using (
    bucket_id = 'character-refs'
    and exists (
      select 1 from children c
      join families f on f.id = c.family_id
      where f.auth_user_id = auth.uid()
        and c.character_ref -> 'identity' ->> 'image_path' = 'character-refs/' || name
    )
  );

-- --------------------------------------------------------------------------
-- The parent gate needs an UPDATE path. schema.sql's "family owns self" and
-- policies.sql's child-scoped policies cover chapters via child ownership, so
-- a parent can already update their own chapters — but only these three
-- columns should ever be settable from the client. Everything else about a
-- chapter is written server-side by generate-chapter under the service role.
-- --------------------------------------------------------------------------
create or replace function approve_chapter(p_chapter_id uuid, p_approved boolean)
returns chapters
language plpgsql
security invoker           -- runs as the caller, so RLS still applies
as $$
declare
  result chapters;
begin
  update chapters
     set review_status = case when p_approved then 'approved' else 'rejected' end,
         reviewed_at   = now()
   where id = p_chapter_id
     -- A blocked chapter can never be approved, whatever the client sends.
     and coalesce(safety ->> 'verdict', 'unknown') <> 'blocked'
  returning * into result;

  if result.id is null then
    raise exception 'chapter not found, not yours, or blocked by the content filter';
  end if;
  return result;
end;
$$;

comment on function approve_chapter is
  'Parent-preview gate write path. SECURITY INVOKER so RLS decides ownership; '
  'refuses to approve anything the content filter blocked.';

-- --------------------------------------------------------------------------
-- Claim helper for the spike data. The families/children seeded during Spikes
-- B-D have auth_user_id = null, so they belong to nobody and are invisible to
-- every signed-in user. This lets the first real account adopt them once.
-- Dev affordance — drop it before there is more than one family.
-- --------------------------------------------------------------------------
create or replace function claim_orphan_families()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update families set auth_user_id = auth.uid()
   where auth_user_id is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function claim_orphan_families() from public;
grant execute on function claim_orphan_families() to authenticated;

comment on function claim_orphan_families is
  'DEV ONLY: attaches spike-seeded families to the calling account. Remove '
  'before multi-tenant use — it would let any new account adopt orphan data.';
