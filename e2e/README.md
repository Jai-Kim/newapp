# E2E — the core loop

Two layers over one flow: **sign up → onboarding → look picker → first chapter →
read it → choose tomorrow**.

`E2E_MODE` picks the layer. The spec is the same file in both, deliberately —
otherwise "the same flow against real providers" quietly becomes a second,
subtly different script that passes for different reasons.

| | `stub` (default) | `live` |
|---|---|---|
| AI providers | deterministic fixtures | real Anthropic + Gemini |
| Edge Functions | intercepted at the boundary | the deployed functions |
| Database, RLS, constraints | **real** | real |
| Background worker + sweep | not exercised | exercised |
| Cost / duration | free, ~1 min | ~$2, ~10 min |
| When | every commit | manual, weekly, pre-release |

```bash
pnpm e2e:web          # stubbed
pnpm e2e:web:live     # real providers
```

## Why the database is real in both modes

Three of the four things this suite exists to prove are properties of Postgres,
not of the app:

- the child **persists** — a row owned by this user, visible under RLS to a
  client that shares nothing with the app but the account;
- choosing tomorrow queues **exactly one** job;
- a concurrent double-submit **does not** buy a second chapter — enforced by the
  partial unique index on `chapter_queue`, not by a branch in the app.

Asserting those against a mocked database would prove only that the mock was
written to agree with the test.

## What stub mode does not cover

By construction: the inside of the Edge Functions, the provider request and
response contracts, `EdgeRuntime.waitUntil`, and the sweep. That is exactly what
live mode is for. **Neither layer is sufficient alone** — stub mode would pass
while generation was completely broken, and live mode is too slow and too
expensive to gate a commit on.

One detail worth knowing if you edit the stubs: `stubEnqueue` deliberately does
**not** complete the job. The real `enqueue-chapter` returns while the job is
still running, and a stub that finished instantly would make the double-submit
assertion pass for the wrong reason — a second job would be perfectly legal
because the first was already done. `runStubWorker` is the separate, explicit
"a night passed" step.

## Getting a session (`E2E_AUTH`)

The awkward part, and worth reading before changing it.

The project has **email confirmation on**, which is right for production and
means a programmatic sign-up returns a user with no session. Worse for a suite:
every sign-up sends mail through Supabase's built-in SMTP, which is rate-limited
to a handful an hour. A suite that signs up on each run stops working by the
third run of the morning — this is not hypothetical, it is what happened while
building this.

| `E2E_AUTH` | How | Drives the sign-up screen | Sends mail | Good for |
|---|---|---|---|---|
| `admin` | service-role client creates the user pre-confirmed | no | no | CI against a project with confirmation on |
| `autoconfirm` | sign-up returns a session immediately | **yes** | no | local Supabase, or a project with confirmation off |
| `sql-confirm` | sign up, then confirm that one address over the CLI's privileged connection | **yes** | one per run | occasional runs against the real project |

Default: `admin` when `SUPABASE_SERVICE_ROLE_KEY` is set, otherwise
`sql-confirm`.

`admin` needs `SUPABASE_SERVICE_ROLE_KEY` **in the test environment only** — a
gitignored `.env.e2e`, or a CI secret. It must never reach the app bundle
(ARCHITECTURE §5); nothing under `src/` reads it.

CI uses `autoconfirm` against a local Supabase, which has no mailer limit and
confirms on sign-up — so the per-commit suite drives the real sign-up screen
every time, for free.

## Test accounts

One throwaway account per run, at `@storyloom-e2e.example.com`. `example.com` is
reserved by RFC 2606 and has no mail service, so a stray run can never reach a
real person. (`.invalid` would be safer still, but Supabase rejects the TLD.)

Teardown deletes the account; `families.auth_user_id` cascades from
`auth.users`, and every Story Bible table cascades from `families`, so one
delete is the whole cleanup.

## Fixtures

`fixtures/chapter.ts` is a real bilingual chapter, not lorem. The Korean side is
real Korean because the assertion that matters is that both languages survive
the path from Postgres to two lines of text on a page — a fixture whose `ko` was
ASCII would pass a "not empty" check while hiding an encoding bug. Assertions
check the **script** (`/[가-힯]/`), not just non-emptiness.
