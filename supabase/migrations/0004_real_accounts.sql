-- 0004_real_accounts.sql
-- Week 2 slice 1: real signed-in families.
--
-- Removes the dev affordance that let any new account adopt unowned data, and
-- tightens the two policies onboarding actually writes through.

-- --------------------------------------------------------------------------
-- Drop the claim hack. It existed so a fresh account could adopt the
-- spike-seeded family; with onboarding creating its own family it is now a
-- privilege-escalation path (any new account could take orphaned rows).
--
-- NOTE: this leaves the Week 1 spike rows (auth_user_id IS NULL) owned by
-- nobody and invisible to everyone. They are deliberately NOT deleted — that
-- would be destroying data to tidy up. To attach them to a real account
-- instead, run once, as the owner:
--   update families set auth_user_id = '<uuid>' where auth_user_id is null;
-- --------------------------------------------------------------------------
drop function if exists claim_orphan_families();

-- --------------------------------------------------------------------------
-- Onboarding inserts a family then a child. Both paths already have policies
-- from policies.sql, but neither asserted that a family row cannot be created
-- pointing at somebody else's auth user. Recreate them explicitly so the
-- INSERT path is unambiguous rather than implied by `for all`.
-- --------------------------------------------------------------------------
drop policy if exists "family owns self" on families;
create policy "family owns self" on families
  for all
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

drop policy if exists "own children" on children;
create policy "own children" on children
  for all
  using (family_id in (select id from families where auth_user_id = auth.uid()))
  with check (family_id in (select id from families where auth_user_id = auth.uid()));

-- A family should not be able to accumulate children silently forever; one
-- child is the v1 scope (RISKS marks multi-child P2). Enforced as a trigger
-- rather than a constraint so the message is legible in the app.
create or replace function enforce_one_child_per_family()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from children where family_id = new.family_id) >= 1 then
    raise exception 'v1 supports one child per family'
      using hint = 'Multiple children is tracked as P2 in RISKS.md';
  end if;
  return new;
end;
$$;

drop trigger if exists one_child_per_family on children;
create trigger one_child_per_family
  before insert on children
  for each row execute function enforce_one_child_per_family();

comment on function enforce_one_child_per_family is
  'v1 scope guard. Drop this trigger when multiple children ships (RISKS P2).';
