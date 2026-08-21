# Storyloom — build plan & progress

Snapshot of what we're building and where we are. Update as phases complete.
A standalone visual version is at [`docs/progress.html`](./progress.html).
Source of truth for detail: `docs/ROADMAP.md`, `docs/WEEK-1-SPIKES.md`, ADRs.

## What we're building

| | |
|---|---|
| **Product** | The bedtime storybook that remembers |
| **Moat** | Cross-night memory — a persistent, serialized story world |
| **Languages** | **Bilingual: English + Korean on every page** (native, not translated) |
| **Model** | **Books, not a feed** — cheap digital + printed, giftable bilingual keepsakes (ADR-0003) |
| **Who** | Parents of children ages 3–6; first user a Korean-American niece; grandparents buy |
| **First store** | Google Play (iOS close behind) |

## Progress — phase 3 of 5

- [x] **Concept** — idea locked & sharpened
- [x] **Foundation** — research + founding docs
- [x] **Week 1 gate** — all four spikes passed (GREEN); month de-risked
- [ ] **Weeks 2–3** — build core loop + product ← *now*
- [ ] **Week 4** — closed testing on Google Play (the first-100 channel)

## Week 1 gate — GREEN (4 / 4 passed)

| Spike | Pass bar | Status |
|---|---|---|
| A · Character consistency | Same child across ≥3 scenes a parent accepts | ☑ passed |
| B · Cross-night memory | Ch. 2 remembers Ch. 1 from the DB, both languages | ☑ passed |
| C · Unit economics | Healthy margin at a believable price | ☑ passed |
| D · Safety | Sensitive topics safe (EN+KO); parent-preview gate | ☑ passed |

## Log

- **Aug 2026** — Concept locked. Founding docs (PR #1), kickoff (#2), progress
  board (#3), Story Bible core (#4) merged. GitHub write access resolved.
- **Aug 2026** — Spike 0 passed (PR #5); CORS fixed; abuse/cost protection = issue #6.
- **Aug 2026** — Spike A passed; bilingual + identity/wardrobe split (ADR-0001, PR #7).
- **Aug 2026** — Spikes B & D passed; Spike C reshaped (ADR-0002).
- **Aug 2026** — Spec gap review → risks logged (issues #9–#14, `RISKS.md`).
- **Aug 2026** — Monetization: books, not a feed (ADR-0003). **Gate GREEN — building Week 2.**
