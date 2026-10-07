# Content rating questionnaire (IARC) — draft answers

**Status: engineering draft for review — not legally cleared.** Written from
what the app actually does, so a reviewer can check each answer against the
code rather than trust it. Play serves this questionnaire through IARC and
issues ratings for several boards at once (ESRB, PEGI, USK, GRAC for Korea).

**Answer honestly even where it costs you a rating.** A rating obtained by
understating what the app does is grounds for removal, and the one question
below that genuinely needs a "yes" is the one people are tempted to skip.

---

## Category

**Select: "Other app"**, not Game.

Dodam generates and displays a bedtime story. There is no gameplay, score,
or competition.

---

## Violence, sexuality, language, controlled substances

| Question | Answer | Why |
|---|---|---|
| Does the app contain violence? | **No** | The safety reviewer blocks frightening or threatening content before a parent ever sees it (`_shared/safety.ts`), and blocks it again on the illustration (`reviewIllustration`). A blocked chapter cannot be approved at all — the database rejects it (`approve_chapter`). |
| Realistic/graphic violence, blood, injury? | **No** | Same filter; "depictions of injury, blood, or a person in distress without comfort present" is an explicit block criterion. |
| Sexual content or nudity? | **No** | Explicit block criterion in the image reviewer. |
| Crude humour? | **No** | |
| Profanity? | **No** | |
| References to drugs, alcohol or tobacco? | **No** | |
| Simulated gambling, or real-money gambling? | **No** | |
| Horror or fear themes? | **No** | Bedtime content is the entire brief; the filter blocks "darkness used as threat" and anything "that would unsettle a child at bedtime". |

**Caveat worth stating in review:** the filter is a model-based reviewer, not a
guarantee. The parent-preview gate is the actual backstop — nothing reaches a
child unread by an adult. Both are described under *Interactive elements*.

---

## Interactive elements — the section that matters

| Question | Answer | Why |
|---|---|---|
| Do users interact or exchange content? | **No** | There is no messaging, no feed, no sharing between families. Each family sees only its own data (enforced by row-level security, with a test asserting a second family sees nothing). |
| Does the app share the user's location? | **No** | Location is never requested or collected. |
| Does the app allow purchases? | **Yes** | A subscription: $1.99 for the first 3 months, then $1.99/month, through Google Play Billing via RevenueCat. Also a hardcover order flow that collects a shipping address but **takes no payment in-app**. |
| Does the app contain user-generated content? | **See note** | Answer per Play's definition and be ready to explain. A parent types a short "what's happening tomorrow" note, which becomes part of the prompt. It is never shown to any other user — but it is user-supplied text that influences displayed content. |
| **Does the app use generative AI?** | **Yes** | Every chapter's text and every illustration is generated — by Anthropic (Claude) for text and Google (Gemini) for images. |

### The generative-AI question

Play asks whether the app is AI-generated-content-enabled and, if so, how users
can report offensive output. Both halves need a real answer:

- **Yes, the app generates content with AI.** Say so plainly. It is the
  product, not an incidental feature.
- **Reporting mechanism:** this is the gap. Play expects an in-app way to flag
  offensive AI output. Today the parent gate lets a parent *reject* a chapter,
  which prevents their child seeing it but sends us nothing. **`TODO(Jai)`: a
  reject needs to become a report** — one call that records the chapter id and
  the reason — before this question can be answered truthfully. See
  `docs/launch/README.md`, open items.

---

## Likely outcome

With honest answers and no violence, sexuality or user-to-user contact, expect
a rating in the lowest bands (ESRB Everyone, PEGI 3, GRAC 전체이용가). The
purchase and generative-AI answers do not raise the age rating, but they do
set disclosure obligations elsewhere — the "Contains ads" (no), "In-app
purchases" (yes) and AI-content labels on the listing.

## Open items — `TODO(Jai)`

- [ ] In-app reporting path for AI output, before answering the AI question
- [ ] Confirm the UGC answer with current Play wording — the definition shifts
- [ ] Re-run the questionnaire if the companion/character picker ever accepts
      free text; today it is fixed options only, which is partly why the
      answers above are this clean
