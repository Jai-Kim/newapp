# Spike A — character & style consistency

Status: **RUN on both models. Recommendation: Nano Banana (`gemini-2.5-flash-image`) for phase 1.**
My assessment is that the pass bar is met; the formal tick is Jai's call —
`docs/KICKOFF.md` §5 makes "eyeball the grid, is it the same kid?" a human
checkpoint, so the gate box in `docs/WEEK-1-SPIKES.md` is left unticked here.

**Grids:** [`nano-banana/grid.png`](nano-banana/grid.png) ·
[`nano-banana-pro/grid.png`](nano-banana-pro/grid.png)

| | Nano Banana | Nano Banana Pro |
|---|---|---|
| Model | `gemini-2.5-flash-image` | `gemini-3-pro-image` |
| Cost/image | **$0.0391** | $0.1350 (**3.5×**) |
| Latency/image | **8.8s** | 28.4s (**3.2×**) |
| Identity consistency | holds across all 3 scenes | holds across all 3 scenes |
| Art-style adherence | **closer to the gouache brief** | glossier, more rendered |
| Wardrobe change, unaided | ✗ over-preserved | ✓ obeyed first try |
| Wardrobe change, prompted | ✓ (see below) | not tested |
| Scene richness | simpler | more detail, more incidental cast |

Per-image detail: [`nano-banana/costs.md`](nano-banana/costs.md) ·
[`nano-banana-pro/costs.md`](nano-banana-pro/costs.md).

## Recommendation: Nano Banana

Both models hold identity across all three scenes, and both are parent-acceptable.
Pro is the better *illustration* — richer backgrounds, other children at the
poolside, more legible facial acting. But:

1. **Flash matched the specified art style better.** The brief asked for soft
   gouache with visible paper grain and no hard outlines. Flash delivered that;
   Pro rendered something glossier and more three-dimensional. For a house style
   that has to hold across hundreds of pages, matching the brief matters more
   than raw polish.
2. **Pro's one real advantage is obtainable on Flash for free.** Pro obeyed the
   swimsuit instruction unaided where Flash over-preserved — but explicit
   identity/wardrobe prompting fixes Flash completely (below), at no extra cost.
3. **3.5× cost, 3.2× latency.** Per 8-page chapter that is $0.31 vs $1.08 of
   images, and ~70s vs ~227s. On a nightly product that difference compounds
   every night, per child.

Pro is worth keeping in mind as a premium tier — e.g. re-rendering a chapter at
Pro quality for the printed keepsake volume, where it is a one-off cost per
book rather than per night.

## The wardrobe split works (ADR-0001 §5, now verified)

Spike A's original finding was **over-preservation**: told to put Mia in a
swimsuit, Flash kept the dress and boots and painted a spare pair beside her. It
resolved "preserve identity" vs "change wardrobe" in favour of identity, every
time. ADR-0001 §5 asserted that separating locked identity from per-scene
wardrobe would fix this, and baked that into the schema —
`children.character_ref` and `chapters.pages[].wardrobe` — before it was tested.

It is now tested. [`nano-banana/04-wardrobe-swimsuit.png`](nano-banana/04-wardrobe-swimsuit.png),
same reference sheet, same scene, prompt restructured to name which parts of the
reference are identity and which are wardrobe to be replaced:

> PRESERVE EXACTLY (this is her identity, it never changes): face shape and warm
> brown skin tone; two round hair puffs; round yellow glasses …
> DO NOT COPY (this is wardrobe — it MUST change per scene): the cream polka-dot
> dress; the striped tights; the red rain boots. Ignore the clothing in the
> reference entirely. Reproducing the reference outfit is a failure.

Result: turquoise one-piece swimsuit, bare arms and legs, bare feet, towel over
the shoulder — and the red boots sitting **empty on the tiles behind her**, as
instructed. Face, hair, glasses and skin tone unchanged; Pip unchanged.

**The mechanism works, and it works by prompting alone** — no separate
identity-only reference asset is needed, so `character_ref.identity` can keep
pointing at a normal character sheet. That was the open risk in the ADR and it is
closed. Run it with `python3 step3_wardrobe.py`.

## Smaller observations

- **Pip's scale drifts** on Flash — roughly teapot-sized against the reference,
  noticeably larger at the breakfast table. Prompt an absolute size cue if it
  matters.
- **The Flash reference sheet is internally inconsistent**: its close-up wears a
  terracotta sweater while the full-body views wear the polka-dot dress. The
  scenes followed the dress. Worth pinning the outfit in the sheet prompt — or,
  given the split above, deliberately rendering the sheet in neutral clothing.
- **Both models invented the outfit** (never specified), which made the
  consistency test harder rather than easier: they had to preserve a detail
  nobody described.
- **Pro reinterprets the character design** — sage pinafore over a striped top,
  red hair bows — rather than inheriting Flash's. The two models are not
  interchangeable mid-series; switching would visibly change the child.

## Not done

- **Path 2 (open weights: Flux.1-dev + PuLID/InstantID + style LoRA).**
  `REPLICATE_API_TOKEN` is unset. This is the phase-2 cost path in
  `ARCHITECTURE.md` §2 and still needs its own spike.
- **Wardrobe split on Pro.** Untested — Pro obeyed the plain instruction, so the
  explicit split was never needed there.
- **Multi-page style coherence.** Three scenes is the stated bar; a real chapter
  is 5–8 pages, and Spike B now generates 8. Consistency across a full chapter is
  untested.
- **Flux Kontext.** Never exercised — nothing drifted enough to need correcting.

## Reproducing

```bash
python3 step1_reference.py            # lock the character sheet
python3 step2_scenes.py               # three scenes from that sheet
python3 step3_wardrobe.py             # identity/wardrobe split test
python3 build_grid.py nano-banana     # grid.png + costs.md
```

Switch models with `SPIKE_A_MODEL=gemini-3-pro-image`; outputs go to a separate
directory so runs never overwrite each other.

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

At the recommended Flash rate: **$0.0391/image, 8.8s**, flat at 1290 output
tokens regardless of prompt size (input is ~0.5% of cost). An 8-page chapter is
**$0.31 and ~70s** of image time. Pages are independent and parallelise; the
story-text call does not.
