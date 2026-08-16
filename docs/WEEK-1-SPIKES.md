# Week 1 — De-risking Spikes (build/no-build gate)

Purpose: before committing the month, prove the two hard, novel things
(character/style consistency + cross-night memory) and pin the unit economics.
Each spike has a crisp pass bar. If all pass → build. If not → pivot to the
conversation-coach fallback with three weeks to spare.

These are written to be handed directly to Claude Code.

---

## Spike 0 — Scaffolding — PASSED

Expo/Obytes app scaffolded; Supabase wired (schema + RLS + pgvector); both Edge
Functions deployed; health check green across Postgres + Claude + Gemini,
server-side keys only.

## Spike A — Character & style consistency — PASSED

**Result:** `gemini-2.5-flash-image` (Nano Banana) held identity across 3 scenes
at **$0.039/image, ~9s**; no drift, so no escalation to Pro and no Flux touch-up
needed. Grid: `docs/spikes/spike-a/nano-banana/grid.png`.

**Key finding — over-preservation:** the model prioritizes identity over
instructions, so it won't change wardrobe on request. Fix adopted (ADR-0001):
split the character reference into **locked identity** vs **per-scene wardrobe**;
generation emits a `wardrobe` per page. Built into Week 2's illustration step.

## Spike B — Cross-night memory (the moat) — bilingual

**Goal:** chapter 2 continues an open thread from chapter 1, sourced from the DB
(**not** the model's context window), rendered **natively in both English and
Korean**, page-aligned.

**Build:**
- Move `generate-chapter` + Supabase types to the new `chapters.pages` shape
  (`[{page, en, ko, scene, wardrobe, image_path}]`) and the bilingual output
  contract in `docs/prompts/story-generation.md`.
- Generation: retrieve canon (recent summaries + open threads + characters) →
  Claude returns `{title_en, title_ko, summary, pages[], delta}` → validate →
  persist → embed the (English) summary.

**Deliverable:** a script that generates chapter 1 opening a thread (e.g. "the
little lantern that wouldn't light"), then — fresh process, no chat history —
generates chapter 2 that advances/resolves it using only DB-retrieved canon,
with both `en` and `ko` present and aligned.

**Pass bar:** continuity is specific and correct (names the lantern, the promise,
the companion) in **both languages**, and the Korean reads naturally (a native
speaker would not call it translationese). Prove by clearing context between runs.

## Spike C — Unit economics (decide price)

**Goal:** real `$/chapter` + latency. Spike A gives image cost ($0.039/image on
Nano Banana; ~$0.20 + ~44s for a 5-page chapter, pages parallelizable). Add LLM
tokens for the bilingual text. Compute break-even vs a candidate price; set the
free-tier chapter limit.

**Pass bar:** healthy gross margin at a believable consumer price, with a
free-tier limit that still lets a family fall in love before paying.

## Spike D — Safety (small but required)

**Goal:** confirm age-appropriate output on sensitive prompts (a scary topic, a
medical visit, a death in the family) in **both languages**, and wire the
**parent-preview gate**.

**Pass bar:** sensitive prompts produce gentle, age-appropriate chapters in EN
and KO; nothing reaches the child view without passing the filter + (v1) parent
preview.

---

## Gate decision (end of week 1)

| Spike | Pass bar | Result | Evidence |
|---|---|---|---|
| A — consistency | Parent accepts same character across ≥3 scenes | ☑ passed | [`spike-a/`](spikes/spike-a/) |
| B — memory | Ch.2 continues Ch.1 thread from DB, both languages | ☐ **awaiting native KO read** | [`spike-b/`](spikes/spike-b/) |
| C — economics | Healthy margin at believable price | ☐ **awaiting shape decision** | [`spike-c/`](spikes/spike-c/) |
| D — safety | Sensitive prompts safe (EN+KO); parent gate works | ☐ **awaiting second read** | [`spike-d/`](spikes/spike-d/) |

B, C and D all met their bars on my assessment; each is left unticked because it
needs a human the code cannot substitute for (`docs/KICKOFF.md` §5):

- **B** — chapter 2 continued the lantern threads from Postgres alone, with
  specific correct detail, in both languages. Needs a **native Korean speaker**
  to confirm it reads naturally rather than as good translationese.
- **C** — 54% worst-case / 72% typical margin at **$12.99/mo with 3 free
  chapters**, but only at **6 pages / 3 illustrations** and a 20-chapter cap.
  The 8-page/8-image chapter Spike B generates loses money at every believable
  price. Chapter shape is a product decision, not a technical one.
- **D** — 3/3 sensitive topics safe, 2/2 unsafe fixtures blocked (including a
  Korean-only hazard), gate verified fail-closed. The filter's call on the
  death-in-the-family chapter deserves a **second human read**; I agree with it,
  but nobody else has looked.

All four ☑ → proceed to Week 2 (core loop). Any ✗ that can't be fixed in a day
→ invoke the conversation-coach pivot (see `docs/RESEARCH.md §6`).
