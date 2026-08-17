# Spike C — unit economics

Status: **PASS at the ADR-0002 shape.** The chapter Spike B originally generated
— 8 pages, 8 illustrations — loses money at *every* believable price. Reshaped to
**6 pages / 4 illustrations** (ADR-0002), it clears a healthy margin.

Recommendation: **$14.99/mo, 20 chapters included, 6 pages / 4 illustrations,
3 chapters free.** 45% gross at a 15% store cut, **33% at 30%**, ~67% at typical
usage.

> **Why $14.99 and not $12.99.** ADR-0002 settles on ~4 illustrations, not 3.
> That is the right *product* call — but it costs money: $0.303 → **$0.352** per
> chapter. At $12.99 with a 20-chapter cap that leaves only **22%** once the
> store takes 30%, which is too thin to absorb support, infrastructure and
> retries. $14.99 restores 33%. The alternative is holding $12.99 and cutting the
> cap to 16 (38% at a 30% cut) — but 16 chapters is four nights a week, and the
> product is pitched as nightly. Better to charge $2 more than to ration the
> core promise.

Figures include Spike D's safety passes ($0.02/chapter for text, $0.01 per
illustration). Those run on everything and are not optional, so they belong in
COGS rather than in a footnote.

All figures computed by [`cost_model.py`](cost_model.py) from measured Spike A/B
numbers — no estimates. Re-run it after changing any assumption.

## Measured inputs

| Input | Value | Source |
|---|---|---|
| Story text, 8 pages EN+KO | $0.136, 71s | Spike B, `claude-opus-5` |
| Text safety pass | $0.02, ~8s | Spike D |
| Illustration | $0.0391, 8.8s | Spike A, `gemini-2.5-flash-image` |
| Illustration safety pass | $0.01, ~4s | Spike D |
| Illustration (Pro) | $0.1350, 28.4s | Spike A, `gemini-3-pro-image` |

## The problem: nightly × 8 images doesn't work

At $0.549/chapter, a nightly reader costs **$16.46/month** in COGS. Against
app-store fees (15% under Apple/Google small-business programmes, 30% above
$1M/yr):

| Price/mo | Store cut | Net | Cost | Gross | Margin |
|---|---|---|---|---|---|
| $9.99 | 15% | $8.49 | $16.46 | **-$7.97** | -94% |
| $12.99 | 15% | $11.04 | $16.46 | **-$5.42** | -49% |
| $14.99 | 15% | $12.74 | $16.46 | **-$3.72** | -29% |
| $19.99 | 15% | $16.99 | $16.46 | $0.53 | 3% |
| $19.99 | 30% | $13.99 | $16.46 | **-$2.47** | -18% |

**Nothing clears.** Even $19.99 returns 3% at the friendly store cut and goes
negative at the standard one — and $19.99 is already a hard sell for a bedtime
app from an unknown studio. **The store cut is the part that's easy to forget and it is decisive:**
it removes 15–30% of revenue before a single token is spent.

## ADR-0002 shape: price × cap

At **$0.352/chapter** (6 pages, 4 images, safety included), worst case — every
included chapter used:

| Price/mo | Cap | Cost | Gross @15% | Gross @30% |
|---|---|---|---|---|
| $12.99 | 12 | $4.23 | $6.81 (62%) | $4.86 (53%) |
| $12.99 | 16 | $5.64 | $5.40 (49%) | $3.45 (38%) |
| $12.99 | 20 | $7.05 | $3.99 (36%) | $2.04 (**22%**) |
| **$14.99** | **20** | **$7.05** | **$5.69 (45%)** | **$3.44 (33%)** |
| $14.99 | 16 | $5.64 | $7.10 (56%) | $4.85 (46%) |

**The cap is load-bearing, not cosmetic.** At a true nightly 30 chapters the
recommended shape still goes **negative (−16%)** at a 30% store cut. Unlimited
nightly generation does not work on the API image path at any price we would
charge — which is precisely why ADR-0002 makes open weights the priority.

## The fix: fewer images, and a cap

Images are ~70% of marginal cost, so the lever is illustrations per chapter, not
words. Not every page needs its own full illustration — picture books routinely
mix full spreads with spot art.

| Shape | $/chapter | $/mo nightly |
|---|---|---|
| 8 pages, 8 images (Spike B as-is) | $0.549 | $16.46 |
| 6 pages, 6 images | $0.451 | $13.52 |
| **6 pages, 4 images (ADR-0002)** | **$0.352** | $10.57 |
| 6 pages, 3 images | $0.303 | $9.10 |

Combined with a **20-chapter monthly allowance** (generous against real
behaviour — very few families read a *new* story 30 nights running, and re-reads
are free):

| Scenario | Cost | Gross @15% | Margin |
|---|---|---|---|
| Worst case (all 20 used) | $7.05 | **$5.69** | **45%** |
| Worst case, 30% store cut | $7.05 | $3.44 | 33% |
| Typical (12/mo) | $4.23 | **$8.51** | **67%** |

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

At the recommended shape, 3 free chapters cost **$1.06 per signup**. That is
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

## Phase 2 is still the real fix — and still unrun

ADR-0002 makes the open-weights path the primary margin lever. The harness is
written and deployed (`step5_openweights.py`, `spike-a2`), but
**`REPLICATE_API_TOKEN` is not set** — not in the shell, not in `.env`, and not
in Supabase secrets. The spike could not run.

Sizing the prize, at an assumed $0.013/image (about a third of Nano Banana —
**unmeasured**, shown only to show why it matters):

| Image path | Cap | $/chapter | Gross @30% cut, $12.99 |
|---|---|---|---|
| Nano Banana | 20 | $0.352 | $2.04 (22%) |
| open weights (target) | 20 | $0.248 | $4.13 (**45%**) |
| Nano Banana | 30 (nightly) | $0.352 | −$1.48 (−16%) |
| open weights (target) | 30 (nightly) | $0.248 | $1.65 (18%) |

That is the difference between needing a cap and not needing one, and between
holding $12.99 and having to charge $14.99. To unblock:

```bash
npx supabase secrets set REPLICATE_API_TOKEN=r8_...
```

then `python3 docs/spikes/spike-a/step5_openweights.py`.

## Pass bar

> Healthy gross margin at a believable consumer price, with a free-tier limit that
> still lets a family fall in love before paying.

Met — **45% worst case at a 15% store cut, 33% at 30%, ~67% typical**, at
$14.99/mo with 20 chapters and 3 free. The shape change is implemented, not
hypothetical: `generate-chapter` now marks exactly four pages as the emotional
beats and `illustrate-chapter` honours that flag.

Two caveats on the pass. It assumes the 20-chapter cap holds — true nightly use
is still negative at a 30% store cut. And it rests on **$14.99**, $2 above the
earlier recommendation, because ADR-0002's fourth illustration costs real money.
Open weights would buy back both.

## Assumptions worth challenging

- **Nightly = 30 chapters/month is the pessimistic bound.** Real cadence is
  probably 8–15. If usage data later shows that, the cap can rise or the price
  can fall.
- **No retry cost modelled.** Safety-filter rejections and validation failures
  will add some regeneration. Spike D saw zero blocks across three sensitive
  chapters and nine illustrations, so the rate looks low — but that is a small
  sample of benign material.
- **Text at Opus 5 pricing.** A cheaper model for some chapters is untested —
  but text is only ~30% of COGS at the current shape and less after the image
  reduction, so the upside is limited.
- **Storage, Supabase, and print fulfilment are excluded.** This is marginal
  generation cost only.
