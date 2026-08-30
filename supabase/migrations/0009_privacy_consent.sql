-- 0009_privacy_consent.sql
-- Privacy disclosure + Korea PIPA consent (issue #12, issue #22 hardening).
--
-- Numbered 0009, not 0008: 0007 is print_orders (#28, merged). 0008 is
-- claimed by the in-flight generation-quota branch (issue #6, not yet
-- merged) -- picking 0009 avoids a collision; whichever of the two merges
-- second may still need a manual renumber.
--
-- A column on the existing `families` row, not a new table: consent is a
-- fact about the account, not a repeating event we need history for yet, and
-- the driver's instructions for this slice were explicit not to invent a
-- table if a column will do. `privacy_consent_version` records exactly which
-- revision of docs/privacy-policy.md the parent agreed to, so a later policy
-- change can tell who has and hasn't re-consented.

alter table families
  add column if not exists privacy_consent_version text,
  add column if not exists privacy_consented_at timestamptz;

comment on column families.privacy_consent_version is
  'Version identifier of docs/privacy-policy.md the parent agreed to at '
  'child setup (issue #12). Null means no recorded consent -- either a '
  'family created before this migration, or a failed/incomplete setup.';

comment on column families.privacy_consented_at is
  'When privacy_consent_version was agreed to. Proof-of-consent timestamp, '
  'not a UI gate by itself -- see src/lib/supabase/onboarding.ts.';

-- No RLS change needed: the existing "family owns self" policy (0000_baseline.sql)
-- is `for all` on the whole families row, so these two columns are already
-- covered -- a parent can read/update only their own family's consent record.
