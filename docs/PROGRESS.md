# Storyloom — build plan & progress

Snapshot of what we're building and where we are. Update as phases complete.
A standalone visual version is at [`docs/progress.html`](./progress.html).
Source of truth for detail: `docs/ROADMAP.md` and `docs/WEEK-1-SPIKES.md`.

## What we're building

| | |
|---|---|
| **Product** | The bedtime storybook that remembers |
| **Moat** | Cross-night memory — a persistent, serialized story world |
| **Languages** | **Bilingual: English + Korean on every page** (native, not translated) |
| **Who** | Parents of children ages 3–6; first user a Korean-American niece |
| **Model** | Freemium → subscription → print keepsakes |
| **First store** | Google Play (iOS close behind) |

## Progress — phase 2 of 5 complete

- [x] **Concept** — idea locked & sharpened
- [x] **Foundation** — research + founding docs, PR #1 merged
- [ ] **Week 1 gate** — de-risk spikes A–D ← *in progress (Spike 0 + A done; Spike B next)*
- [ ] **Weeks 2–3** — build core loop + product
- [ ] **Week 4** — ship to Google Play

## Week 1 status

- **Spike 0 (scaffolding): ✅ passed.** App scaffolded; Supabase wired; functions
  deployed; health check green (server-side keys only).
- **Spike A (character consistency): ✅ passed.** Nano Banana held identity across
  3 scenes at $0.039/image, ~9s. Finding: identity/wardrobe split needed (ADR-0001).
- **Bilingual foundation:** EN+KO baked into the schema + generation contract
  (ADR-0001) before Spike B.

### Build/no-build gate (1 / 4 passed)

| Spike | Pass bar | Status |
|---|---|---|
| A · Character consistency | Same child across ≥3 scenes a parent accepts | ☑ passed |
| B · Cross-night memory | Ch. 2 remembers Ch. 1 from the DB, both languages | ☐ in progress |
| C · Unit economics | Real $/chapter → set price + free tier | ☐ pending |
| D · Safety | Sensitive topics safe (EN+KO); parent-preview gate | ☐ pending |

## Log

- **Aug 2026** — Concept locked. Founding docs (PR #1), kickoff (PR #2), progress
  board (PR #3), Story Bible core (PR #4) merged. GitHub write access resolved.
- **Aug 2026** — Spike 0 passed (PR #5): app scaffold, Supabase, functions, health
  check green. CORS fixed for web; abuse/cost protection logged as issue #6.
- **Aug 2026** — Spike A passed: Nano Banana character consistency. Bilingual
  (EN+KO) + identity/wardrobe split baked in (ADR-0001). Next: Spike B.
