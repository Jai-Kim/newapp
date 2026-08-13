# Spike A — character & style consistency

Status: **BLOCKED — not run.** Harness is written and deployed; no images have
been generated. See the blocker below.

## The blocker

Every Gemini image model returns HTTP 429 with a free-tier quota of **zero**:

```
Quota exceeded for metric:
  generativelanguage.googleapis.com/generate_content_free_tier_requests,
  limit: 0, model: gemini-2.5-flash-preview-image
```

`limit: 0` is not a rate limit that clears — image generation is not offered on
the Gemini free tier at all. Confirmed against every image-capable model the key
can see:

| Model | Result |
|---|---|
| `gemini-3-pro-image` (Nano Banana Pro) | 429, free-tier limit 0 |
| `gemini-3-pro-image-preview` | 429, free-tier limit 0 |
| `nano-banana-pro-preview` | 429, free-tier limit 0 |
| `gemini-2.5-flash-image` (Nano Banana) | 429, free-tier limit 0 |
| `gemini-3.1-flash-image` | 429, free-tier limit 0 |
| `gemini-3.1-flash-lite-image` | 429, free-tier limit 0 |

The key itself is fine — listing models works, which is exactly why
`health-check` reported the image provider green. That check only proves
reachability; it was reworded after this spike so it stops implying more.

**To unblock:** enable billing on the Google Cloud project behind
`GEMINI_API_KEY` (https://ai.dev/rate-limit shows current tier). No code change
needed — rerun the two steps below.

The Replicate path (Flux Kontext, and the Path 2 open-weights option) is also
unavailable: `REPLICATE_API_TOKEN` is not set.

## Running it once billing is enabled

From this directory. Reads Supabase credentials from the repo's `.env` and calls
the `spike-a` Edge Function, which holds the Gemini key server-side.

```bash
python3 step1_reference.py   # locks the character sheet → 00-reference-sheet.png
python3 step2_scenes.py      # renders 3 scenes conditioned on that sheet
```

Images land here as PNGs; per-render latency and token usage append to
`metrics.jsonl` (feeds Spike C).

## Method

The experiment is deliberately narrow: **one** locked reference sheet, then
every scene conditioned on it with an identical identity-preservation block.

- `step1_reference.py` holds `STYLE`, `MIA`, and `PIP` — pasted verbatim into
  every later prompt. If that wording drifts, the character drifts, and the
  spike stops measuring what it claims to.
- The reference image is attached **before** the instruction text; leading with
  the prompt tends to yield a fresh character instead of a re-render.
- Test child is fictional and prompt-described — no real photo, per the v1
  decision.

## Pass bar

A parent accepts the character as "the same kid" across all three scenes; face
and outfit stable, style consistent page to page. **Not yet assessed.**

## Cost and latency

Not measured — no successful generation. `metrics.jsonl` is written per render
and is the input to Spike C.
