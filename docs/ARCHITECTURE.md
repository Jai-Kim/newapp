# Technical Architecture — Storyloom (working title)

Status: Draft v1 · Owner: Claude (eng) · Date: Aug 2026

---

## 1. Guiding principle

The moat is **memory that lives outside the model's context window.** Incumbents
fail at continuity because they rely on the prompt/context to "remember."
Storyloom keeps a durable, structured **Story Bible** in a database and does
*retrieval-augmented storytelling*: fetch the relevant canon, inject it into the
generation prompt, generate the chapter, then write new events back to the
Bible. This is what a one-off generator structurally cannot copy.

## 2. Stack (decisions)

| Layer | Choice | Why |
|---|---|---|
| App (client) | **Expo + React Native** | One codebase → both stores; EAS Build/Submit; hands-off-friendly. |
| Backend/data | **Supabase** (Postgres + Auth + Storage) | Managed Postgres is the natural home for the Story Bible; auth + file storage included. |
| Payments | **RevenueCat** | Abstracts App Store / Play IAP; paywalls, trials, entitlements. |
| Story generation | **Claude (Anthropic API)** | Long-form narrative + structured JSON canon updates. |
| Illustration (phase 1) | **Nano Banana Pro 2 (Gemini image)** for reference-based consistency; **Flux Kontext** for targeted edits | Fastest path to a working, consistent look; ship the spike on APIs. |
| Illustration (phase 2, cost) | **Open weights: Flux.1-dev + PuLID / InstantID + a fixed storybook style LoRA**, self-hosted on serverless GPU (Replicate / Modal / RunPod) | Slashes per-image cost at volume and gives us full control of the house art style — directly protects the unit economics. |
| Build/submit | **EAS Build + EAS Submit** | Produces `.aab`/`.ipa`; submits to both stores from CLI. |
| Starter | **Obytes React Native Starter (MIT, open-source)** — Expo Router, TS, NativeWind, React Query, Zustand, i18n, MMKV, GitHub Actions | Production-grade, free, the boilerplate paid kits benchmark against. (Ignite by Infinite Red = alternative.) |

**Open-source-first stance:** we build on open, MIT-licensed foundations (Obytes
starter; open-weight image models) wherever it improves control, cost, or
longevity, and use paid APIs only where they buy speed we need *now*. RevenueCat
has a generous free tier; Supabase is open-source. We adopt the boilerplate for
auth/paywall/navigation plumbing, then build the Story Bible + generation as our
proprietary core.

## 3. Data model — the Story Bible (the moat)

Postgres (Supabase). Per family / child:

- **`families`** — parent account (owner of all data, billing).
- **`children`** — `id`, `family_id`, `first_name`, `age_band`, `character_ref`
  (pointer to locked character sheet image + descriptor). Minimal PII by design.
- **`characters`** — recurring cast: `name`, `role`, `traits`, `visual_ref`
  (locked reference image), `first_appeared_chapter`.
- **`world`** — places/objects/lore: `name`, `type`, `description`, `visual_ref`.
- **`threads`** — open narrative arcs & promises: `summary`, `status`
  (open/resolved), `opened_chapter`, `resolved_chapter`. *(This is the
  "Captain Elephant promised to return to Cloud Kingdom" table.)*
- **`chapters`** — `number`, `title`, `lesson`, `situation`, `body`, `summary`,
  `embedding` (pgvector), `created_at`, illustration refs.
- **`lessons_taught`** — log of values/situations covered (avoid repetition,
  show the parent progress).

**Retrieval per generation:** most recent N chapter summaries + all `open`
threads + characters/world referenced recently + top-k semantically related past
chapters (pgvector) for the chosen lesson.

## 4. Generation pipeline (nightly chapter)

1. **Assemble context** — parent picks lesson/situation; server retrieves canon
   (see §3) and builds a compact "story-so-far" brief.
2. **Write chapter** — Claude generates the chapter *and* a structured JSON
   delta: new/updated characters, new world items, threads opened/resolved,
   chapter summary. Age-appropriate style controls by `age_band`.
3. **Safety pass** — content filter + policy check before anything is shown;
   parent preview gate for the child-facing view.
4. **Illustrate** — for each scene/page, call the image model with the child's
   and characters' **locked references** + the scene description; targeted edits
   via Flux Kontext so faces never drift. Persist images to Storage.
5. **Persist canon** — apply the JSON delta to the Story Bible; write chapter +
   embedding.
6. **Deliver** — render the read-together chapter view; update streak/metrics.

Character-consistency method (per 2026 best practice): lock identity in a single
high-quality reference (1024²+, multiple angles), reuse that reference for every
shot, use explicit identity-preservation prompts, edit only targeted regions.

## 5. Secrets & API keys

All model/provider keys live server-side (Supabase Edge Functions or a thin API
layer) — **never** in the client bundle. Client talks only to our backend.
`.env.example` documents required vars; real `.env` is gitignored.

## 6. Cost model (unit economics — must validate week 1)

Dominant cost = illustration. Per chapter ≈ (pages × image cost) + LLM tokens.
Levers to protect margin: cap free-tier chapters; 3–4 richer images rather than
many; reuse/cache establishing shots of recurring characters/places; choose the
cheapest image model that holds quality; batch. **Two-phase strategy:** phase 1
uses image APIs (fast to ship); phase 2 moves to self-hosted open weights
(Flux + PuLID/InstantID + style LoRA) on serverless GPU, which can cut cost per
image by a large multiple once volume justifies the setup. **Week-1 spike must
measure real $/chapter for both paths and set the free-tier limit + subscription
price from the numbers.**

## 7. App-store submission plan

- Build with **EAS Build** → Android `.aab`, iOS `.ipa`.
- Submit with **EAS Submit** (needs a Google Play service-account key; Apple
  Developer account for iOS).
- **Play Console 2026 mandatory forms:** Content Rating (IARC), Data Safety
  (declare data collected), Target Audience (children? → triggers COPPA path).
- **Decision:** Google Play first (lower cost, faster/leaner review → fastest
  path to the "submitted for review" goal). iOS immediately after.

## 8. Compliance (kids + privacy)

- Parent-owned account; collect **minimal child data** (first name + age band).
- Parent-gated purchases and settings.
- Content filters + parent preview before child sees a chapter.
- COPPA-aware data handling; GDPR/CCPA basics (deletion/export).
- Clear, parent-facing privacy policy; no third-party ad SDKs; no selling data.

## 9. Week-1 de-risking gate (build/no-build)

Before committing the month, prototype the two hard things and prove them
(full specs in `docs/WEEK-1-SPIKES.md`):

1. **Character consistency:** same child + recurring character look consistent
   across ≥3 separately generated scenes. *Pass bar:* a parent would accept it.
2. **Cross-night memory:** generate chapter 2 that correctly continues a thread
   from chapter 1, sourced from the DB (not the prompt window).
3. **Cost:** measured $/chapter within a range that supports a sane price.

If all pass → proceed. If not → pivot to the conversation-coach concept
(documented as the fallback in `docs/RESEARCH.md`) with time to spare.

## 10. High-level system diagram (textual)

```
[Expo RN app] --auth/paywall--> [Supabase Auth / RevenueCat]
      |
      | "generate tonight's chapter (lesson X)"
      v
[Backend API / Supabase Edge Fn]
   1. retrieve canon  <----> [Postgres: Story Bible + pgvector]
   2. Claude: chapter + JSON delta  <----> [Anthropic API]
   3. safety pass
   4. illustrate (locked refs)      <----> [Nano Banana Pro 2 / Flux Kontext]
   5. persist canon + images        ----> [Postgres + Supabase Storage]
      |
      v
[Read-together chapter view] --> metrics/streak
```
