# Dodam (도담) Roadmap

> Canonical roadmap is meant to live in ClickUp (Business > Dodam > Now / Next / Later, plus an Architecture doc), the same layout as DermCase Assistant. This file is the in-repo mirror.

_Last updated: Oct 29, 2026_

**Product thesis.** A bilingual (English and Korean on every page) serialized bedtime storybook that remembers the child hero. Books, not a feed (ADR-0003). Grandparents are the likely buyers of the printed keepsake. First reader: Boa.

**Design direction (approved Oct 29, 2026).** "Warm gouache": palette sampled from the Boa illustrations, night-navy reader and Tonight screens, cream parent-side screens, Gowun Batang + Fraunces for story text, Noto Sans KR for UI, logo mark A (crescent moon cradling a sprout). To be recorded as ADR-0006.

**Owners.** Claude = Cowork agent (Play Console, RevenueCat, research, docs). Code = Claude Code desktop (app code, EAS, PRs). Jai = decisions, credentials, phone testing, inviting testers.

---

## Phase 1: Ship to the first 100 (Now)

**Goal.** Dodam is on Google Play closed testing, genuinely useful to about 100 friends and family, with billing proven end to end and nothing in the product that would embarrass us in review.

**Done criteria**
- 12 or more testers opted in to the closed test for 14 continuous days (Play's requirement for a personal developer account)
- At least 5 families read three nights in a row, and tell us what broke
- One real test purchase works end to end (Play, RevenueCat, entitlement, new chapter unlocks)
- Privacy policy and terms published at public URLs, both languages, no open TODOs
- No unsafe chapter reaches a child unreviewed, and a parent can report one in the app

**Target dates (not promises).** Closed test live by Nov 9. 14-day clock ends about Nov 23. Production access application right after.

### Work items

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 1 | Core loop: nightly queue, parent review gate, offline reader, volumes library | Code | done | ADR-0001, 0002, 0004 |
| 2 | Monetization in code: RevenueCat gate on new chapters, paywall, production key guard | Code | done | ADR-0003, PR #52 |
| 3 | Safety: crisis handling, AI-generated labelling | Code | done | docs/sensitive-topics-policy.md |
| 4 | Boa Volume 1 sample (10 chapters) | Code | done | docs/samples/boa-volume-1 |
| 5 | EAS builds, Play internal testing release, tester list | Code, Claude | done | versionCode 8 |
| 6 | Play subscription dodam_pro, monthly base plan, $1.99 for 3 months intro offer | Claude | done | Active |
| 7 | RevenueCat: Play app, product, `pro` entitlement, default offering, goog_ key | Claude | done | Needs item 10 to validate purchases |
| 8 | Play declarations: ads, government, financial, health, advertising ID | Claude | done | Saved as draft, not yet sent for review |
| 9 | Store listing text, English and Korean | Claude | done | Draft |
| 10 | Upload Play service-account JSON to RevenueCat | Jai | open | Credential, so Jai only |
| 11 | Set EXPO_PUBLIC_REVENUECAT_KEY for closed-testing and production; require goog_ key when APP_IDENTITY=production | Code | open | Closes a guard gap |
| 12 | Create reviewer login, fill Play "Sign in details" | Jai | open | Unblocks Target audience |
| 13 | Phone test of build 8: sign-in, chapter, airplane-mode reading, test purchase | Jai | open | Opt-in link in tester doc |
| 14 | Finalize and publish privacy policy and terms (decisions filled in) at public URLs | Code, Claude | open | Contact tixoud@gmail.com, operator Jai Kim (individual) |
| 15 | In-app "Report this chapter" | Code | open | Needed for content rating and AI content policy |
| 16 | In-app account deletion plus a web deletion link | Code | open | Play requires both for apps with accounts |
| 17 | Brand and UI v1 "warm gouache": tokens, fonts, night/day modes, bottom nav, new icon | Code | open | Design approved Oct 29 |
| 18 | Store art: 512 icon, 1024x500 feature graphic, 4 to 6 phone screenshots | Code, Jai | open | Screenshots from build 8 or the redesign |
| 19 | Play forms: content rating, target audience, data safety | Claude | blocked | Needs 12, 14, 15 |
| 20 | Families Policy: written SDK determination for RevenueCat and Supabase | Claude, Jai | open | Decide before review, not during an appeal |
| 21 | Native Korean proofread of listing, policy, terms, in-app strings | Jai | open | Not yet checked |
| 22 | Closed testing track, 12 testers opted in, start the 14-day clock | Claude, Jai | open | Jai invites friends and family |
| 23 | Supabase: confirm plan so it cannot auto-pause, add a staging project | Jai, Code | open | Issue #19 |
| 24 | name_ko on characters and world, so Korean names stop drifting (해뜨섬 vs 해뜰섬) | Code | open | Found in Boa Volume |
| 25 | EAS workflow: poll by build ID, not `--limit 1` | Code | open | Stale-build bug |
| 26 | Edge-to-edge migration off react-native-edge-to-edge | Code | parked | Temporary doctor exclude in place |

---

## Phase 2: Production and print (Next)

**Goal.** Public on Google Play in Korea and the US, and the first hardcovers sold. This phase tests the real business thesis.

**Done criteria.** Production access granted. At least 10 families have finished a Volume. Print or gift take-rate measured against the 25 to 30 percent target in ADR-0003.

| # | Task | Owner | Notes |
|---|------|-------|-------|
| 27 | Apply for Play production access after the 14-day test | Claude, Jai | |
| 28 | Name, trademark and domain check for "Dodam" before production | Jai | The package id com.storyloom is permanent. ADR-0005 gotchas |
| 29 | Korea readiness: Korean-first listing, rating path for Korea, payment methods | Claude | |
| 30 | Bedtime reminder notification | Code | Parent chooses the hour |
| 31 | Crash reporting and anonymous usage counts | Code | Same approach as DermCase D-014 |
| 32 | Concierge print workflow with a POD partner (Gelato, Lulu or Blurb), comp digital for about 6 months | Jai, Claude | Manual first, per ADR-0003 |
| 33 | Gift flow: send a finished book to a grandparent as a read-only link | Code | Grandparents are the buyers |
| 34 | Tablet layouts and tablet screenshots | Code | |
| 35 | Marketing page and domain with the privacy and terms pages moved onto it | Code, Jai | |
| 36 | Support inbox and response process | Jai | |
| 37 | Decide on Teacher Approved and the Play 15 percent service fee program | Jai | Optional programs |
| 38 | iOS decision (App Store, $99 a year) based on which phones friends and family use | Jai | |

---

## Phase 3: Scale and retention (Later)

Depends on what Phase 2 teaches us. Likely directions:

- Multiple children per family
- Grandparent reader accounts and family sharing
- Series arcs across Volumes, so book two continues book one
- Automated print and billing integration
- Open-weights image model to improve margin (ADR-0002)
- Read-aloud audio, after a clear voice and consent policy
- Web reader and iOS app
- Character wardrobe and growth over time (ADR-0001)
- Languages beyond English and Korean

---

## Success metrics

| Metric | Target | Why |
|---|---|---|
| Families who buy or gift a printed Volume | 25 to 30 percent of active families | The business thesis (ADR-0003) |
| Nights read in the first two weeks | 3 or more per family | Habit forms or it does not |
| Parent approval rate on first generation | 90 percent or higher | Quality of the writing and art |
| Reports per 100 chapters | Under 1, each reviewed within 24 hours | Safety |
| Closed-test crash-free sessions | 99 percent or higher | Review readiness |

## Open decisions for Jai

- Legal review of the privacy policy and terms by a lawyer (not yet done)
- Korean proofread by a native speaker
- Whether to pursue Teacher Approved
- Whether and when to build for iOS
