# Google Play Data safety form — worksheet (issue #11)

Internal ops doc. English-only — nothing here is user-facing copy. **This
file does not submit anything** — filing the actual form in Play Console →
App content → Data safety is a manual, human step.

Source of truth for every fact below is `docs/privacy-policy.md` and `docs/
privacy-store-disclosures.md` (written for #12/PR #30) — this file only
re-orders those already-confirmed facts into the shape of Play's
questionnaire, and adds `TODO(Jai)` where the questionnaire asks something
those docs don't answer. **Nothing here should be treated as more current
or more authoritative than those two files** — if this doc and `docs/
privacy-policy.md` ever disagree, `docs/privacy-policy.md` wins and this
file needs updating. Play's exact question wording and data-type taxonomy
changes over time and could not be fetched from this sandbox (no outbound
web access) — confirm the live form's field names before submitting,
same caveat already logged in `docs/privacy-store-disclosures.md`.

## Section: Data collection and security

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | Yes |
| Is all user data collected by your app encrypted in transit? | **`TODO(Jai)`** — Supabase's client libraries use TLS by default and this codebase does not disable it anywhere found, but confirm there is no exception (e.g. a debug-only HTTP escape hatch) before answering "Yes" |
| Do you provide a way for users to request their data be deleted? | **`TODO(Jai)`** — `docs/privacy-policy.md`'s "Deleting your data" section is explicit that only a support-request path exists today, no in-app self-serve deletion. Answer honestly based on whichever is true at submission time, not on what's planned |
| Does your app have an account deletion path inside the app? | No, as of this writing — same `TODO(Jai)` as above |

## Section: Data types

One row per Play data-type category this app plausibly touches. "Shared"
means sent to a party outside Supabase/this app — per `docs/
privacy-policy.md`, that's Anthropic (text) and Google (images), both for
generating the requested story, never for advertising.

| Category | Type | Collected? | Shared? | Purpose | Optional for the user? |
|---|---|---|---|---|---|
| Personal info | Name | Yes — print orders only | No | Account functionality (fulfillment) | Yes — only if ordering a hardcover |
| Personal info | Email address | Yes | No | Account management | No — required to sign up |
| Personal info | Address | Yes — print orders only | No | Account functionality (fulfillment) | Yes — only if ordering a hardcover |
| Photos or videos | Photos | Yes — every chapter's AI-generated illustrations | Yes — generated via Google's image model | App functionality | No — core to the product |
| App activity | Other user-generated content | Yes — the free-text "situation"/"lesson" prompt per chapter | Yes — sent to Anthropic (text) and Google (images) to generate the chapter | App functionality | No — required to generate a chapter |
| App activity | In-app search history / other actions | Chapter approve/reject/read status | No | App functionality (parent-preview gate, library) | No |
| App info and performance | Crash logs, diagnostics | **`TODO(Jai)`** — no crash-reporting/analytics SDK was found in this codebase at the time of writing; confirm before answering "No" in case one is added later without updating this doc | — | — | — |

Play's own AI-generated-content declaration is a separate, newer
questionnaire surface from the data-types table above — see `docs/
privacy-store-disclosures.md`'s existing `TODO(Jai)` on that; not repeated
here.

## Section: Data deletion

- Cross-links `docs/privacy-policy.md`'s "Deleting your data" section
  directly — do not restate the deletion mechanism here, update that file
  first if it changes, then re-check this worksheet's answers above.

## Section: Encryption and independent security review

- Encryption in transit: see the table above, `TODO(Jai)` pending
  confirmation.
- Independent security review: **`TODO(Jai)`** — none has been commissioned;
  answer "No" unless one happens before submission.

## Children's data / Families Policy

- Children are the intended **reader**, but the account holder and every
  generation decision (writing a prompt, approving/rejecting a chapter) is
  an adult parent — the same framing `docs/privacy-store-disclosures.md`
  already uses for the "verifiable parental consent" question.
- The in-app PIPA-shaped consent step (issue #12, #30 — `src/features/
  onboarding/child-setup-screen.tsx`, `supabase/migrations/
  0009_privacy_consent.sql`) records a parent's consent (version + timestamp)
  before any chapter can be generated for their child. Cross-link this,
  don't re-describe its mechanics here.
- **`TODO(Jai)`**: decide whether to declare this app under Play's Families
  Policy / "Designed for Families" program. This is a product and legal
  call with real consequences (SDK allow-list, ad restrictions, a
  different review process) — not answered here, and not implied by
  anything else in this worksheet.

## Cross-links, not duplicates

- Underlying facts and every currently-open `TODO(Jai)`: `docs/
  privacy-policy.md`, `docs/privacy-store-disclosures.md`.
- Consent recording mechanism (#12/#30): `supabase/migrations/
  0009_privacy_consent.sql`, `src/features/onboarding/child-setup-screen.tsx`.
- AI-content labeling (#12/#30): `src/features/legal/ai-generated-notice.tsx`.
- Content-rating questionnaire (a related but separate Play Console form):
  `docs/play-closed-testing.md`.

## Open items — `TODO(Jai)`

- Confirm encryption-in-transit and account-deletion answers reflect what's
  actually shipped at submission time, not this doc's snapshot.
- Families Policy declaration.
- Re-check this worksheet's category names against the live Play Console
  form — its taxonomy has changed before.
