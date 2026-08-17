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
- [ ] **Week 1 gate** — de-risk spikes A–D ← *3/4 passed; C conditional (economics reshape)*
- [ ] **Weeks 2–3** — build core loop + product
- [ ] **Week 4** — ship to Google Play

## Week 1 status

- **Spike 0:** ✅ passed — scaffold, Supabase, functions, health check green.
- **Spike A:** ✅ passed — Nano Banana consistency ($0.039/image). ADR-0001 split.
- **Spike B:** ✅ passed — chapter 2 resolves a chapter-1 thread from DB-only canon,
  in native EN + KO. The moat works.
- **Spike C:** ◐ conditional — 8-image chapters are underwater; ADR-0002 adopts
  ~4 images/chapter + open-weights to reach positive margin.
- **Spike D:** ✅ passed — text + image safety; parent-preview gate.
- **Bilingual (EN+KO):** baked into schema + generation (ADR-0001).

### Build/no-build gate (3 / 4 passed)

| Spike | Pass bar | Status |
|---|---|---|
| A · Character consistency | Same child across ≥3 scenes a parent accepts | ☑ passed |
| B · Cross-night memory | Ch. 2 remembers Ch. 1 from the DB, both languages | ☑ passed |
| C · Unit economics | Real $/chapter → set price + free tier | ◐ conditional (ADR-0002) |
| D · Safety | Sensitive topics safe (EN+KO); parent-preview gate | ☑ passed |

## Log

- **Aug 2026** — Concept locked. Founding docs (PR #1), kickoff (PR #2), progress
  board (PR #3), Story Bible core (PR #4) merged. GitHub write access resolved.
- **Aug 2026** — Spike 0 passed (PR #5); CORS fixed; abuse/cost protection = issue #6.
- **Aug 2026** — Spike A passed; bilingual + identity/wardrobe split (ADR-0001, PR #7).
- **Aug 2026** — Spikes B & D passed; Spike C conditional; chapter economics (ADR-0002).
