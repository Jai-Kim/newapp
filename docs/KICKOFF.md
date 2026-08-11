# Kickoff — Moving to Claude Code for Week 1

This is the runbook to leave Cowork (planning) and start the build in Claude
Code against this repo. The goal of Week 1 is the **build/no-build gate** in
`docs/WEEK-1-SPIKES.md`.

---

## 1. Accounts & tools you'll need

| Need | For | Notes |
|---|---|---|
| Node.js LTS + Git | Everything | Install once. |
| Claude Code CLI | The build loop | `npm install -g @anthropic-ai/claude-code`. |
| Android Studio **or** Expo Go app | Run the app | Emulator, or Expo Go on your own phone (easiest). |
| Supabase project | Story Bible DB | You already have Supabase; make a new project, enable **pgvector**. |
| Anthropic API key | Story generation | From the Claude Developer Platform. |
| One image API key | Illustrations (Spike A) | **Google Gemini** (Nano Banana) *or* **Replicate** (Flux/InstantID). |

Not needed until later (Weeks 3–4): RevenueCat, an Expo/EAS account, and a
Google Play Console account ($25 one-time).

## 2. One-time setup

```bash
# install and sign in
npm install -g @anthropic-ai/claude-code
claude            # follow the login prompt once

# get the repo
git clone https://github.com/Jai-Kim/newapp.git
cd newapp

# start Claude Code inside the repo
claude
```

Then paste the kickoff prompt in section 3. When Claude Code asks for API keys,
put them in a local `.env` (never commit it — it's gitignored). All provider keys
live server-side per `docs/ARCHITECTURE.md §5`.

## 3. Kickoff prompt (paste into Claude Code)

> You are the engineering co-founder on Storyloom. First read `docs/PRD.md`,
> `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, and `docs/WEEK-1-SPIKES.md` — they
> are the source of truth. We are executing the Week 1 build/no-build gate. Work
> on feature branches and open a PR into `main` after each spike; update the gate
> table in `docs/WEEK-1-SPIKES.md` as you go. Never hardcode secrets — ask me to
> put keys in `.env`.
>
> **Spike 0 — scaffolding.** Initialize the app from the Obytes MIT React Native
> starter (Expo Router, TypeScript, NativeWind). Create the minimal Supabase
> schema from ARCHITECTURE §3 (`families`, `children`, `characters`, `world`,
> `threads`, `chapters` with a pgvector `embedding`, `lessons_taught`). Stand up
> a thin server layer (Supabase Edge Functions) that holds all provider keys
> server-side. Add `.env.example`. Done when the app boots on an emulator / Expo
> Go and a server function can call Claude + the image API. Then stop and report.
>
> **Spike A — character consistency.** Lock a child + one recurring companion as a
> character reference and render them across ≥3 separate scenes in one storybook
> style. Output a comparison grid. Pass bar: a parent accepts it as the same kid.
> Stop and report.
>
> **Spike B — cross-night memory.** Implement retrieve → generate → persist.
> Generate chapter 1 that opens a thread; then, in a fresh process with no chat
> history, generate chapter 2 that continues that thread using ONLY data
> retrieved from Supabase. Print both chapters and the retrieved canon. Pass bar:
> specific, correct continuity. Stop and report.
>
> **Spike C — cost.** Measure real $/chapter and latency for the image path;
> propose a subscription price + free-tier chapter limit. Stop and report.
>
> **Spike D — safety.** Add a content filter + a parent-preview gate; test
> sensitive prompts (a scary topic, a medical visit, a death in the family).
> Stop and report.

## 4. Week 1 sequence & gate

1. Spike 0 → 2. Spike A → 3. Spike B → 4. Spike C → 5. Spike D → 6. Gate review.

The two spikes that carry real risk are **A** (consistency) and **B** (memory).
All four pass → proceed to Week 2 (core loop). Any that can't be fixed in a day
→ pivot to the conversation-coach fallback (`docs/RESEARCH.md §6`).

## 5. Jai's checkpoints

- After Spike A: eyeball the character grid — is it "the same kid"?
- After Spike B: read chapter 2 — does it genuinely remember chapter 1?
- After Spike C: approve the price + free-tier limit.
- Then: green-light Week 2, or call the pivot.
