-- 0002_safety.sql
-- Spike D: content filter verdict + the v1 parent-preview gate.
--
-- The gate is enforced in the database, not in the client. A chapter is only
-- child-readable once BOTH are true: the automated filter passed, and a parent
-- explicitly approved it. Default is pending, so a chapter is invisible to the
-- child view the moment it is written and stays that way until someone says
-- otherwise.

alter table chapters
  add column if not exists safety jsonb;

alter table chapters
  add column if not exists review_status text not null default 'pending'
  check (review_status in ('pending', 'approved', 'rejected'));

alter table chapters
  add column if not exists reviewed_at timestamptz;

comment on column chapters.safety is
  'Content-filter verdict: {verdict, concerns[], checked_languages[], model}. '
  'verdict=blocked means the filter rejected it; the parent never sees it as approvable.';
comment on column chapters.review_status is
  'Parent-preview gate. pending until a parent approves. Child-facing reads MUST '
  'filter on approved — see the child_readable_chapters view.';

-- Parent-review queue: what a parent is being asked to approve.
create index if not exists idx_chapters_review
  on chapters (child_id, review_status, number desc);

-- The ONLY relation a child-facing screen should read. Encodes the gate once,
-- so a forgotten .eq('review_status','approved') in app code cannot leak an
-- unreviewed chapter.
create or replace view child_readable_chapters as
select
  id, child_id, number, title_en, title_ko, lesson, situation, pages, summary,
  created_at, reviewed_at
from chapters
where review_status = 'approved'
  and coalesce(safety ->> 'verdict', 'unknown') = 'safe';

comment on view child_readable_chapters is
  'Approved AND filter-passed chapters only. Child-facing reads use this, never '
  'the chapters table directly (Spike D).';

-- Views run with the querying user's permissions in PG15+ (security_invoker),
-- so the underlying chapters RLS still applies per family.
alter view child_readable_chapters set (security_invoker = on);
