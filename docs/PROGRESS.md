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

## Pre-launch reference docs

Operational docs that don't fit the phase log below, kept here so they're
easy to find as launch approaches. All are engineering drafts — none is
legally cleared, and every one has open `TODO(Jai)` items.

| Doc | Covers |
|---|---|
| [`docs/privacy-policy.md`](./privacy-policy.md) | Bilingual EN+KO privacy notice the app's `/privacy` screen renders from; Korea PIPA cross-border-transfer disclosure |
| [`docs/privacy-store-disclosures.md`](./privacy-store-disclosures.md) | Facts for Google Play's Data Safety form and Apple's App Privacy label |
| [`docs/runbook-environments.md`](./runbook-environments.md) | Separating dev/staging from production Supabase (issue #19) |
| [`docs/play-closed-testing.md`](./play-closed-testing.md) | Google Play closed-testing run sheet, 12-tester/14-day rule, org-account exemption (issue #11) |
| [`docs/play-store-listing.md`](./play-store-listing.md) | Draft bilingual EN+KO Play Store listing copy, no price stated |
| [`docs/play-data-safety.md`](./play-data-safety.md) | Play Console Data safety form worksheet, derived from the two privacy docs above |
| [`docs/play-tester-onboarding.md`](./play-tester-onboarding.md) | Bilingual recruiting message, tester install steps, opt-in tracker |

## Log

- **Aug 2026** — Concept locked. Founding docs (PR #1), kickoff (#2), progress
  board (#3), Story Bible core (#4) merged. GitHub write access resolved.
- **Aug 2026** — Spike 0 passed (PR #5); CORS fixed; abuse/cost protection = issue #6.
- **Aug 2026** — Spike A passed; bilingual + identity/wardrobe split (ADR-0001, PR #7).
- **Aug 2026** — Spikes B & D passed; Spike C reshaped (ADR-0002).
- **Aug 2026** — Spec gap review → risks logged (issues #9–#14, `RISKS.md`).
- **Aug 2026** — Monetization: books, not a feed (ADR-0003). **Gate GREEN — building Week 2.**
- **Aug 2026** — Week 2 core loop (PR #21): real accounts, the guided look
  picker, and pre-generation (ADR-0004, issue #9), behind a two-layer E2E
  harness. The live smoke closes ADR-0004's open question — background
  `waitUntil` generation and the sweep that rescues a dead worker are both
  verified end to end against real providers.
- **Aug 2026** — Week 3 (issue #22): offline reading (#26), Volumes (#27),
  concierge print (#28), rate-limit/quota (#32), privacy/PIPA/AI-labeling
  (#30), dev/staging Supabase guard (#31) all merged. Paywall (slice 3)
  gated on Jai's RevenueCat setup. Repo-side Play closed-testing prep
  (issue #11) added — see the reference table above; starting the actual
  12-tester/14-day clock is Jai's step.
