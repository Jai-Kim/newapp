-- 0001_bilingual.sql
-- Adds dual-language (English + Korean) page-aligned content to chapters.
-- Safe on the existing project: chapters is empty, so the column drops lose no
-- data. Run in the Supabase SQL editor AFTER schema.sql + policies.sql.

alter table chapters add column if not exists title_en text;
alter table chapters add column if not exists title_ko text;
alter table chapters add column if not exists pages jsonb;

-- Superseded by title_en/title_ko + pages. Empty table, so safe to drop.
alter table chapters drop column if exists title;
alter table chapters drop column if exists body;
alter table chapters drop column if exists illustrations;

-- Which language leads on the page for this child (both always shown).
alter table children
  add column if not exists primary_language text not null default 'en'
  check (primary_language in ('en','ko'));

comment on column chapters.pages is
  'Page-aligned bilingual content: [{page, en, ko, scene, wardrobe, image_path}]';
comment on column chapters.summary is
  'English canonical summary; used for retrieval + embedding (language-agnostic).';
