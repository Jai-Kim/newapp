# ADR-0002 — Chapter economics: fewer illustrations + open-weights image path

Status: accepted · Date: Aug 2026

## Context

Spike C computed real unit costs (correcting an earlier estimate that had guessed
the safety cost). Findings:

- Illustrations are **~70% of COGS**.
- The image-safety review adds **~17%** to marginal cost.
- An **8-page / 8-image** chapter **loses money at every price**, including $19.99
  (3% at a friendly store cut, −18% at the standard 30%).
- The recommended (fewer-image) chapter is ~**$0.303**; 20-chapter margin ~45% at
  a 15% take, ~33% at a 30% store cut.

An 8-image chapter also contradicts `ARCHITECTURE.md` ("3–4 richer images").
Illustrating every page is neither necessary (real picture books don't) nor
affordable.

## Decision

1. **~4 illustrations per chapter**, not one per page. A chapter is 5–8 short
   text pages, of which ~4 carry an illustration; the rest are text-only or share
   a spread. Generation marks which pages are illustrated (the emotional beats).
2. **Pursue the phase-2 open-weights image path** (Replicate: Flux.1-dev +
   InstantID/PuLID + a storybook style) as the primary margin lever, since images
   dominate COGS. Compare cost/image, latency, and consistency vs Nano Banana
   before locking phase 1.
3. **Re-run `cost_model.py`** with the new shape; set the subscription price and
   free-tier chapter limit from a positive-margin result.

## Consequences

- Image COGS roughly halves; the recommended chapter should move clearly into
  positive margin — turning Spike C from conditional into a pass.
- Needs a Spike A “path 2” run (Replicate) — requires `REPLICATE_API_TOKEN`.
- Text stays **bilingual on every page**; only the illustration count drops.
- Slight design nuance: choosing which pages get art.
