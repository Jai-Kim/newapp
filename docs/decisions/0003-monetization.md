# ADR-0003 — Monetization: books, not a feed

Status: accepted · Date: Aug 2026

## Context

The AI-story category sells flat monthly digital subscriptions, which fights our
cost structure: per-chapter image cost forces a cap that undercuts the nightly
promise (ADR-0002 showed unlimited nightly is unprofitable on the API path). But
our output is a durable, emotional, **bilingual keepsake** — which argues for
**ownership + gifting**, not rental. And the highest willingness-to-pay in this
space is a **grandparent buying something about their grandchild**, which every
incumbent leaves untouched.

## Decision

Reframe the product as **books, not a feed**: nightly chapters accumulate into
completable **Volumes** (~10 chapters). The finished book is the emotional and
commercial peak.

Pricing (v1):

- **Intro:** $1.99 for the first 3 months.
- **Then:** $1.99/mo, including a chapter allowance of ~one book's worth
  (~8–10 chapters/month) to bound COGS.
- **Hero purchase:** a completed Volume → bilingual **hardcover** (~$45),
  giftable; grandparents buy extra copies.
- **Loyalty:** buying a print **comps digital for ~6 months**, renewing with each
  new book — heavy print buyers effectively never pay the sub.
- **Recurring revenue** comes from making new Volumes over time, not renting
  access to existing memories (families keep read access to books they've made).

## v1 validation approach (the first 100)

- Digital is a cheap habit-keeper; the learning weight is on **print/gift
  take-rate**, not sub revenue.
- **Concierge print:** fulfill the first hardcovers manually via a POD service
  (Gelato / Lulu / Blurb). No in-app print pipeline yet; the print entitlement +
  digital waiver are handled manually.
- Build the automated print + billing integration only after willingness is proven.

## Success metric

% of active families who **buy or gift a printed Volume** (target ~25–30%+).
Subscription revenue is secondary.

## Consequences

- Product structures around completable Volumes — UX shows progress toward a
  finished book and a “your book is ready” moment (reshapes the reader/library and
  issue #12).
- The chapter **allowance** replaces the hard 20-chapter “cap” framing with a
  per-volume rhythm.
- New dependency: a **POD partner** (research task).
- Play billing: a subscription product ($1.99/mo, $1.99/3mo intro) + one-time
  managed products (Volumes/prints) — but for the 100, print + waiver are concierge.

## Relationship to ADR-0002

Revises ADR-0002's pricing *conclusion* ($14.99 / 20 / 3-free subscription). The
reshaped-cost work in ADR-0002 stands (4 images/chapter; open weights as the
margin lever); only the **packaging** changes to book-led.
