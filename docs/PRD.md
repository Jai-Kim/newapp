# Product Requirements Document — Storyloom (working title)

Status: Draft v2 · Owner: Jai (product) + Claude (execution) · Date: Aug 2026

---

## 1. Problem

Every parent hits moments they don't have the words for: a new sibling, the
first day of school, fear of the dark, a scary doctor visit tomorrow, "why did
Grandpa die," learning to share, a big move. The oldest and most effective tool
for these moments is a story — but the *right* story, at the *right* moment,
starring *their* child, has never existed on demand.

Existing AI story apps generate a **one-off book** and forget it. So they behave
like a novelty toy: the magic wears off in a week, nothing carries over, and the
child never gets to live in an ongoing world.

## 2. Insight & wedge

**Wedge: the storybook that remembers.** Storyloom is an ongoing, serialized
story world. The child is the recurring hero; characters, places, and unresolved
threads persist night to night; the parent steers the lesson of each chapter.
This reframes the product from a commodity generator (novelty churn) into a
*relationship with a story world* (retention, emotional lock-in, a compounding
moat). Two additions sharpen it: it is **bilingual (English + Korean on every
page)**, and it is packaged as **books, not a feed** (see §8).

## 3. Why now

Reference-based character consistency (Nano Banana), strong long-form multilingual
narrative (Claude), and cheap structured persistence matured together. The novel
combination is *serialized, bilingual* storytelling where memory lives outside
the model's context window, in our own data store.

## 4. Target users

- **Primary persona:** parents of children ages **3–6**.
- **First user & first 100:** a Korean-American niece and Jai's friends-&-family
  network — a real, reachable channel. Useful and delightful for a single family,
  no network-effect dependency.
- **Buyers include grandparents.** The highest willingness-to-pay is a relative
  buying a keepsake about the child — a first-class buyer, not an afterthought.

## 5. Jobs to be done

1. "Help me get my child through a specific situation happening this week."
2. "Give us a bedtime ritual we look forward to."
3. "Instill a value I care about, gently, without lecturing."
4. "Give me a keepsake of my child's imagination — in both our languages."

## 6. Solution overview

- Parent sets up a **child profile** (first name, age band, primary language, a
  guided character look, interests).
- Each night: pick a **lesson/situation** → Storyloom generates an **illustrated,
  bilingual chapter** (English + Korean on every page) where the child is the
  hero, ready to read together. Generation is **pre-computed** so bedtime is
  instant.
- The world **persists** (recurring characters, places, open threads).
- **Books, not a feed:** chapters accumulate into completable **Volumes** (~10
  chapters). A finished Volume becomes a printable, giftable **bilingual
  hardcover** — the emotional and commercial peak.

## 7. MVP scope (August)

**In scope:**
- Onboarding: parent account, one child, guided character look, primary language.
- Nightly flow: pick lesson → (pre-generated) illustrated bilingual chapter →
  read-together view; **offline** reading of generated chapters.
- **Persistent Story Bible** (the moat).
- **Volumes:** progress toward a completable book + a "your book is ready" moment.
- Monetization per ADR-0003 (cheap digital + concierge print for the 100).
- Safety: content filter (text + image) + parent preview.

**Out of scope for v1 (fast-follows):** in-app automated print/billing pipeline
(concierge instead), voice narration, child-driven choices, multiple children,
web.

## 8. Monetization — books, not a feed (see ADR-0003)

- **Digital is a cheap habit-keeper:** $1.99 for 3 months, then $1.99/mo with a
  ~one-book/month chapter allowance (bounds image cost).
- **The hero product is the keepsake:** a completed Volume → bilingual hardcover
  (~$45), giftable; grandparents buy extra copies.
- **Buying a print comps digital** for ~6 months (renews with each new book).
- **The first 100 are a keepsake test:** concierge print fulfillment; the metric
  that matters is **print/gift take-rate**, not subscription revenue.

## 9. Success metrics

- **Product north star:** weekly nights with a chapter read together per active
  family (ritual).
- **Commercial north star:** % of active families who **buy or gift a printed
  Volume** (target ~25–30%+).
- Activation: % who generate + read chapter #1 within 24h.
- Retention: D30 families with ≥3 chapters; % who complete Volume 1.
- Moat signal: % of chapters that reference prior canon.
- PMF proxy: of ~100 parents, ≥40% “very disappointed” without it.

## 10. Risks & mitigations

Tracked in `docs/RISKS.md` + GitHub issues. Top: bedtime latency (→ pre-generate),
offline reading, Play closed-testing timeline, sensitive-data privacy + Korea
PIPA, crisis-input policy, heavy-user cost.

## 11. Open decisions

- **Name.** "Storyloom" is a placeholder. Decide before store submission.
- **First store.** Decided: **Google Play first**.
- **Pricing / model.** Decided: **books, not a feed** (ADR-0003).
- **Character look at launch:** guided prompt-described picker (photo deferred).
- **POD partner** for concierge print: TBD (Gelato / Lulu / Blurb).

## 12. Non-goals

Not a screen-time babysitter, not a generic "story about anything" generator, not
an unsupervised child chatbot, not a clinical/therapeutic tool.
