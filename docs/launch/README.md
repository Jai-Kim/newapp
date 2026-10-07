# Launch pack — Google Play

Everything needed to fill in Play Console, in one place. **All of it is an
engineering draft**: written from what the code actually does so a reviewer can
check each claim against the repo, and none of it is legally or marketing
cleared.

## What is here

| Document | Covers |
|---|---|
| [`store-listing.md`](store-listing.md) | App name, short and full description — **English and 한국어** |
| [`content-rating.md`](content-rating.md) | IARC questionnaire answers, with the reasoning for each |
| [`target-audience.md`](target-audience.md) | Target age groups and the Families Policy consequences |
| [`terms.md`](terms.md) | Terms of Service draft, bilingual |
| [`store-assets.md`](store-assets.md) | Icon, feature graphic and screenshot specs, plus a shot list |

## What is already elsewhere, and stays there

These predate this pack and are referenced by other docs (and in the privacy
policy's case, by the app itself), so moving them would break more than it
tidied:

| Document | Covers |
|---|---|
| [`../privacy-policy.md`](../privacy-policy.md) | Bilingual privacy notice — **already includes the third-party AI disclosure** (Anthropic for text, Google for images) and Korea PIPA cross-border transfer |
| [`../play-data-safety.md`](../play-data-safety.md) | Data safety form worksheet, including children's data |
| [`../privacy-store-disclosures.md`](../privacy-store-disclosures.md) | Short disclosure strings for the listing |
| [`../play-closed-testing.md`](../play-closed-testing.md) | The 12-tester / 14-day closed testing requirement |
| [`../play-tester-onboarding.md`](../play-tester-onboarding.md) | What testers are told |
| [`../sensitive-topics-policy.md`](../sensitive-topics-policy.md) | Crisis-input handling and the policy behind it |

## The one fact that shapes everything else

**Dodam is a Families app.** The stories are written for a child aged 3–8 and
read by that child, and the listing says so. That is not a question Play lets
you answer conveniently — see [`target-audience.md`](target-audience.md). It
determines the SDK rules, the data-safety answers and part of the listing.

Two things make that burden much lighter than it could have been, both of them
earlier product decisions rather than compliance work:

- **No ads anywhere**, which removes the hardest part of the Families Policy.
- **No photograph of a child is ever requested or stored.** The character comes
  from a picker of fixed options (ADR-0001), so there is no child image in the
  system at all — the difference between processing a child's biometric data
  and not.

## What the app actually collects

Stated once here because every form below depends on it:

- **Parent account** — email and password, via Supabase.
- **Child profile** — first name, age *band* (not a birth date), reading
  language, a few chosen interests, and appearance chosen from fixed options.
  No surname, no birth date, no location, no photo.
- **What the parent types** — tonight's lesson and an optional short note,
  which is sent to Anthropic and Google to generate the chapter.
- **Generated content** — chapter text and illustrations, in a private bucket.
- **Purchases** — handled by Google Play via RevenueCat; we never see card
  details.
- **Shipping address** — *only* if a hardcover is ordered: recipient name, full
  postal address, and an optional gift message. This is the most sensitive data
  the app holds and it is collected from the parent, not the child.

## Order of work

1. Replace the starter icon and produce the store graphics — [`store-assets.md`](store-assets.md)
2. Publish the privacy policy and terms to real URLs (Play needs links, not files)
3. Fill the questionnaires — content rating, target audience, data safety
4. Paste the listing copy for both languages
5. Closed testing: 12 testers, 14 days — [`../play-closed-testing.md`](../play-closed-testing.md)

Steps 2–4 can be done before the app is finished. Step 5 is the long pole and
starts a clock, so start it as early as a build is installable.

## Open items — `TODO(Jai)`

Collected from across the pack. These are the ones a reviewer should not let
through:

- [ ] **An in-app way to report offensive AI output.** Play asks for this for
      generative-AI apps. Rejecting a chapter currently stops a child seeing it
      but tells us nothing. Blocks an honest answer in `content-rating.md`.
- [ ] **Families Policy SDK determination** for RevenueCat and Supabase,
      written down before review rather than improvised during an appeal.
- [ ] **Legal review of both languages**, for the terms and the privacy policy.
      Neither has had a lawyer or a native Korean speaker on it.
- [ ] Entity name, address, contact email, governing law — the blanks in
      `terms.md`.
- [ ] **App category**: Education or Parenting. Parenting is the more honest
      fit — Dodam does not teach a curriculum, and claiming Education invites a
      standard it was not built to meet.
- [ ] Confirm every size and character limit in Console before producing final
      assets; Google moves them.
