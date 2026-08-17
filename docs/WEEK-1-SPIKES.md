# Week 1 — De-risking Spikes (build/no-build gate)

Purpose: before committing the month, prove the two hard, novel things
(character/style consistency + cross-night memory) and pin the unit economics.
Each spike has a crisp pass bar. If all pass → build. If not → pivot to the
conversation-coach fallback with three weeks to spare.

---

## Spike 0 — Scaffolding — PASSED

Expo/Obytes app scaffolded; Supabase wired (schema + RLS + pgvector); both Edge
Functions deployed; health check green (server-side keys only).

## Spike A — Character & style consistency — PASSED

`gemini-2.5-flash-image` (Nano Banana) held identity across 3 scenes at
**$0.039/image, ~9s**; no drift. Grid: `docs/spikes/spike-a/nano-banana/grid.png`.
Finding: identity/wardrobe split needed (ADR-0001).

## Spike B — Cross-night memory (the moat) — PASSED

Chapter 2 was generated from **DB-retrieved canon only** (no chat history) and
correctly **resolved a chapter-1 thread by its UUID** (the lantern's engraving),
advanced two others (the lantern lighting, Nubi the owl returning), and opened a
new one — rendered in **native English + Korean**, page-aligned, with the Korean
reading naturally. The moat works. Artifacts: `docs/spikes/spike-b/`.

## Spike C — Unit economics — CONDITIONAL (see ADR-0002)

Real cost model built. Illustrations ~70% of COGS; safety ~17% of marginal cost.
An **8-image chapter loses money at every price**. Fix adopted (ADR-0002):
**~4 illustrations/chapter + the open-weights image path**; re-run `cost_model.py`
to confirm positive margin. Passes once the reshaped chapter clears a healthy
margin at a believable price.

## Spike D — Safety — PASSED

Text + **image** safety. `reviewIllustration` runs a vision pass before upload:
blocked nightmare fixtures (gaunt figure, derelict corridor) while correctly
passing the real grief-chapter art; a blocked page degrades to text-only rather
than failing the chapter. Parent-preview gate wired.

---

## Gate decision (end of week 1)

| Spike | Pass bar | Result |
|---|---|---|
| A — consistency | Parent accepts same character across ≥3 scenes | ☑ passed |
| B — memory | Ch.2 continues Ch.1 thread from DB, both languages | ☑ passed |
| C — economics | Healthy margin at believable price | ◐ conditional (ADR-0002) |
| D — safety | Sensitive prompts safe (EN+KO); parent gate works | ☑ passed |

Three of four passed; C passes once the ~4-image reshape lands a positive margin.
On track for Week 2 (core loop).
