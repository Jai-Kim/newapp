# Storyloom (working title)

**The bedtime storybook that remembers.**

Storyloom turns your child into the recurring hero of an ongoing, illustrated
story world that *persists and grows every night* — and lets the parent steer
the lesson of each new chapter. Months of chapters become printed keepsake
volumes.

> Working title only. Naming is an open decision (see `docs/PRD.md`).

## The one-sentence wedge

Every other AI story app generates *one-off* books; **Storyloom builds a
persistent, serialized story world that remembers what happened last night** —
the gap the market has explicitly not closed.

## Why this exists

The AI kids-story market is large and validated (~$3.2B in 2025, personalization
~38% of revenue) but crowded. The obvious features — child-as-hero, hardcover
print, one-off "values" stories, photo-based character consistency — are already
table stakes across MagicLight, Little Stories, KidTeller, Childbook.ai, Custom
Heroes, Make My Book, and others. The one thing incumbents have **not** solved,
because their business is one-off book generation, is **cross-night memory and
an evolving, serialized story world**. That is our wedge and our moat.

## Goals for v1 (August)

1. Solve a real, recurring parenting problem: *"I need to help my kid through
   something this week, and I don't have the words."*
2. Be genuinely useful to **100 people we can reach** (parents in friends &
   family) — not everyone, but those 100 love it.
3. **Submit to at least one app store** (Google Play first; iOS close behind).

## Repository map

- `docs/PRD.md` — Product requirements: problem, insight, users, scope,
  monetization, metrics, risks.
- `docs/ARCHITECTURE.md` — Technical architecture: stack, the persistent-memory
  design (the moat), character consistency, cost model, store submission.
- `docs/ROADMAP.md` — The 4-week August plan, with a week-1 de-risking gate.
- `docs/WEEK-1-SPIKES.md` — Detailed de-risking spikes, ready for Claude Code.
- `docs/RESEARCH.md` — Competitive landscape and stack decisions, with sources.
- `docs/HOW-WE-BUILD.md` — How this product is being built with Claude.

## Founders

- **Jai** — product decisions, testing, distribution to the first 100.
- **Claude** — product + engineering execution (planning in Cowork; code in
  Claude Code against this repo).

## Status

Day 0. Founding docs land via PR #1. Code generation moves to Claude Code.
