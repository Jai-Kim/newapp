# Spike C — unit economics

Status: **PASS, but only after changing the product shape.** The headline finding
is that the chapter Spike B actually generates — 8 pages, 8 illustrations —
**loses money at every believable consumer price** if the family reads nightly.

Recommendation: **$12.99/mo, 20 chapters included, 6 pages / 3 illustrations,
3 chapters free.** That yields 44–54% gross margin worst-case and ~72% at typical
usage.

All figures computed by [`cost_model.py`](cost_model.py) from measured Spike A/B
numbers — no estimates. Re-run it after changing any assumption.

## Measured inputs

| Input | Value | Source |
|---|---|---|
| Story text, 8 pages EN+KO | $0.136, 71s | Spike B, `claude-opus-5` |
| Illustration | $0.0391, 8.8s | Spike A, `gemini-2.5-flash-image` |
| Illustration (Pro) | $0.1350, 28.4s | Spike A, `gemini-3-pro-image` |

## The problem: nightly × 8 images doesn't work

At $0.449/chapter, a nightly reader costs **$13.46/month** in COGS. Against
app-store fees (15% under Apple/Google small-business programmes, 30% above
$1M/yr):

| Price/mo | Store cut | Net | Cost | Gross | Margin |
|---|---|---|---|---|---|
| $9.99 | 15% | $8.49 | $13.46 | **-$4.97** | -59% |
| $12.99 | 15% | $11.04 | $13.46 | **-$2.42** | -22% |
| $14.99 | 15% | $12.74 | $13.46 | **-$0.72** | -6% |
| $19.99 | 15% | $16.99 | $13.46 | $3.53 | 21% |
| $19.99 | 30% | $13.99 | $13.46 | $0.53 | 4% |

Only $19.99 clears, and only barely — a price that is a hard sell for a bedtime
app, and one that still collapses to 4% once you graduate off the small-business
programme. **The store cut is the part that's easy to forget and it is decisive:**
it removes 15–30% of revenue before a single token is spent.

## The fix: fewer images, and a cap

Images are ~70% of marginal cost, so the lever is illustrations per chapter, not
words. Not every page needs its own full illustration — picture books routinely
mix full spreads with spot art.

| Shape | $/chapter | $/mo nightly |
|---|---|---|
| 8 pages, 8 images (Spike B as-is) | $0.449 | $13.46 |
| 6 pages, 6 images | $0.371 | $11.12 |
| 8 pages, 4 spot illustrations | $0.292 | $8.77 |
| **6 pages, 3 spot illustrations** | **$0.253** | $7.60 |

Combined with a **20-chapter monthly allowance** (generous against real
behaviour — very few families read a *new* story 30 nights running, and re-reads
are free):

| Scenario | Cost | Gross @15% | Margin |
|---|---|---|---|
| Worst case (all 20 used) | $5.07 | **$5.98** | **54%** |
| Worst case, 30% store cut | $5.07 | $4.03 | 44% |
| Typical (12/mo) | $3.04 | **$8.00** | **72%** |

That is a healthy consumer-subscription margin with room for infrastructure,
support and the inevitable retries.

## Free tier: 3 chapters, and the number is not arbitrary

**The moat is invisible in chapter 1.** Storyloom's entire differentiator is that
tonight continues last night — and a one-chapter trial shows a parent exactly
what every competitor already does: a nice one-off story. The "oh, it *remembered*"
moment is the product, and it first happens at the start of chapter 2.

- **1 chapter** — demonstrates nothing we're charging for. Actively misleading.
- **2 chapters** — shows the memory once; could read as coincidence.
- **3 chapters** — shows it holding, and that threads carry *and resolve*.
- 5+ — no extra persuasion, 67% more acquisition cost.

At the recommended shape, 3 free chapters cost **$0.76 per signup**. That is
cheap against any plausible CAC, and it is spent on the one thing that actually
converts.

Ship the free tier with the thread mechanic visible in the UI — an "open thread"
the parent can see waiting — so the second night has a reason to happen.

## Price: $12.99

$9.99 is the reflex for a consumer app but leaves only $8.49 net at 15%, and the
allowance would have to drop far enough to feel stingy. $19.99 clears the
unconstrained nightly case but is a hard ask for a bedtime app from an unknown
studio. **$12.99 with 20 chapters included** prices above the impulse tier —
appropriate for something positioned as a keepsake, not a toy — while keeping
margin healthy at both store-cut regimes.

## Latency is fine

~80s per chapter with illustrations generated in parallel (71s text + 8.8s
images). Pages are independent; the text call is not. Under two minutes for a
bedtime story that gets read for fifteen is comfortable — and it is *generated
ahead of bedtime*, not while a child waits. No optimisation needed for v1.

Nano Banana Pro would take this to ~227s sequential and triple image cost; Spike
A already recommends against it for the nightly path.

## The keepsake upsell has excellent margin

Re-rendering a bound volume at Pro quality is a **one-off** cost per book, not
per night:

| Volume | Pro re-render cost |
|---|---|
| 10 chapters | $4.05 |
| 20 chapters | $8.10 |
| 30 chapters | $12.15 |

Against a printed hardcover priced anywhere from $39–79, that is a rounding
error, and it is exactly where Pro's extra polish is worth paying for — the
artifact that sits on a shelf for a decade, versus a page read once on a tablet.
This is the strongest margin line in the business and it should be built.

## Phase 2 changes the picture entirely

`ARCHITECTURE.md` §2 plans open-weight illustration (Flux.1-dev + PuLID/InstantID
on serverless GPU). If that lands at even a third of Nano Banana's per-image cost,
the illustration line drops from ~70% of COGS to ~40%, and the 20-chapter cap
stops being necessary. **That spike has not been run** — `REPLICATE_API_TOKEN` is
unset — and it is the single highest-leverage cost work remaining.

## Pass bar

> Healthy gross margin at a believable consumer price, with a free-tier limit that
> still lets a family fall in love before paying.

Met — 54% worst case, 72% typical, at $12.99 with 3 free chapters that
demonstrate the memory. **But not at the shape Spike B currently generates**, so
this is a pass conditional on moving to 6 pages / 3 illustrations. That is a
product decision, not a technical one, and it belongs to Jai.

## Assumptions worth challenging

- **Nightly = 30 chapters/month is the pessimistic bound.** Real cadence is
  probably 8–15. If usage data later shows that, the cap can rise or the price
  can fall.
- **No retry cost modelled.** Safety-filter rejections and validation failures
  will add some regeneration; Spike D will show the rate.
- **Text at Opus 5 pricing.** A cheaper model for some chapters is untested —
  but text is only ~30% of COGS at the current shape and less after the image
  reduction, so the upside is limited.
- **Storage, Supabase, and print fulfilment are excluded.** This is marginal
  generation cost only.
