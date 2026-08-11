# Roadmap — Storyloom (working title)

Status: Draft v1 · Horizon: August 2026 (4 weeks) · Goal: submit to a store with
a genuinely useful v1.

---

## Sequencing principle

De-risk the two hard, novel things (character consistency + cross-night memory)
**before** building polish. If they can't be made to work, we learn it in week 1,
not week 4.

## Week 1 — Prove the moat (build/no-build gate)

- Stand up repo, Expo app shell, Supabase project, provider keys (server-side).
- **Spike A — character consistency:** lock a child + one recurring character;
  generate the same cast across ≥3 scenes; judge acceptability.
- **Spike B — cross-night memory:** minimal Story Bible tables; generate chapter
  2 that continues a chapter-1 thread pulled from the DB.
- **Spike C — cost:** measure real $/chapter; set free-tier limit + price band.
- **Gate:** all three pass → continue. Otherwise pivot to conversation-coach.

## Week 2 — Core loop end to end

- Onboarding: parent account, one child profile, character look, interests.
- "Tonight's chapter" flow: pick lesson/situation → generate illustrated chapter
  → read-together view.
- Story Bible fully wired (retrieve → generate → persist delta).
- Safety pass + parent preview gate.

## Week 3 — Make it a product

- Chapter library / revisit past chapters; streak + "tune in tomorrow" hook.
- Paywall + trial via RevenueCat; free-tier limit enforced.
- Content-rating/data-safety/target-audience prep; privacy policy; parent gate.
- Seed 5–10 friends-&-family parents for private testing; collect feedback.

## Week 4 — Ship

- Bugfix + polish from test feedback; empty/error states; onboarding cleanup.
- EAS Build → `.aab` (+ `.ipa`); EAS Submit to **Google Play** (iOS if ready).
- Store listing: name, icon, screenshots, description, privacy forms.
- **Milestone: submitted for review.** Then expand rollout toward the first 100.

## Fast-follows (post-August)

Voice narration + parent-voice recording · print keepsake volumes · child-driven
choices · multi-child / multi-parent · web · iOS parity if Android-first.

## Definition of done for v1

1. A friends-&-family parent can, unaided, create a child, generate an
   illustrated chapter that lands a chosen lesson, and read it tonight.
2. Chapter 2 visibly *remembers* chapter 1 (a returning character or thread).
3. Subscription paywall works; content is child-safe and parent-gated.
4. App is **submitted to at least one store for review.**
