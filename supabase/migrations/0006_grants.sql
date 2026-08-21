-- 0006_grants.sql
-- Table privileges for the signed-in app role.
--
-- RLS decides WHICH rows a parent may touch. A GRANT decides whether the role
-- may touch the table at all, and Postgres checks the grant first — so without
-- one, every query fails with "permission denied for table children" before a
-- single policy is consulted.
--
-- The hosted project has had these all along without anyone writing them:
-- Supabase attaches default privileges to tables created through its SQL
-- editor, which is how the schema was first applied. A database built purely
-- from this migration chain gets no such gift, so the app could read its own
-- data in production and not on a fresh database — invisible until CI built
-- one from scratch and the setup gate came back "permission denied for table
-- children".
--
-- Granting explicitly makes the chain portable and the privileges reviewable
-- instead of ambient. Row-level security is enabled on all eight tables, so
-- these grants widen nothing: they are the door, the policies are the lock.
--
-- `anon` is deliberately granted nothing. Nothing is read before sign-in, and
-- the anon key's only job is to reach the auth endpoint.

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete
  on all tables in schema public
  to authenticated, service_role;

-- Same terms for anything a later migration adds, so this does not silently
-- go stale the next time a table appears.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
