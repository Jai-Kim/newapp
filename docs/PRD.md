# Product Requirements Document — Storyloom (working title)

Status: Draft v1 · Owner: Jai (product) + Claude (execution) · Date: Aug 2026

---

## 1. Problem

Every parent hits moments they don't have the words for: a new sibling, the
first day of school, fear of the dark, a scary doctor visit tomorrow, "why did
Grandpa die," learning to share, a big move. The oldest and most effective tool
for these moments is a story — but the *right* story, at the *right* moment,
starring *their* child, has never existed on demand.

Existing AI story apps generate a **one-off book** and forget it. So they behave
like a novelty toy: the magic wears off in a week, nothing carries over, and the
child never gets to live in an ongoing world. Reviewers name the exact failure:
today's tools have "barely enough context to maintain consistency within a
single story, let alone remember that last Tuesday's adventure ended with
Captain Elephant promising to return to the Cloud Kingdom."

## 2. Insight & wedge

The bottleneck for parents is **not** a lack of stories (the internet has
infinite). It is (a) not having the right story for *this* moment, and (b) the
absence of a *ritual and a world* that persists. An app can supply both.

**Wedge: the storybook that remembers.** Storyloom is not a book factory; it is
an ongoing, serialized story world. The child is the recurring hero; characters,
places, and unresolved threads persist night to night; the parent steers the
lesson of each new chapter. This reframes the product from a commodity generator
(novelty churn) into a *relationship with a story world* (retention, emotional
lock-in, a moat that compounds the longer a family uses it).

## 3. Why now

Three capabilities matured simultaneously and only recently: (1) reference-based
character consistency in image models (Nano Banana Pro 2 / Flux Kontext), (2)
strong long-form narrative generation from LLMs, and (3) cheap structured
persistence. The novel combination is *serialized* storytelling where memory
lives outside the model's context window, in our own data store.

## 4. Target users

- **Primary persona:** parents of children ages **3–6** (bedtime-story sweet
  spot; peak "hard moments"; pre-literate, so co-reading matters).
- **The first 100:** parents in Jai's friends & family network — a real,
  reachable distribution channel. The product must be useful and delightful for
  a single family, with no network-effect dependency.
- **Buyer = parent; co-user = child.** Framing is *parent-first*: Storyloom
  equips the parent, it does not replace them. Stories are designed to be **read
  together**, not handed to a screen.

## 5. Jobs to be done

1. "Help me get my child through a specific situation happening this week."
2. "Give us a bedtime ritual we look forward to."
3. "Instill a value I care about, gently, without lecturing."
4. "Give me a keepsake of my child's imagination and our time together."

## 6. Solution overview

- Parent sets up a **child profile** (first name, age band, a character look) and
  chooses a **value/situation** for tonight.
- Storyloom generates an **illustrated chapter** where the child is the hero,
  that lands the chosen lesson, in ~90 seconds, ready to read together.
- The world **persists**: recurring characters, places, and open threads carry
  forward. Tonight can pick up where last night left off.
- Over weeks, chapters accumulate into a **series**; the parent can order a
  printed **keepsake volume**.

## 7. MVP scope (August)

**In scope (must-have):**
- Onboarding: parent account, one child profile, character look (prompt-based;
  photo upload optional/later), interests.
- "Tonight's chapter" flow: pick a lesson/situation → generate illustrated
  chapter (3–6 illustrated pages) → read view.
- **Persistent story bible** (the moat): characters, world, open threads, past
  chapter summaries, lessons taught — retrieved and reused on every generation.
- Chapter library (revisit past chapters).
- Subscription paywall (free trial → paid) via RevenueCat.
- Parent gate for purchases; child-safe content guardrails; content preview
  before the child sees it.

**Explicitly out of scope for v1 (fast-follows):**
- AI voice narration; parent-voice recording ("Daddy reads even when away").
- Print-on-demand fulfillment (design the data model for it; don't build the
  pipeline yet).
- Child-driven branching choices.
- Multiple children / multi-parent sharing.
- Web app.

## 8. Monetization

- **Model:** freemium → subscription. A small number of free chapters, then
  unlimited chapters + continuity + (later) voice behind a subscription.
- **Billing:** RevenueCat over App Store / Play in-app purchase.
- **Later:** print keepsake volumes (high-margin, giftable, holiday spike) and
  gift subscriptions (grandparents).
- **Willingness to pay** is already proven in the parenting/kids category; the
  serialized + keepsake angle raises it.

## 9. Success metrics

- **North star:** *weekly nights with a chapter read together per active family*
  (ritual formation).
- Activation: % of new parents who generate + read chapter #1 within 24h.
- Retention: D7 / D30 families with ≥3 chapters; % reaching a 7-night streak.
- Moat signal: % of chapters that reference prior canon (recurring
  character/thread) — proves the "remembers" value is felt.
- Monetization: trial→paid conversion; monthly retained subscribers.
- Qualitative bar: of ~100 friends-&-family parents, ≥40 say they'd be
  "very disappointed" without it (Sean Ellis PMF proxy).

## 10. Risks & mitigations

- **Crowded market.** → Compete only on the unsolved wedge (persistent
  serialized memory + parent-steered lessons), not generic generation.
- **Novelty churn.** → Serialized "tune in tomorrow" world + streak ritual +
  growing canon = reasons to return; retention is the primary design target.
- **Character-consistency drift (top eng risk).** → Lock a character reference
  once, reuse via reference-image models; de-risk in week 1 before committing.
- **Cross-night memory (second eng risk).** → Memory lives in our DB (a
  structured "story bible"), not the model context window; retrieved and
  injected per generation. De-risk in week 1.
- **Unit economics (image cost).** → Cost model in ARCHITECTURE; cap free tier;
  fewer, richer illustrations; cache/reuse; cheaper models where quality holds.
- **Child safety / COPPA & kids-app policy.** → Parent-owned account, minimal
  child data (first name + age band only), parent-gated purchases, content
  filters + parent preview, IARC content rating + Data Safety + Target Audience
  forms. See ARCHITECTURE §Compliance.
- **AI-raising-my-kid objection.** → Parent-first, co-read positioning; parent
  approves content.

## 11. Open decisions

- **Name.** "Storyloom" is a placeholder. Candidates: Everly, Chapters,
  Heirloom, Lore, Once, Nightla. Decide before store submission.
- **First store.** Decision: **Google Play first** (cheaper, faster, more
  lenient review → fastest path to the "submitted for review" goal), iOS close
  behind.
- **Character look at launch:** prompt-described avatar vs. photo-derived. Lower
  risk/faster: prompt-described for v1; photo as fast-follow.

## 12. Non-goals

Storyloom is not a screen-time babysitter, not a generic "story about anything"
generator, and not an unsupervised child chatbot.
