# Risks & open gaps (backlog)

Living backlog from the multi-lens spec gap review (Aug 2026). Priority: **P0** =
address before/around launch, **P1** = soon, **P2** = later. Items marked *(issue)*
have a tracked GitHub issue.

## Highest priority (will bite)

- **Bedtime latency** — ~45s generation vs a nightly ritual → pre-generate the next
  chapter in the background. P0. *(issue)*
- **Offline reading** — cache chapters (text + images) locally for bad-wifi
  bedrooms. P0. *(issue)*
- **Google Play closed testing (12 testers / 14 days)** — use it as the first-100
  channel; start the clock ~Week 3; or register an org account to be exempt. P0.
  *(issue #11)* Repo-side prep implemented — `docs/play-closed-testing.md` (run
  sheet, org-account alternative, content-rating answers), `docs/
  play-store-listing.md` (bilingual store copy, no price stated),
  `docs/play-data-safety.md` (Data safety form worksheet), `docs/
  play-tester-onboarding.md` (bilingual recruiting message + opt-in tracker).
  **Still entirely Jai's to run**: nothing here can recruit testers, create the
  Play Console listing, or start the 14-day clock — every step in the run
  sheet is a `TODO(Jai)`, and the clock hasn't started as of this writing.

## Product / UX

- **Character-look guided picker** (skin tone, hair, glasses…) — parents can't
  write a good character prompt. P1.
- **Regenerate / "don't like it"** path for a chapter or a single page. P1.
- **First-run empty state** → fast, guided path to the first magical chapter. P1.
- **Multiple children** — friends-&-family families often have 2+ kids; may be
  needed sooner than "fast-follow." P2.

## Business

- **Heavy-user economics / cap** — $14.99/mo, 20 chapters, 3 free; enforce + message
  kindly; lift with open weights. P0. *(issue)*
- **Print keepsakes** — headline value prop with no fulfillment/pricing/partner
  yet; thin-validate before leaning on it. P2.
- **Gifting** (grandparents buying a subscription) — no mechanism. P2.

## Engineering

- **Pre-generation queue/schedule** (ties to the latency item). P0.
- **Embeddings provider/dimension** — confirm `vector(1536)` matches the chosen
  model before the canon grows. P1.
- **Partial-failure handling** in the text → safety → images → persist pipeline. P1.
- **Storage growth** — illustrations in Supabase Storage; model cost over time. P2.
- **`supabase/functions/**` has no type-checking wired into CI.** `tsconfig.json`
  excludes `supabase/` entirely — Deno's `npm:`/`jsr:` specifiers and explicit
  `.ts` import extensions don't resolve under this app's Node/Expo
  `tsconfig.json`. ESLint covers all of `supabase/functions/**` (every Edge
  Function entrypoint and every `_shared/` module, formatting/mechanical rules
  only — `max-params` and `max-lines-per-function` are relaxed there, same
  rationale as everywhere else in this directory), but lint alone doesn't
  catch a type error. The **config half is now done**:
  `supabase/functions/deno.jsonc` scopes a Deno project root to that directory
  (strict mode on, the two Jest `_shared/*.test.ts` files excluded — they're
  Node tests, not Deno modules), and `pnpm run check:functions` runs
  `deno check` over the six Edge Function entrypoints, which — since every
  `_shared/` module is reachable from at least one entrypoint's import graph —
  type-checks the whole directory, including `safety.ts`, `crisis.ts`, and
  `quota.ts`, the three functions that review/screen/gate what reaches a child
  or costs money. **Not run yet**: `deno` isn't installed in the build
  sandbox, so this hasn't actually been executed against the current code —
  first run should happen before relying on it. `TODO(Jai)`: wiring
  `check:functions` into CI is a deliberate `.github/workflows/*` change,
  outside this doc's scope, once you've confirmed it passes. P1.

## Safety / privacy / legal

- **Third-party AI disclosure + Korea PIPA + AI-content labeling.** P0. *(issue
  #12)* Engineering draft implemented — `docs/privacy-policy.md`, the
  `/privacy` screen, the onboarding consent step, and the AI-generated-content
  label. **Not legally cleared**: legal entity, retention periods, PIPA DPO
  contact, and a native-Korean legal review are still open (see
  `docs/privacy-policy.md`'s `TODO(Jai)` markers and
  `docs/privacy-store-disclosures.md`).
- **Crisis-input & sensitive-topic policy** + Terms disclaimer; Korean safety
  parity. P0. *(issue #13)* Engineering draft implemented — input-side
  screening (`supabase/functions/_shared/crisis.ts`, ahead of
  `generate-chapter`/`enqueue-chapter`) for abuse, self-harm, acute grief, and
  acute danger, with a warm bilingual care response and real KR/US resources
  (`docs/sensitive-topics-policy.md`, `crisis-resources.ts`) rather than a
  generated story. Screens Korean and English with equal rigour via a model
  call, not keyword matching. **Not verified against a live model in this
  environment** (no network/API key in the build sandbox) — classification
  logic is unit-tested against simulated verdicts
  (`crisis-response.test.ts`), but real phrasing needs a human spot-check
  before launch, and the `acute_grief` boundary is flagged in the policy doc
  as needing your review.
- **Abuse/cost protection on generate-chapter** (auth + rate limiting). P0.
  *(issue #6)*

## Growth / strategy

- **First-100 bilingual audience match** — is the reachable friends-&-family cohort
  actually bilingual? Pressure-test now that EN+KO is core. P1.
- **Store listing localization** (EN + KO). P2. Draft copy exists —
  `docs/play-store-listing.md` — but is unreviewed by a native Korean
  speaker and needs screenshots/graphics before it can ship.
