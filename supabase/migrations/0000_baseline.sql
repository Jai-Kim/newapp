-- 0000_baseline.sql
-- The Story Bible schema and its RLS policies: everything 0001 onward alters.
--
-- This was two hand-applied files (schema.sql, policies.sql) sitting outside
-- migrations/, which meant the migration chain was not self-contained: the
-- Supabase CLI applies migrations/ when it initialises a database, so
-- `supabase start` reached 0001_bilingual.sql — `alter table chapters ...` —
-- before anything had created `chapters`, and died. Every CI run on the
-- stubbed E2E workflow failed there, before a single test ran.
--
-- Keeping the baseline in the chain means one command builds the database from
-- nothing, in order, with no README step anyone can miss.
--
-- Both halves are idempotent (`create table if not exists`, `drop policy if
-- exists` before each create), so applying this to a project that already has
-- the schema is a no-op rather than an error.

-- ===========================================================================
-- Schema
-- ===========================================================================

-- Storyloom — Story Bible schema (the persistent-memory moat)
-- The baseline every numbered migration below it builds on.
-- Embedding dimension below assumes a 1536-dim model; change if you pick another.
-- Bilingual (EN+KO) is built in: chapters store page-aligned dual-language content.

create extension if not exists vector;

-- Parent account. Owns all data + billing.
create table if not exists families (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users(id) on delete cascade,
  display_name  text,
  created_at    timestamptz not null default now()
);

-- The child hero. Minimal PII by design (first name + age band only).
create table if not exists children (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references families(id) on delete cascade,
  first_name        text not null,
  age_band          text not null check (age_band in ('3-4','5-6','7-8')),
  primary_language  text not null default 'en' check (primary_language in ('en','ko')),
  character_ref     jsonb,       -- { identity: {image_path, descriptor}, wardrobe_default: text }
  interests         text[],
  created_at        timestamptz not null default now()
);

-- Recurring cast (companions, side characters).
create table if not exists characters (
  id                    uuid primary key default gen_random_uuid(),
  child_id              uuid not null references children(id) on delete cascade,
  name                  text not null,
  role                  text,
  traits                text,
  visual_ref            jsonb,   -- { identity: {image_path, descriptor} } (locked)
  first_appeared_chapter int,
  created_at            timestamptz not null default now()
);

-- Places, objects, lore that persist across chapters.
create table if not exists world (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references children(id) on delete cascade,
  name         text not null,
  type         text,            -- place | object | lore
  description  text,
  visual_ref   jsonb,
  created_at   timestamptz not null default now()
);

-- Open narrative arcs & promises. THE 'Captain Elephant promised to return' table.
create table if not exists threads (
  id                uuid primary key default gen_random_uuid(),
  child_id          uuid not null references children(id) on delete cascade,
  summary           text not null,
  status            text not null default 'open' check (status in ('open','resolved')),
  opened_chapter    int,
  resolved_chapter  int,
  created_at        timestamptz not null default now()
);

-- The chapters themselves. Dual-language, page-aligned. summary + embedding power retrieval.
create table if not exists chapters (
  id            uuid primary key default gen_random_uuid(),
  child_id      uuid not null references children(id) on delete cascade,
  number        int not null,
  title_en      text,
  title_ko      text,
  lesson        text,
  situation     text,
  pages         jsonb not null,  -- [{page, en, ko, scene, wardrobe, image_path}]
  summary       text not null,   -- English canonical, for retrieval + embedding
  embedding     vector(1536),
  created_at    timestamptz not null default now(),
  unique (child_id, number)
);

-- Log of lessons/situations covered (avoid repetition; show parent progress).
create table if not exists lessons_taught (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid not null references children(id) on delete cascade,
  lesson      text not null,
  chapter_id  uuid references chapters(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Indexes for retrieval.
create index if not exists idx_chapters_child_number on chapters (child_id, number desc);
create index if not exists idx_threads_child_status  on threads (child_id, status);
create index if not exists idx_characters_child       on characters (child_id);
create index if not exists idx_world_child             on world (child_id);
-- Semantic search over past chapters (approximate nearest neighbour).
create index if not exists idx_chapters_embedding
  on chapters using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- RLS: enable and restrict every row to the owning family. Full child-ownership
-- policies live in policies.sql (applied separately).
alter table families       enable row level security;
alter table children       enable row level security;
alter table characters     enable row level security;
alter table world          enable row level security;
alter table threads        enable row level security;
alter table chapters       enable row level security;
alter table lessons_taught enable row level security;

create policy "family owns self" on families
  for all using (auth_user_id = auth.uid());

create policy "own children" on children
  for all using (family_id in (select id from families where auth_user_id = auth.uid()));

-- NOTE: characters, world, threads, chapters, lessons_taught child-ownership
-- policies are in policies.sql.

-- ===========================================================================
-- Policies
-- ===========================================================================

-- Storyloom — RLS policies for the child-scoped Story Bible tables.
--
-- schema.sql enables RLS on every table and defines policies for `families` and
-- `children`, then leaves this NOTE:
--   "repeat an equivalent child-ownership policy for characters, world,
--    threads, chapters, lessons_taught (join child_id -> children -> families)"
-- This section is that repeat, and must follow the schema section above.
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
