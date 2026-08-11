# Week 1 — De-risking Spikes (build/no-build gate)

Purpose: before committing the month, prove the two hard, novel things
(character/style consistency + cross-night memory) and pin the unit economics.
Each spike has a crisp pass bar. If all pass → build. If not → pivot to the
conversation-coach fallback with three weeks to spare.

These are written to be handed directly to Claude Code.

---

## Spike 0 — Scaffolding (half day)

- Init app from the **Obytes MIT starter** (Expo Router, TS, NativeWind, React
  Query, Zustand). Strip modules we don't need.
- Create a **Supabase** project. Enable **pgvector**.
- Stand up a thin server layer (Supabase Edge Functions) so all provider keys
  live server-side. Add `.env.example`.
- **Done when:** app boots on Android emulator; a server function can call
  Claude + an image API with server-side keys.

## Spike A — Character & style consistency (the #1 risk)

**Goal:** render the same child + one recurring companion across **≥3 separate
scenes**, in a single consistent storybook style, at parent-acceptable quality.

**Path 1 — APIs (fast):** Nano Banana Pro 2. Lock a "character sheet" reference
(front + 3/4 + one expression), reuse it in every scene with an explicit
identity-preservation prompt; use Flux Kontext for targeted edits (scene/outfit
changes that must not drift the face).

**Path 2 — Open weights (cheap, for phase 2):** a ComfyUI workflow with
**Flux.1-dev + PuLID or InstantID** (face identity) **+ a fixed storybook style
LoRA** (house art style), run on serverless GPU (Replicate / Modal / RunPod).

**Deliverable:** for each path, a grid of the same character in 3–5 scenes.
Compare on quality × $/image × latency. Pick the phase-1 winner.

**Pass bar:** a parent would accept the character as "the same kid"; outfit and
face stable; style consistent page to page.

## Spike B — Cross-night memory (the moat)

**Goal:** chapter 2 continues an open thread from chapter 1, sourced from the DB,
**not** from the model's context window.

**Build:**
- Minimal Story Bible schema: `children`, `characters`, `threads`, `chapters`
  (with `embedding` via pgvector), `world`.
- Generation function: retrieve canon (recent summaries + open threads +
  referenced characters) → Claude returns `{ chapter_text, summary, delta }`
  where `delta` is strict JSON (new/updated characters, threads opened/resolved).
- Validate `delta` against a schema; persist; embed the summary.

**Deliverable:** a script that generates chapter 1 which *opens* a thread (e.g.
"the little lantern that wouldn't light"), then — as a fresh session, no chat
history — generates chapter 2 that advances/resolves that thread using only what
was retrieved from the DB.

**Pass bar:** continuity is specific and correct (names the lantern, the promise,
the companion), not vague. Prove it by clearing the context window between runs.

## Spike C — Unit economics (decide price)

**Goal:** real `$/chapter` for both image paths + latency.

**Measure:** images/chapter × cost/image + LLM tokens; end-to-end generation
time; then compute break-even vs. a candidate monthly subscription price and set
the free-tier chapter limit.

**Pass bar:** healthy gross margin at a believable consumer price, with a
free-tier limit that still lets a family fall in love before paying.

## Spike D — Safety (small but required)

**Goal:** confirm age-appropriate output on sensitive prompts (a scary topic, a
medical visit, a death in the family) and wire the **parent-preview gate**.

**Build:** content filter + a "parent reviews before child sees it" step for v1.

**Pass bar:** sensitive prompts produce gentle, age-appropriate chapters; nothing
reaches the child view without passing the filter + (v1) parent preview.

---

## Gate decision (end of week 1)

| Spike | Pass bar | Result |
|---|---|---|
| A — consistency | Parent accepts same character across ≥3 scenes | ☐ |
| B — memory | Ch.2 continues Ch.1 thread from DB, context cleared | ☐ |
| C — economics | Healthy margin at believable price | ☐ |
| D — safety | Sensitive prompts safe; parent gate works | ☐ |

All four ☑ → proceed to Week 2 (core loop). Any ✗ that can't be fixed in a day
→ invoke the conversation-coach pivot (see `docs/RESEARCH.md §6`).
