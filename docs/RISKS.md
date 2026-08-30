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

## Safety / privacy / legal

- **Third-party AI disclosure + Korea PIPA + AI-content labeling.** P0. *(issue
  #12)* Engineering draft implemented — `docs/privacy-policy.md`, the
  `/privacy` screen, the onboarding consent step, and the AI-generated-content
  label. **Not legally cleared**: legal entity, retention periods, PIPA DPO
  contact, and a native-Korean legal review are still open (see
  `docs/privacy-policy.md`'s `TODO(Jai)` markers and
  `docs/privacy-store-disclosures.md`).
- **Crisis-input & sensitive-topic policy** + Terms disclaimer; Korean safety
  parity. P0. *(issue)*
- **Abuse/cost protection on generate-chapter** (auth + rate limiting). P0.
  *(issue #6)*

## Growth / strategy

- **First-100 bilingual audience match** — is the reachable friends-&-family cohort
  actually bilingual? Pressure-test now that EN+KO is core. P1.
- **Store listing localization** (EN + KO). P2. Draft copy exists —
  `docs/play-store-listing.md` — but is unreviewed by a native Korean
  speaker and needs screenshots/graphics before it can ship.
