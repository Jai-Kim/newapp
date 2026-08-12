-- Storyloom — Story Bible schema (the persistent-memory moat)
-- Run in the Supabase SQL editor (or via the CLI) on a fresh project.
-- Embedding dimension below assumes a 1536-dim model; change if you pick another.

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
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references families(id) on delete cascade,
  first_name     text not null,
  age_band       text not null check (age_band in ('3-4','5-6','7-8')),
  character_ref  jsonb,          -- locked character sheet: {image_path, descriptor}
  interests      text[],
  created_at     timestamptz not null default now()
);

-- Recurring cast (companions, side characters).
create table if not exists characters (
  id                    uuid primary key default gen_random_uuid(),
  child_id              uuid not null references children(id) on delete cascade,
  name                  text not null,
  role                  text,
  traits                text,
  visual_ref            jsonb,   -- locked reference: {image_path, descriptor}
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

-- The chapters themselves. summary + embedding power retrieval.
create table if not exists chapters (
  id            uuid primary key default gen_random_uuid(),
  child_id      uuid not null references children(id) on delete cascade,
  number        int not null,
  title         text,
  lesson        text,
  situation     text,
  body          text not null,
  summary       text not null,
  embedding     vector(1536),
  illustrations jsonb,          -- [{page, image_path, prompt}]
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

-- RLS: enable and restrict every row to the owning family. Policies below are a
-- starting point; Claude Code should verify against Supabase auth in Spike 0.
alter table families       enable row level security;
alter table children       enable row level security;
alter table characters     enable row level security;
alter table world          enable row level security;
alter table threads        enable row level security;
alter table chapters       enable row level security;
alter table lessons_taught enable row level security;

create policy "family owns self" on families
  for all using (auth_user_id = auth.uid());

-- Child-scoped tables: allow when the child belongs to the caller's family.
create policy "own children" on children
  for all using (family_id in (select id from families where auth_user_id = auth.uid()));

-- NOTE: repeat an equivalent child-ownership policy for characters, world,
-- threads, chapters, lessons_taught (join child_id -> children -> families).
-- Left explicit for Claude Code to generate + test in Spike 0.
