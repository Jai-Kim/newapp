# App-store privacy / AI-content disclosures

Short reference so Jai can fill in Google Play's Data Safety form and
Apple's App Privacy "nutrition label" from one place, rather than re-deriving
it from the app. Source of truth for the underlying facts is
`docs/privacy-policy.md`. **This file does not submit anything — filing the
actual store forms is a manual, human step.**

## What this app actually does (facts to carry into both forms)

- Collects: account email, child first name, age band, language preference,
  interests, free-text chapter "situation" prompts, generated chapter
  text/images, chapter approval/read status, and — only for print orders —
  a real name and shipping address.
- Shares free-text prompts with two third-party AI processors:
  **Anthropic** (text generation) and **Google** (image generation). Per
  `docs/privacy-policy.md`, our working assumption (not yet confirmed
  against an executed agreement) is that neither uses submitted content to
  train their own models.
- Generates chapter text and illustrations entirely by AI. Nothing a child
  sees is human-authored.
- Targets children as end readers, but the account holder and every
  generation decision (writing the prompt, approving/rejecting a chapter)
  is an adult parent — this is the "verifiable parental consent" angle
  both stores and PIPA care about.

## Google Play — Data Safety section

- **Data collected**: personal info (name — for print orders only), email
  address, other user-generated content (the chapter prompts), photos (the
  generated illustrations, since Play's form doesn't distinguish
  AI-generated from user-uploaded).
- **Data shared with third parties**: yes — chapter prompts go to Anthropic
  and Google's own model APIs for processing. Play's form asks whether
  sharing is for "app functionality" — that's the applicable purpose here,
  not advertising or analytics.
- **Generative-AI content declaration**: Play has an AI-generated content
  policy surface for apps whose core function is generating synthetic
  content. **TODO(Jai)**: check Play Console's current AI-content
  questionnaire (its wording changes over time) and confirm whether this
  app needs an in-app AI-content label beyond what's now implemented
  (`src/features/legal/ai-generated-notice.tsx`) — this codebase has no
  outbound web access, so the current policy text could not be fetched or
  quoted here.
- **Children's data**: this app is aimed at children as readers, with a
  parent as the account holder. **TODO(Jai)**: decide how the app answers
  Play's "is this app directed at children" / Families Policy questions,
  since that changes which Data Safety disclosures are mandatory.

## Apple App Privacy ("nutrition label")

- Likely categories: **Contact Info** (email; name + address for print
  orders), **User Content** (chapter prompts, generated
  text/illustrations).
- "Data Used to Track You": none identified — no advertising or
  cross-app tracking exists in this codebase.
- **TODO(Jai)**: Apple's Kids Category / Family app requirements have their
  own parental-consent and no-third-party-analytics rules — confirm whether
  this app should be listed under the Kids Category at all, since that
  changes both the review process and what's allowed to third-party SDKs.

## Korea-specific

- PIPA's cross-border transfer notice (recipient, country, items, purpose,
  retention) must be given as its own, separate consent item — implemented
  as its own section in `docs/privacy-policy.md` and surfaced as its own
  bullet in the in-app consent step (`src/features/onboarding/
  child-setup-screen.tsx`).
- **TODO(Jai)**: PIPA requires a designated 개인정보보호책임자 (person in
  charge of personal data) with published contact details, and — for
  handling a child's personal data — may require a specific verifiable
  guardian-consent method beyond a checkbox at signup. Neither is decided
  here; this PR implements the technical consent-recording plumbing so
  whatever method is chosen has somewhere to write its proof-of-consent.
- **TODO(Jai)**: whether the Korean copy in `docs/privacy-policy.md` needs a
  native-speaker legal review before launch — it was written in a formal,
  parent-facing register but has not been checked by counsel or a native
  legal reviewer.
