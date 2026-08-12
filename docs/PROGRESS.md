# Storyloom — build plan & progress

Snapshot of what we're building and where we are. Update as phases complete.
A standalone visual version is at [`docs/progress.html`](./progress.html)
(open in a browser). Source of truth for detail: `docs/ROADMAP.md` and
`docs/WEEK-1-SPIKES.md`.

## What we're building

| | |
|---|---|
| **Product** | The bedtime storybook that remembers |
| **Moat** | Cross-night memory — a persistent, serialized story world |
| **Who** | Parents of children ages 3–6; first 100 via friends & family |
| **Model** | Freemium → subscription → print keepsakes |
| **First store** | Google Play (iOS close behind) |

## Progress — phase 2 of 5 complete

- [x] **Concept** — idea locked & sharpened
- [x] **Foundation** — research + founding docs, PR #1 merged
- [ ] **Week 1 gate** — de-risk spikes A–D ← *next*
- [ ] **Weeks 2–3** — build core loop + product
- [ ] **Week 4** — ship to Google Play

## Up next — Week 1 build/no-build gate (0 / 4 passed)

| Spike | Pass bar | Status |
|---|---|---|
| A · Character consistency | Same child across ≥3 scenes a parent accepts | ☐ pending |
| B · Cross-night memory | Ch. 2 remembers Ch. 1 from the database | ☐ pending |
| C · Unit economics | Real $/chapter → set price + free tier | ☐ pending |
| D · Safety | Sensitive topics safe; parent-preview gate | ☐ pending |

All four pass → proceed to Week 2. Any that can't be fixed in a day → pivot to
the conversation-coach fallback (`docs/RESEARCH.md §6`).

## Log

- **Aug 2026** — Concept locked ("storybook that remembers"). Founding docs
  merged (PR #1). Kickoff runbook added (PR #2). Repo write access resolved
  (installed the Claude Github MCP Connector).
