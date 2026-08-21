# Core loop — end to end

The Week 2 core loop, running: **retrieve → generate (EN+KO) → safety → persist →
illustrate**. Chapter 5, "The Lantern by the Plum Tree", produced entirely by the
pipeline with no hand editing.

**→ [`storybook.html`](storybook.html)** is the artifact. Open it.

| | |
|---|---|
| Text | 8 pages, native EN + KO, $0.136 · 93s |
| Safety | `safe`, 3 advisory notes, both languages checked |
| Illustration | 3 pages, $0.117 · **16s wall** (parallel) |
| Total | **~$0.27 · ~110s** |
| Gate | `review_status: pending` — not child-readable |

## What this proves that the spikes didn't

Spikes A–D each proved one property in isolation. This is the first time they run
as one pipeline against one chapter, and two things only become visible here:

1. **The identity/wardrobe split holds under real story input.** Page 5's
   wardrobe is "star-print pyjamas and thick green socks" — nothing like the
   reference sheet's polka-dot dress and red boots — and the face, hair and
   glasses are unchanged. Spike A proved this with a hand-written wardrobe
   string; here the wardrobe came from the storyteller, unreviewed.
2. **Parallel illustration is the difference between 26s and 16s.** Pages are
   independent, so they render concurrently. That is what keeps a chapter under
   two minutes.

## Design decisions worth noting

- **`illustrate-chapter` is a separate function from `generate-chapter`.** Text
  takes ~93s and images ~9s each; folding them into one call would push past two
  minutes, fail the whole chapter if one image failed, and prevent parallelism.
  Splitting also lets a parent start reading while art is still arriving.
- **Only 3 of 8 pages are illustrated**, per Spike C. Illustrations are ~70% of
  marginal cost, and illustrating every page makes a nightly subscription lose
  money at any believable price. Pages are chosen evenly across the chapter,
  always including page 1 — the one a parent sees in the library.
- **Blocked chapters are never illustrated.** `illustrate-chapter` returns 409 if
  the filter rejected the chapter, so no money is spent rendering something
  nobody will read.
- **Storage buckets are private.** These are pictures of a child; signed URLs at
  read time, never a public bucket.

## Not done

- **No reader UI.** The storybook page is a static artifact built by a script,
  not the app's read-together view. That is the Week 2 screen work.
- **No parent-review UI.** The gate is enforced and queryable; the screen where a
  parent approves does not exist.
- **Illustrations are unfiltered.** The safety pass reads text only. A safe page
  can still get an unsettling picture — the image path needs its own check.
- **No retry on partial failure.** If one page fails to render, the function
  returns 207 with the failures listed; nothing retries automatically.
- **Embeddings still unwritten**, so pgvector k-NN retrieval remains inert.

## Reproducing

```bash
# 1. generate (writes chapter, runs safety, applies delta)
curl -X POST "$SUPABASE_URL/functions/v1/generate-chapter" \
  -H "Authorization: Bearer $ANON" -H 'Content-Type: application/json' \
  -d '{"child_id":"<uuid>","lesson":"…","situation":"…"}'

# 2. illustrate
curl -X POST "$SUPABASE_URL/functions/v1/illustrate-chapter" \
  -H "Authorization: Bearer $ANON" -H 'Content-Type: application/json' \
  -d '{"chapter_id":"<uuid>","illustrations":3}'
```

The child's `character_ref.identity.image_path` must point at a reference sheet
in the `character-refs` bucket.
