# Runbook: separating dev/staging from production Supabase (issue #19)

Internal ops doc. English-only — nothing here is user-facing copy.

## The problem this fixes

There is currently **one** Supabase project, and it is PRODUCTION. The E2E
harness (`pnpm e2e:web`, `pnpm e2e:web:live`) creates and deletes users
against whatever `EXPO_PUBLIC_SUPABASE_URL` resolves to, and `e2e:web:live`
additionally calls real Anthropic/Gemini APIs and spends real money. The
per-commit `e2e:web` job already runs against a local, ephemeral Supabase
stack in CI (`supabase start` in `.github/workflows/e2e-web.yml`), so it is
not at risk — but any human running the harness locally against `.env`, and
`e2e-live-smoke.yml` (which points at `secrets.EXPO_PUBLIC_SUPABASE_URL` /
`secrets.SUPABASE_SERVICE_ROLE_KEY` in CI, scheduled weekly), are pointed at
production today.

This repo-side change makes it *possible* to have a second project and
*impossible to point a non-production run at production by accident* once
that project exists. It does not create the project — that's the step below
that only Jai can do.

## What this PR added

- `EXPO_PUBLIC_PROD_SUPABASE_PROJECT_REF` (optional): once set, `env.ts`
  refuses to start if `EXPO_PUBLIC_SUPABASE_URL` resolves to that project ref
  while `EXPO_PUBLIC_APP_ENV !== 'production'`. See `assertNotProductionSupabase`
  in `env.ts`.
- The same idea for the E2E harness, which is where the real deletes and the
  real spend are: `e2e/support/guard-env.ts`, wired into Playwright's
  `globalSetup` (`playwright.config.ts`). Unlike the app guard, this one
  refuses **unconditionally** on a ref match — the harness has no legitimate
  reason to ever touch production, regardless of `EXPO_PUBLIC_APP_ENV`.
- Both are a **no-op while `EXPO_PUBLIC_PROD_SUPABASE_PROJECT_REF` is unset**,
  so nothing changes until the steps below are done.

## Step 1 — create the staging project (Jai, dashboard)

1. Supabase Dashboard → New project. Suggested name: `storyloom-staging`.
   Same region as the production project (latency + provider egress rules).
2. Note its **project ref** (the subdomain in its API URL, e.g. `abcxyz123`
   from `https://abcxyz123.supabase.co`) and its production counterpart's
   ref — both are needed below.
3. `TODO(Jai)`: decide whether staging needs its own Auth SMTP config, or can
   run with Supabase's default (fine for a low-volume staging project).

## Step 2 — apply the schema

```sh
supabase link --project-ref <staging-ref>
supabase db push   # applies supabase/migrations/*, in order, same as production got
```

Confirm the migration history matches production (`supabase migration list
--linked` on each project) before treating staging as ready.

## Step 3 — which values go where

| Value | `.env` (local dev) | `.env.e2e` (local E2E) | EAS environment | GitHub Actions secret |
|---|---|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` (staging) | ✅ set to staging | inherited from `.env` (`e2e/support/env.ts` reads both) | `development` + `preview` EAS environments → staging | `e2e-live-smoke.yml`'s `secrets.EXPO_PUBLIC_SUPABASE_URL` — `TODO(Jai)`: point this repo secret at staging, or add a second secret and edit the workflow (out of scope for this PR — `.github/workflows/*` wasn't touched here) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` (staging) | ✅ set to staging | inherited from `.env` | same as above | same as above (`secrets.EXPO_PUBLIC_SUPABASE_ANON_KEY`) |
| `SUPABASE_SERVICE_ROLE_KEY` (staging) | never — server/harness only | ✅ `.env.e2e`, staging project's key | n/a (not a client value) | `e2e-live-smoke.yml`'s `secrets.SUPABASE_SERVICE_ROLE_KEY` — `TODO(Jai)`: same as above, move this repo secret to the staging project's service-role key |
| `EXPO_PUBLIC_SUPABASE_URL` / `_ANON_KEY` (production) | never in a dev checkout | never | `production` EAS environment only | `TODO(Jai)`: whichever secret production builds/deploys actually read today — audit before rotating anything |
| `EXPO_PUBLIC_PROD_SUPABASE_PROJECT_REF` | ✅ set once staging exists, to the **production** ref (not staging's) | ✅ same value | set in the `development` and `preview` EAS environments (not `production`) | ✅ add as a repo secret/variable and inject it into `e2e-web.yml`'s and `e2e-live-smoke.yml`'s generated `.env` — `TODO(Jai)`, requires a workflow edit this PR intentionally didn't make |
| Edge Function secrets (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, etc.) | — | — | — | Set **per project** via `supabase secrets set` (or Dashboard → Edge Functions → Secrets) against each project individually — staging needs its own copies, ideally on a separate/lower-limit billing arrangement so a staging bug can't run up the production provider bill. `TODO(Jai)`: decide whether staging gets real provider keys (and pays for its own test generations) or stays stub-only. |

## Step 4 — move the E2E harness off production

1. Copy `.env.e2e.example` → `.env.e2e` (if not already done) and set
   `SUPABASE_SERVICE_ROLE_KEY` to the **staging** project's service-role key
   (Dashboard → staging project → Project Settings → API Keys → `service_role`).
2. Set `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env`
   to the staging project.
3. Set `EXPO_PUBLIC_PROD_SUPABASE_PROJECT_REF` in both `.env` and `.env.e2e`
   to the **production** ref. From this point on, running `pnpm e2e:web:live`
   (or any dev/E2E command) while `.env` still points at production throws
   immediately instead of touching real data — see `e2e/support/guard-env.ts`.
4. `e2e-live-smoke.yml` (`.github/workflows/e2e-live-smoke.yml`) currently
   builds its `.env` from `secrets.EXPO_PUBLIC_SUPABASE_URL` /
   `secrets.EXPO_PUBLIC_SUPABASE_ANON_KEY` / `secrets.SUPABASE_SERVICE_ROLE_KEY`
   — i.e., production, today. This PR does not edit `.github/workflows/*`
   (explicitly out of scope for this slice). `TODO(Jai)`: point those repo
   secrets at staging (or add `_STAGING`-suffixed secrets and update the
   workflow), and add a repo secret for `EXPO_PUBLIC_PROD_SUPABASE_PROJECT_REF`
   so the guard is armed in CI too.

## Step 5 — verify the switch worked

- `pnpm start` with `.env` pointed at staging → app boots normally (guard is
  silent when the URL doesn't match the production ref).
- Temporarily set `EXPO_PUBLIC_SUPABASE_URL` in `.env` back to the production
  URL without changing `EXPO_PUBLIC_APP_ENV` from `development` → `pnpm start`
  (or `pnpm test -- env.test.ts`) should fail loudly with the
  `assertNotProductionSupabase` error naming the production ref. Revert
  afterwards — this is a one-time check, not something to leave set.
- `pnpm e2e:web` locally against `.env`/`.env.e2e` pointed at production
  (same temporary swap) should refuse to start via
  `e2e/support/guard-env.ts`'s Playwright `globalSetup`, before any spec runs.
- Once both checks throw as expected, restore `.env`/`.env.e2e` to staging and
  proceed normally.

## Open items — `TODO(Jai)`

- Whether staging gets its own real provider keys (spends its own money) or
  runs stub-only, per the Edge Function secrets row above.
- Rotating/relocating whichever `.github/workflows/*` secrets currently point
  at production, and adding `EXPO_PUBLIC_PROD_SUPABASE_PROJECT_REF` as a repo
  secret — both require a workflow edit outside this PR's scope.
- Auth SMTP / rate-limit configuration for the staging project.
- Whether EAS's `preview` environment should share staging with `development`
  or get its own third project — this runbook assumes it shares staging.
