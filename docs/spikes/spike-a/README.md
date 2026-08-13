# Spike A — character & style consistency

Status: **RUN on Nano Banana (`gemini-2.5-flash-image`).** My assessment: the
pass bar is met. The formal tick is Jai's call — `docs/KICKOFF.md` §5 makes
"eyeball the grid, is it the same kid?" a human checkpoint, so the gate box in
`docs/WEEK-1-SPIKES.md` is deliberately left unticked here.

**→ [`nano-banana/grid.png`](nano-banana/grid.png)** is the deliverable.

| | |
|---|---|
| Model | `gemini-2.5-flash-image` (Nano Banana) |
| Images | 4 (1 reference sheet + 3 scenes) |
| Cost | **$0.0391/image**, $0.157 for the set |
| Latency | **8.8s/image** (7.7–9.5s) |
| Escalation to Pro | **not triggered** — no meaningful drift |
| Flux Kontext | **not exercised** — nothing needed correcting |

Per-image detail: [`nano-banana/costs.md`](nano-banana/costs.md). Raw records:
`nano-banana/metrics.jsonl`.

## Verdict

Identity holds across all three scenes. Skin tone, the two hair puffs, the round
yellow glasses, the red boots, the striped tights and the polka-dot dress all
carry over; Pip stays the same teal owl in the same orange scarf. The gouache
style, palette and paper grain are stable page to page. A parent would read this
as the same child.

Because there was no drift, the escalation to `gemini-3-pro-image` was not
triggered, and Flux Kontext was never needed. Nano Banana is the phase-1 winner
on quality × cost × latency unless the Pro comparison below changes the picture.

## The finding that matters most: over-preservation

The swim-lesson prompt asked for Mia **in a swimsuit**, with her red boots set
aside on the tiles. The model kept the dress *and* the boots on her and painted a
second pair of boots beside her. It resolved the conflict between "preserve
identity" and "change the wardrobe" in favour of identity, every time.

That is the right failure direction for consistency, but it is a real product
constraint: **the identity lock currently overrides scene-appropriate wardrobe.**
A bedtime product will need pyjamas, swimwear, raincoats, dress-up. Options,
untested so far:

1. Split the reference into *identity* (face, hair, glasses, skin) and *wardrobe*
   (outfit), and state explicitly which may change.
2. Generate the scene, then use **Flux Kontext** for a targeted wardrobe edit —
   the tool Spike A earmarked for exactly this, still unexercised.
3. Keep a small set of per-outfit reference sheets and pick one per scene.

Worth resolving before Week 2 commits to a scene format.

## Smaller observations

- **Pip's scale drifts.** He is roughly teapot-sized against the reference, but
  noticeably larger at the breakfast table. Prompt an absolute size cue if it
  matters.
- **Mia's glasses grow slightly** in the breakfast scene; the face underneath is
  unchanged.
- **The reference sheet is internally inconsistent**: the close-up wears a
  terracotta sweater while the two full-body views wear the polka-dot dress. The
  scenes followed the dress. Worth pinning the outfit in the sheet prompt.
- **The model invented the outfit** (cream dress, sage dots, striped tights) — it
  was never specified. That made the test harder, not easier: it had to preserve
  a detail nobody described.

## Not done

- **`gemini-3-pro-image` (Nano Banana Pro) comparison.** Instruction was to
  escalate only on drift; there was none, so no money was spent on it. At
  $0.134/image it is ~3.4× Nano Banana. Running the same 4 prompts costs ~$0.54
  and would quantify the quality gap — recommended before locking phase 1.
- **Path 2 (open weights: Flux.1-dev + PuLID/InstantID + style LoRA).**
  `REPLICATE_API_TOKEN` is unset. This is the phase-2 cost path in
  `ARCHITECTURE.md` §2 and still needs its own spike.
- **Multi-page style coherence.** Three scenes is the stated bar; a real chapter
  is 5–8 pages. Consistency across a full chapter is untested.

## Reproducing

From this directory. Reads Supabase creds from the repo `.env` and calls the
`spike-a` Edge Function, which holds the Gemini key server-side.

```bash
python3 step1_reference.py                      # lock the character sheet
python3 step2_scenes.py                         # render the three scenes
python3 build_grid.py nano-banana               # grid.png + costs.md
```

Switch models with `SPIKE_A_MODEL=gemini-3-pro-image` — outputs go to a separate
directory, so runs never overwrite each other.

```bash
SPIKE_A_MODEL=gemini-3-pro-image python3 step1_reference.py
SPIKE_A_MODEL=gemini-3-pro-image python3 step2_scenes.py
python3 build_grid.py nano-banana-pro
```

## Method

- One locked reference sheet, then every scene conditioned on it with an
  identical identity-preservation block.
- `step1_reference.py` holds `STYLE`, `MIA` and `PIP`, pasted verbatim into every
  later prompt. If that wording drifts, the character drifts, and the spike stops
  measuring what it claims to.
- The reference image is attached **before** the instruction text; leading with
  the prompt tends to yield a fresh character instead of a re-render.
- Test child is fictional and prompt-described — no real photo, per the v1
  decision.

## For Spike C

$0.0391/image and 8.8s at 1290 output tokens per image, flat regardless of
prompt size (input tokens are ~0.5% of cost). A 5-page illustrated chapter is
therefore **~$0.20 and ~44s of image time**, before text generation. Latency is
sequential here; the pages of one chapter are independent and could be
parallelised.
