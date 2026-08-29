-- 0009_privacy_consent.sql
-- Explicit parental consent to the privacy/AI-disclosure notice (issue #12).
--
-- Korea PIPA requires separate, explicit consent for processing a child's
-- personal data, and a plain "we created your account" event does not carry
-- that meaning. So this is its own row, recorded at the moment a parent
-- actually agrees to the notice (`docs/privacy/`) in `child-setup-screen.tsx`
-- — not a boolean flag on `families`, and not inferred from anything else.
--
-- A row per consent event, not a single mutable flag, so that a later
-- revision of the disclosure text can ask again without destroying the
-- record of what was agreed to the first time (README.md in docs/privacy/).
--
-- NOTE: numbered 0009, not 0007/0008 — those are already claimed by two
-- other in-flight branches (#28 concierge print, #29 generation quota) that
-- have not merged to main yet. Whichever of those lands first will likely
-- force a renumber of the others; that is a merge-order problem for
-- whoever's still open at that point, not something this migration can fix.

create table if not exists privacy_consents (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references families(id) on delete cascade,
  policy_version  text not null,
  consented_at    timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists idx_privacy_consents_family
  on privacy_consents (family_id, policy_version);

comment on table privacy_consents is
  'One row per parent consent to a version of the privacy/AI-disclosure '
  'notice (issue #12, docs/privacy/). Append-only — there is no update or '
  'delete policy, because consent is a record of what happened, not a '
  'value to edit.';

-- --------------------------------------------------------------------------
-- RLS: a parent may see and record consent for their own family only, same
-- "own X" shape as `children` in 0000_baseline.sql. No client-supplied
-- family_id is ever trusted on its own — the WITH CHECK re-derives ownership
-- from auth.uid() via `families`, exactly like the "own children" policy.
-- --------------------------------------------------------------------------
alter table privacy_consents enable row level security;

drop policy if exists "own privacy consents" on privacy_consents;
create policy "own privacy consents" on privacy_consents
  for select using (
    family_id in (select id from families where auth_user_id = auth.uid())
  );

drop policy if exists "consent for own family" on privacy_consents;
create policy "consent for own family" on privacy_consents
  for insert with check (
    family_id in (select id from families where auth_user_id = auth.uid())
  );
