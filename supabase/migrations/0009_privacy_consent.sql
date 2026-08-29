-- 0009_privacy_consent.sql
-- Issue #12: PIPA requires separate, explicit consent from a parent/guardian
-- to collect a child's personal information — a general Terms agreement is
-- not enough. This records that consent alongside the child it was given for.
--
-- Numbered 0009, not 0007: at the time this was written, 0007 and 0008 were
-- already claimed by two other in-flight branches (concierge print / issue
-- #12's sibling slice, and the generate-chapter rate-limit+quota work) that
-- had not merged to main yet. If either of those lands with a different
-- number, or this one collides on merge, renumber then rather than guessing
-- now.
--
-- Deliberately columns on `children`, not a new table: consent here is
-- 1:1 with the one child a family has (0004_real_accounts.sql's v1 scope
-- guard), so a join table would add nothing. RLS is unchanged — the existing
-- "own children" policy from 0004_real_accounts.sql already governs both
-- columns, since it is `for all` on the whole row.

alter table children
  add column if not exists privacy_consent_version text,
  add column if not exists privacy_consented_at timestamptz;

comment on column children.privacy_consent_version is
  'Which version of docs/legal/privacy-en.md / privacy-ko.md the parent agreed to at child setup (see PRIVACY_NOTICE_VERSION in src/features/legal/privacy-content.ts). Null for children created before this migration.';

comment on column children.privacy_consented_at is
  'When the parent gave that consent. Null for children created before this migration — those families have not yet seen this notice.';
