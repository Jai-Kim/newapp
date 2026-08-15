# ADR-0001 — Bilingual (EN+KO) from day one, and identity/wardrobe split

Status: accepted · Date: Aug 2026

## Context

Our intended first real user is a Korean-American child (Jai's niece) in a mixed
English/Korean family. Internationalization is far cheaper to design in now than
to retrofit, and it lands before Spike B so the memory + generation core speaks
both languages from the start. Separately, Spike A surfaced that the image model
**over-preserves**: told to change wardrobe (swimsuit), it kept the locked outfit
because it prioritizes identity. A bedtime app needs pyjamas, swimwear, raincoats.

## Decisions

1. **Dual-language on every page.** Each chapter page shows **both English and
   Korean**. Grandparents read Korean, others English, the child absorbs both;
   it also makes the printed keepsake a bilingual heirloom. Stored page-aligned
   in `chapters.pages` = `[{page, en, ko, scene, wardrobe, image_path}]`.
2. **Native Korean, not translation.** The model composes each language natively
   at an age-appropriate, read-aloud reading level; the two versions narrate the
   same events per page. Names/settings stay consistent across languages (deeper
   cultural adaptation — Korean names/foods/settings — is a later option, not v1).
3. **`children.primary_language`** decides which language leads on the page; both
   are always present.
4. **Retrieval stays language-agnostic.** `chapters.summary` + `embedding` are
   English canonical; the model is multilingual, so an English canon reminder
   generates either language fine. Avoids duplicate embeddings.
5. **Identity vs wardrobe split.** The character reference separates **locked
   identity** (face, hair, glasses, skin) from **per-scene wardrobe** (clothing).
   Generation emits a `wardrobe` per page; illustration keeps identity fixed and
   varies wardrobe. Fixes the Spike A over-preservation constraint.

## Consequences

- Image cost is unchanged (illustrations are shared across languages); only story
  text roughly doubles — negligible next to images.
- `generate-chapter` + `src/lib/supabase/types.ts` must move to the new `pages`
  shape (Claude Code updates bindings when wiring Spike B).
- UI uses the existing i18next setup; add a `ko` locale for app chrome.
- Migration `supabase/migrations/0001_bilingual.sql` applies the schema change to
  the existing (empty) project.
