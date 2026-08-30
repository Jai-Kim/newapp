# Google Play closed testing — run sheet (issue #11)

Internal ops doc. English-only — nothing here is user-facing copy. Companion
docs: `docs/play-store-listing.md` (bilingual store copy), `docs/
play-data-safety.md` (Data safety form worksheet), `docs/
play-tester-onboarding.md` (bilingual tester instructions + recruiting
message + opt-in tracker).

**Everything below is Jai's to execute — none of it can be done without a
Play Console account.** This doc's job is to leave nothing to be figured out
when he sits down to do it.

## Why this exists

`docs/RISKS.md` flags Play's tester requirement as a P0 — it gates the
first-100 rollout channel, and unlike most pre-launch items it runs on a
**clock**, not a checklist: starting it later directly delays launch by
however long it's deferred. Nothing else in this plan has that property.

## The rule, as best understood — confirm before relying on it

Google requires new **personal** developer accounts to run a closed test
with real opted-in testers for a continuous period before they can apply for
production (public) access. As last known (this sandbox has no outbound web
access, same limitation noted in `docs/privacy-store-disclosures.md` for
Play's AI-content questionnaire — **`TODO(Jai)`: re-confirm the exact
current numbers and conditions in Play Console → Testing → Closed testing
before relying on any date derived from this doc**, since Google has changed
these thresholds before and could again):

- **At least 12 testers**, opted in via the track's opt-in URL.
- **For at least 14 continuous days.**
- Only after both are satisfied can the account apply for production access.
- Dropping below 12 opted-in testers, or letting the test lapse, is
  understood to reset or pause the clock — **`TODO(Jai)`: confirm the exact
  reset condition in Console**, since "opted in" and "actively using" are
  not necessarily the same signal Google measures.

## Two ways to satisfy this — pick one, `TODO(Jai)`

| Path | What it takes | Trade-off |
|---|---|---|
| **Run the closed test** | Recruit 12 people (`docs/play-tester-onboarding.md`), keep them opted in for 14 straight days | Free, but costs 2+ calendar weeks before production access is even possible — start this as early as the app is installable, not when it's polished |
| **Register an organization developer account** | A registered business entity (D-U-N-S number verification, ~$25 one-time fee, same as today's personal-account fee) | Understood to be **exempt** from the 12/14-day closed-testing gate — `TODO(Jai)`: confirm this is still current Play Console policy and whether Storyloom has (or should get) a business entity to register under, since that's a legal/business decision, not a technical one |

Registering an org account, if viable, is the faster path — it removes the
14-day floor entirely. Whether Jai has (or wants to set up) a business
entity to register under is outside this doc's scope to decide.

## Internal testing vs. closed testing — don't confuse the tracks

- **Internal testing**: up to 100 testers by email list, releases available
  within minutes, no Google review. Good for a first smoke test of a real
  build on a real device before inviting anyone external. **Does not** count
  toward the 12/14-day requirement.
- **Closed testing**: a reviewed release, testers opt in via a shareable
  link or an email list, and **this is the track that counts** toward the
  production-access requirement above.

Run an internal-testing pass first (Jai + maybe one other person) to catch
install-breaking issues before spending any of the 12 testers' goodwill on a
build that crashes on open.

## Run sheet

1. **`TODO(Jai)`** — decide personal-account-and-wait vs.
   organization-account-and-skip (table above).
2. **`TODO(Jai)`** — Play Console → create the app listing (package name
   `com.storyloom`, per `env.ts`'s `PACKAGES.production` — confirm this
   matches what Console expects; production and closed-testing builds should
   ship the same `applicationId`, not the `.preview`/`.development`
   variants).
3. **Build the first testable artifact.**

   ```sh
   eas build --profile closed-testing --platform android
   # or: pnpm build:closed-testing:android
   ```

   `eas.json` now has a dedicated `closed-testing` profile
   (`"buildType": "app-bundle"`, `"distribution": "store"`), so this
   produces an `.aab` — unlike the `preview` profile, which builds a raw
   `apk` and cannot be uploaded through the standard Play publishing flow
   (internal testing's "internal app sharing" accepts an APK, but that's a
   separate mechanism from the closed-testing track described above).

   **Read this before running it for real — a real trade-off, not a
   formality.** The profile's `"env": {"EXPO_PUBLIC_APP_ENV": "production"}`
   is required to get the plain `com.storyloom` `applicationId` — `env.ts`'s
   `PACKAGES`/`BUNDLE_IDS` maps tie the package name 1:1 to
   `EXPO_PUBLIC_APP_ENV`, and only `production` yields the unsuffixed
   package the Play listing needs (see step 2 above). That, in turn, makes
   the `assertNotProductionSupabase` guard from #19/#31 a **no-op for this
   profile** — the guard is designed to stand down whenever
   `EXPO_PUBLIC_APP_ENV === 'production'`, since a real production build is
   supposed to point at production, and a closed-testing build inherits
   that same exemption even though it isn't actually production. This was a
   deliberate call, not an oversight: getting the package name right is a
   hard Play requirement (a mismatched `applicationId` can't be uploaded to
   the listing at all), so it wins over the softer safety goal — and
   `env.ts`'s package-name derivation was intentionally left unchanged
   rather than decoupled to fix this, since that's a larger change than
   this slice's scope.

   What *does* still steer this build away from production data: the
   profile sets `"environment": "preview"` (the EAS-hosted secrets
   selector, separate from `EXPO_PUBLIC_APP_ENV`), so the Supabase URL/anon
   key it builds with come from EAS's `preview` environment rather than
   `production` — per `docs/runbook-environments.md`'s Step 3 table,
   `preview` is mapped to the **staging** project once it exists.
   **`TODO(Jai)`**: this only protects real family data once the staging
   project exists (#19) and the `preview` EAS environment is actually
   populated with its URL/keys, not production's — confirm that before
   running this profile for real. If the `preview` EAS environment is ever
   accidentally set to production values, this profile would silently
   build against production with no guard to catch it, precisely because
   of the exemption above.
4. **`TODO(Jai)`** — Play Console → Testing → Closed testing → create a
   track, upload the `.aab`, generate the opt-in URL. Hand that URL to
   `docs/play-tester-onboarding.md`'s tracker.
5. **`TODO(Jai)`** — App content section: complete the Data safety form
   (`docs/play-data-safety.md`), the content-rating questionnaire (below),
   and the target-audience/Families declaration the data-safety worksheet
   flags as undecided.
6. **`TODO(Jai)`** — Store listing: paste in `docs/play-store-listing.md`'s
   EN copy as the default listing, then add Korean as a second listing
   language with the KO copy from the same file.
7. Recruit 12 testers (`docs/play-tester-onboarding.md`'s recruiting
   message) and get them opted in. **The 14-day clock starts once 12 are
   concurrently opted in**, not from when the track was created.
8. Hold the test for 14 continuous days without dropping below 12 opted-in
   testers (per the reset-condition caveat above).
9. **`TODO(Jai)`** — apply for production access once the window closes
   clean.

## Content-rating questionnaire — honest answers for the questions we can answer now

Play's content-rating questionnaire (IARC) asks about content categories.
The exact question wording changes periodically — confirm against the live
form — but the honest, current-facts answers are:

- **User-generated content**: yes, functionally — a parent types a free-text
  "situation" prompt per chapter. It is never shown to any other user (no
  sharing, no feed, no comments), reviewed by the parent before the child
  sees it (the parent-preview gate), and screened for crisis/sensitive
  content before generation (issue #13, `supabase/functions/_shared/
  crisis.ts`, once merged). Answer the "shared with or visible to other
  users" sub-question **no**.
- **AI-generated content**: yes, all chapter text and every illustration.
  Every chapter carries the in-app "Made with AI" label (`src/features/
  legal/ai-generated-notice.tsx`, issue #12/#30). **`TODO(Jai)`**: Play's
  specific AI-content declaration questionnaire is newer and its exact
  wording could not be fetched from this sandbox — read it directly in
  Console before submitting, same open item already logged in `docs/
  privacy-store-disclosures.md`.
- **Violence, sexual content, profanity, controlled substances**: none by
  design — the app targets children ages 3–6, and `_shared/safety.ts`
  reviews every generated chapter (text and each illustration) before it's
  ever stored, failing closed on a reviewer refusal.
- **Target audience / "Designed for Families"**: children are the intended
  reader, but every account holder and generation decision is an adult
  parent. **`TODO(Jai)`**: decide, per `docs/play-data-safety.md`, whether to
  declare under Play's Families Policy — this changes SDK/ad restrictions
  and the review process materially and is a product/legal call, not
  answered here.

## Open items — `TODO(Jai)`

- Personal-account-and-wait vs. organization-account-and-skip.
- Confirm the current 12-tester/14-day thresholds and reset condition
  directly in Play Console.
- The `closed-testing` EAS profile (`eas.json`) is added, but the `preview`
  EAS environment it reads Supabase credentials from needs to actually be
  pointed at the staging project (#19) before the first real build — it
  currently pulls whatever `preview` is configured to today.
- The production-Supabase guard (`assertNotProductionSupabase`, #19/#31) is
  inert for `closed-testing` builds by construction, since the profile must
  set `EXPO_PUBLIC_APP_ENV: "production"` to get the correct
  `applicationId`. Worth a stronger guard (e.g. one keyed off the EAS
  profile/channel rather than `EXPO_PUBLIC_APP_ENV` alone) once there's
  room to revisit `env.ts` — not attempted here since this slice was scoped
  to config + docs only.
- No Android signing credentials / Play App Signing enrollment were
  configured — `eas.json`'s `closed-testing` and `submit.closed-testing`
  entries have no credentials wired in; `eas build`/`eas submit` will
  prompt for that interactively when Jai first runs them.
- Families Policy / "Designed for Families" declaration.
- Everything under "Run sheet" above that only Jai's Play Console access can
  execute.
