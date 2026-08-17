# Week 2 — PR sequence (proposed)

Built against ADR-0001 (bilingual + identity/wardrobe), ADR-0002 (4 illustrations),
ADR-0003 (books, not a feed), `RISKS.md`, and issues #6, #9–#14.

**Status: proposed, awaiting review.** Nothing below is built yet.

## Prerequisite: land PR #8

PR #8 is still open, and `main` has none of it — no bilingual `generate-chapter`,
no illustration path, no safety filter, no reader or review screens, no real auth.
Every slice below builds directly on it, so it is the first merge, not a parallel
track. It is larger than the "small PRs" rule that governs everything after it;
splitting finished, verified work would cost more than it returns.

## The sequence

Each row is one PR. Dependencies run top to bottom; nothing later is a
prerequisite for anything earlier.

| # | Slice | Delivers | Closes |
|---|---|---|---|
| 1 | **Accounts are real** | Onboarding creates family + child (name, age band, `primary_language`, interests). Removes the `claim_orphan_families` dev hack. `generate-chapter` and `illustrate-chapter` require a verified JWT. Multi-tenant RLS test: a second family sees nothing. | #6 |
| 2 | **Character look picker** | Structured options (skin tone, hair, eyes, glasses, signature colour) → identity-sheet prompt → generate + store the locked sheet. No free-text prompt. | RISKS: look picker |
| 3 | **Volumes** | `volumes` table, chapters belong to a volume (~10), progress state, monthly allowance accounting. | #12 (part) |
| 4 | **Nightly flow + pre-generation** | Lesson/situation picker; a queue that generates the *next* chapter after tonight's read; "tonight's chapter is ready" state. | #9 |
| 5 | **Reader + offline** | Page navigation, EN/KO page-aligned, art on beat pages, local cache of text + images so a chapter reads in airplane mode. | #10 |
| 6 | **Book completion + concierge print** | "Your book is ready" moment; order/gift form collecting shipping details and notifying us. No POD integration. | #12 (rest) |
| 7 | **Paywall + allowance enforcement** | RevenueCat: $1.99/3mo intro → $1.99/mo. Allowance enforced kindly, framed as a per-volume rhythm. | #14 (reframed) |
| 8 | **Safety in the live flow** | Parent gate wired into the nightly flow; crisis-input handling; Korean parity; Terms disclaimer. | #13 |

Safety already exists at the function layer (Spike D) and is enforced in Postgres;
slice 8 is about the *live* flow and crisis handling, not building the filter.

## Three things worth deciding before I build

### 1. Issue #14 is stale and contradicts ADR-0003

#14 still says **"$14.99/mo, 20 chapters, 3 free"** — the Spike C conclusion that
ADR-0003 explicitly supersedes. #12 already notes the reframing. #14 should be
closed or rewritten before slice 7, or whoever picks it up will build the wrong
paywall. My own $14.99 recommendation from the ADR-0002 work is likewise
superseded; ADR-0003 is the better read of the business and I am building to it.

### 2. The subscription is structurally loss-making — by design, but the number matters

Computed by `cost_model.py`, not estimated:

| Allowance | Store cut | Net | COGS | Per subscriber |
|---|---|---|---|---|
| 8 chapters/mo | 15% | $1.69 | $2.82 | **−$1.13/mo** |
| 8 chapters/mo | 30% | $1.39 | $2.82 | **−$1.43/mo** |
| 10 chapters/mo | 15% | $1.69 | $3.52 | **−$1.83/mo** |
| 10 chapters/mo | 30% | $1.39 | $3.52 | **−$2.13/mo** |

The $1.99-for-3-months intro runs **−$9.18** per family across the intro at a 30%
cut and a 10-chapter allowance.

ADR-0003 is explicit that digital is a habit-keeper and print carries the
business, so this is a deliberate bet rather than an oversight. But two
consequences follow that are worth naming:

- **The allowance is the main COGS dial.** 8 vs 10 chapters is $0.70/mo — half
  the net subscription revenue. Worth choosing deliberately rather than
  defaulting to "one book's worth".
- **Open weights moves from margin lever to load-bearing.** At the (unmeasured)
  target it halves the monthly loss, $-2.13 → $-1.09. `REPLICATE_API_TOKEN` is
  still unset; the harness is ready.

Print is exempt from Play/App Store billing, so a hardcover sold outside IAP
keeps its full margin — which is what has to cover the subsidy. Sizing that needs
a POD quote, which is the open research task in ADR-0003.

### 3. Where the allowance is enforced

Slice 7 puts it in the paywall, but the abuse surface is the Edge Function (#6).
I plan to enforce **server-side in `generate-chapter`** — checking the family's
month-to-date count — and let the client merely *display* remaining chapters.
A client-side cap is decorative once the anon key is public. Flagging because it
puts a little of #14's work into slice 1.

## What I am not proposing to build this week

- **POD/print pipeline** — concierge only, per ADR-0003.
- **Multiple children** — RISKS marks it P2, and it changes the data model's
  shape; better once one child works end to end.
- **Regenerate / "don't like it"** — RISKS P1, real, but not on the critical path
  to a completed Volume.
- **pgvector k-NN retrieval + embeddings** — still inert. Matters at chapter 40,
  not chapter 10.
