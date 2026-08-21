# ADR-0004 — Pre-generation: choose tomorrow tonight

Status: accepted · Date: Aug 2026

## Context

A chapter takes ~90s to make (bilingual text + 4 illustrations). That is
unacceptable at bedtime, and a nicer spinner doesn't fix a 90-second wait. The
real fix is to not be waiting at all.

## Decision

**Reorder the loop.** At the end of tonight's read, the parent chooses what
*tomorrow's* chapter is about. It's written and illustrated in the background,
and opens in one tap the next night.

This reordering is what makes pre-generation possible at all — you can't
pre-generate a chapter whose subject is chosen at the moment it's wanted. Bonus:
the **parent-preview / safety gate moves off the bedtime path** too (review at
2pm, not another wait at 8pm).

## Consequences & edge cases

- **The first chapter** has no "previous night." Onboarding generates chapter 1
  — the one acceptable wait, framed as "creating your first story…" — after which
  the choose-tomorrow rhythm begins. *(Confirm this path exists.)*
- **Background durability:** the worker uses `EdgeRuntime.waitUntil`. If the
  platform kills the isolate early, the job is left `running` and a **sweep on
  app open** revives it — so it degrades to "generated a bit later," never
  "never." This is the riskiest unverified path; watch it on the first real run.
- **Spend exactly once:** a partial unique index (one live job per child) +
  conditional claim prevents a double-tap or second device from paying two
  providers twice.
- Image cost/latency are unchanged; this decision is purely about *when*
  generation happens.
