# How we work (operating model)

Two agents build this product; the human (Jai) supervises only at decision points.

## The loop

- **Claude (Cowork)** — product + review. Files work as issues, reviews PRs,
  merges green in-plan PRs, keeps the plan moving. Runs a scheduled review/merge
  pass (`storyloom-pr-driver`) every 4 hours.
- **Claude Code (GitHub Action)** — build. Triggered by `@claude` on issues/PRs;
  builds in CI, pushes, opens PRs.
- **CI** — lint, type-check, jest, and the e2e (stub) suite run on every PR; the
  live smoke runs on demand.
- **`main`** is the source of truth.

## Where Jai reviews — the only human gates

1. **Money** — anything that spends: scaled generation, print fulfillment, a new
   paid service, raising a spend cap.
2. **Product decisions** — pricing, the app name, POD partner, scope, anything
   ADR-worthy.
3. **Taste** — periodically judge whether a generated story + the Korean is
   genuinely good (an agent can't).
4. **Human-gated switches** — secrets, production data, `.github/workflows/*`,
   Google Play Console / app signing / tester recruitment. (The safety layer
   blocks the agents here by design.)
5. **Anything ambiguous or risky** — Claude stops and asks rather than guessing.

Everything else runs without Jai.

## Guardrails

- Never merge failing or pending CI; never merge workflow files (human-only);
  never touch secrets, production data, or spend.
- Read the actual diff on auth / RLS / Edge-Function changes — no rubber-stamping.
- The GitHub Action runs on Jai's Claude subscription; keep it `@claude`-triggered
  to control usage.
