-- 0005_nightly_queue.sql
-- Pre-generation, so bedtime is instant (issue #9).
--
-- A chapter takes ~93s to write plus ~9s per illustration. No tired parent
-- watches that at 8pm, and if Anthropic or Gemini is down at 8pm there is no
-- bedtime story at all. So the work moves off the bedtime path entirely: the
-- parent chooses what TOMORROW is about at the end of tonight's read, a job is
-- queued, and the chapter is written, illustrated and waiting for review long
-- before it is needed.
--
-- Moving the lesson choice to the end of the previous night is not a
-- workaround — it is what makes pre-generation possible at all. You cannot
-- pre-generate a chapter whose subject is chosen at the moment it is wanted.

-- --------------------------------------------------------------------------
-- Reading state. "Tonight's chapter" is the oldest approved chapter nobody has
-- read yet, so the reader needs somewhere to record that it was read.
-- --------------------------------------------------------------------------
alter table chapters add column if not exists read_at timestamptz;

comment on column chapters.read_at is
  'Set when the family finishes reading. Drives which chapter is "tonight".';

create index if not exists idx_chapters_unread
  on chapters (child_id, number)
  where review_status = 'approved' and read_at is null;

-- The view is what child-facing screens read, so read_at has to surface there
-- too or the reader cannot tell what it has already been through.
create or replace view child_readable_chapters as
select
  id, child_id, number, title_en, title_ko, lesson, situation, pages, summary,
  created_at, reviewed_at, read_at
from chapters
where review_status = 'approved'
  and coalesce(safety ->> 'verdict', 'unknown') = 'safe';

alter view child_readable_chapters set (security_invoker = on);

-- --------------------------------------------------------------------------
-- The queue.
-- --------------------------------------------------------------------------
create table if not exists chapter_queue (
  id            uuid primary key default gen_random_uuid(),
  child_id      uuid not null references children(id) on delete cascade,

  -- What tomorrow is about. Chosen by the parent at the end of tonight's read,
  -- or filled in by the auto-picker when they skipped that step.
  lesson        text not null,
  situation     text,
  auto_chosen   boolean not null default false,

  status        text not null default 'queued'
                  check (status in ('queued','running','done','failed')),
  attempts      int  not null default 0,
  error         text,
  chapter_id    uuid references chapters(id) on delete set null,

  -- The authorization record. A job is created by a request that proved the
  -- caller owns this child; the worker then runs under the service role and
  -- trusts the row, because there is no user session in a background task.
  requested_by  uuid references auth.users(id) on delete set null,

  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz
);

-- At most one live job per child. Generation costs real money at two paid
-- providers, so a double-tap, a retry, or two devices must not buy two
-- chapters — the second insert fails rather than quietly spending.
create unique index if not exists uniq_chapter_queue_active
  on chapter_queue (child_id)
  where status in ('queued', 'running');

create index if not exists idx_chapter_queue_pending
  on chapter_queue (status, created_at)
  where status in ('queued', 'running');

comment on table chapter_queue is
  'Pre-generation jobs. One live job per child; the row is also the '
  'authorization record the background worker runs on (issue #9).';

-- --------------------------------------------------------------------------
-- RLS: a parent can see and create jobs for their own children, and nothing
-- else. Only the worker (service role) may move a job through its states, so
-- a client cannot mark a job done or reset one to replay generation.
-- --------------------------------------------------------------------------
alter table chapter_queue enable row level security;

drop policy if exists "own chapter queue" on chapter_queue;
create policy "own chapter queue" on chapter_queue
  for select using (
    child_id in (
      select c.id from children c
      join families f on f.id = c.family_id
      where f.auth_user_id = auth.uid()
    )
  );

drop policy if exists "queue own child" on chapter_queue;
create policy "queue own child" on chapter_queue
  for insert with check (
    child_id in (
      select c.id from children c
      join families f on f.id = c.family_id
      where f.auth_user_id = auth.uid()
    )
    -- A client may only ever create work, never pre-declare it finished.
    and status = 'queued'
    and attempts = 0
    and chapter_id is null
  );

-- --------------------------------------------------------------------------
-- Marking a chapter read. A plain UPDATE would let a client set read_at on a
-- chapter it cannot otherwise touch, so this goes through a function that runs
-- as the caller and can only ever stamp the one column.
-- --------------------------------------------------------------------------
create or replace function mark_chapter_read(p_chapter_id uuid)
returns chapters
language plpgsql
security invoker              -- RLS decides ownership, same as approve_chapter
as $$
declare
  result chapters;
begin
  update chapters
     set read_at = coalesce(read_at, now())   -- re-reads keep the first time
   where id = p_chapter_id
     and review_status = 'approved'
  returning * into result;

  if result.id is null then
    raise exception 'chapter not found, not yours, or not approved';
  end if;
  return result;
end;
$$;

comment on function mark_chapter_read is
  'Stamps read_at once. SECURITY INVOKER so RLS decides ownership.';
