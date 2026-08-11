# How We're Building This (with Claude)

A short record of the tools and workflow behind Storyloom, since "build a real
product via Claude" is an explicit goal.

## Roles

- **Jai** — co-founder: product decisions, testing with real parents,
  distribution to the first 100.
- **Claude** — product + engineering execution.

## Tooling

- **Claude Cowork** — where product strategy, research, and these planning docs
  are produced. Drives the GitHub connector to manage the repo and PRs.
- **GitHub connector (MCP)** — the "Claude Github MCP Connector" GitHub App
  (owned by anthropics) handles branches, commits, and pull requests into
  `Jai-Kim/newapp`. It needs **Read and write** on code + pull requests, and the
  app must be **installed on the repo** (not just authorized). See setup note.
- **Web research** — competitive landscape, stack, and store/compliance facts
  (sources in `docs/RESEARCH.md`).
- **Claude Code** — where code generation happens against this repo: the Expo
  app, Supabase schema/functions, generation pipeline, and EAS build/submit.

## Workflow

1. Plan and document in Cowork (PRD, architecture, roadmap) → land via PR.
2. Move to Claude Code for the build loop (run, test, simulator/emulator,
   iterate) against the same repo.
3. Keep docs authoritative: every material product/eng decision is reflected
   here so the repo stays the single source of truth.

## Setup note — GitHub write access (resolved)

Symptom we hit: every write returned `403 Resource not accessible by
integration` while reads worked. Root cause: the "Claude Github MCP Connector"
GitHub App was **authorized but not installed on any repository**, so it had no
write access.

Fix (done): visit `github.com/apps/claude-github-mcp-connector`, **Install** it
on the account, grant **All repositories** (or select `newapp`) with Read/write
on code + pull requests. Writes and PRs work immediately after. If it ever
regresses, re-check the installation at `github.com/settings/installations`.
