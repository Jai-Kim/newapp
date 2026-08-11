# Research — Market & Stack Decisions

Status: Draft v1 · Date: Aug 2026 · All findings sourced below.

---

## 1. Market: validated but crowded

- The AI-generated interactive storybook market was ~**$3.2B in 2025**, with
  personalized storybooks ~**38.4%** of revenue. Demand is proven.
- Crowded field of incumbents: MagicLight, Little Stories (human-written
  benchmark, parent-voice, 10+ languages), Bedtime Stories, KidTeller,
  Childbook.ai, StoryMagician, Custom Heroes, Make My Book, StoryHero, Little
  Hero, Imagitime.
- **Already table stakes (do NOT treat as differentiators):** child-as-hero,
  hardcover print, photo-based character consistency (Little Hero, Imagitime,
  Custom Heroes), and even situation/values stories — Make My Book already does
  "dealing with fears / preparing for a hospital visit."

## 2. The unsolved gap = our wedge

Reviewers explicitly call out the failure incumbents haven't fixed: tools "have
barely enough context to maintain consistency within a single story, let alone
remember that last Tuesday's bedtime adventure ended with Captain Elephant
promising to return to the Cloud Kingdom." **Cross-night memory + an evolving,
serialized story world is open** — and structurally hard for one-off generators.
Storyloom targets exactly this.

## 3. Character consistency (top technical risk) — state of the art 2026

- **Nano Banana / Nano Banana Pro 2** (Google, Gemini image) hold face, outfit,
  proportions across scenes; take a reference image directly; strongest identity.
- **Flux Kontext** for targeted edits (swap outfit/scene, keep the face fixed).
- **Default reliable workflow:** lock identity in one high-quality reference
  (≥1024², 3–6 angles), reuse it for every shot, use explicit
  identity-preservation prompts, iterate rather than one-shot.

## 4. Stack decisions

- **Expo + React Native** → one codebase, both stores, EAS Build/Submit.
- **Supabase** (Postgres + Auth + Storage) → natural home for the Story Bible;
  auth + storage bundled; scales to tens of thousands of MAU on entry tiers.
- **RevenueCat** → cross-store subscriptions/paywalls/trials/entitlements.
- **Boilerplate (open-source first):** **Obytes RN Starter** (MIT) — Expo Router,
  TS, NativeWind, React Query, Zustand, i18n, MMKV, GitHub Actions; 4.2k+ stars;
  the free starter paid kits benchmark against. **Ignite** (Infinite Red) is the
  battle-tested alternative. Paid kits (Shipnative/ExpoBase) only if they clearly
  save time over Obytes.
- **Open-weight image path (cost/control):** Flux.1-dev + **PuLID / InstantID**
  (face identity) + a fixed **storybook style LoRA**, via ComfyUI on serverless
  GPU. The three credible 2026 open consistency methods are IP-Adapter FaceID,
  PuLID, and InstantID; InstantID favors fidelity + editability.
- **Story generation:** Claude (Anthropic API) for narrative + structured canon
  deltas.

## 5. App-store / compliance facts

- **EAS Submit** takes a valid `.aab` (Android) or `.ipa` (iOS); Google requires
  app bundles; needs a Google service-account key.
- **Play Console 2026** requires three mandatory forms: Content Rating (IARC),
  Data Safety, and Target Audience (children? → COPPA path).
- Kids apps: COPPA violations → app removal + account suspension; GDPR/CCPA also
  apply. Design minimal-data, parent-owned, parent-gated.

## 6. Fallback concept (if week-1 gate fails)

**Conversation coach** — voice roleplay for high-stakes conversations
(interview, negotiation, hard talks), personalized by pasted context (email
thread, JD, notes). Bluer ocean, higher willingness to pay; harder to seed via
friends & family and more episodic. Kept as documented pivot.

## Sources

- [7 Best AI Tools to Create Animated Bedtime Stories for Kids in 2026 (EntheosWeb)](https://www.entheosweb.com/7-best-ai-tools-to-create-animated-bedtime-stories-for-kids-in-2026/)
- [Best Personalized Bedtime Story Apps 2026 (bedtime-stories.fun)](https://www.bedtime-stories.fun/blog/personalized-bedtime-story-apps)
- [AI Children's Books in 2026: Every Option Compared (Little Hero)](https://www.little-hero.app/guides/ai-childrens-books-compared-2026)
- [Childbook.ai](https://www.childbook.ai/)
- [Custom Heroes — Photo to Storybook](https://www.customheroes.ai/)
- [Make My Book — personalized children's book](https://makemybook.app/en)
- [KidTeller (Google Play)](https://play.google.com/store/apps/details?id=com.kidteller.app.android&hl=en)
- [How to Generate Consistent Characters with Nano Banana (glbgpt)](https://www.glbgpt.com/hub/how-to-generate-consistent-characters-in-different-scenes-with-nano-banana/)
- [How to Build a Consistent AI Character Across Images and Video 2026 (astorie.ai)](https://astorie.ai/blog/how-to-build-consistent-ai-character)
- [AI Character Consistency: 5 Methods Compared 2026 (Flick)](https://flick.art/blog/img2img-consistent-character)
- [Best Expo SaaS Boilerplates 2026 (BoilerplateHub)](https://boilerplatehub.com/categories/Expo)
- [Build a React Native Expo App with Supabase and RevenueCat (Buildcamp)](https://www.buildcamp.io/blogs/how-to-build-a-react-native-expo-app-with-supabase-and-revenuecat)
- [Submit to app stores — Expo Docs](https://docs.expo.dev/deploy/submit-to-app-stores/)
- [Submit to Google Play with EAS Submit — Expo Docs](https://docs.expo.dev/submit/android/)
- [App Store & Google Play Submission Guide 2026 (Primocys)](https://primocys.com/blog/submit-app-to-app-store-google-play/)
- [Obytes React Native Starter (GitHub topic)](https://github.com/topics/expo-boilerplate)
- [Ignite by Infinite Red](https://infinite.red/ignite)
- [InstantID project page](https://instantid.github.io/)
- [InstantX/FLUX.1-dev-IP-Adapter (Hugging Face)](https://huggingface.co/InstantX/FLUX.1-dev-IP-Adapter)
- [Consistent portraits with InstantID (myByways)](https://mybyways.com/blog/consistent-portraits-revisisted-instantid/)
