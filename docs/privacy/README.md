# Privacy & AI-disclosure notice — source of record

`privacy-en.md` and `privacy-ko.md` are the single source of truth for the
parent-facing privacy/AI-disclosure text. The in-app `/privacy` screen
(`src/features/legal/privacy-content.ts`) renders a structured copy of the
same sections — there is no build step that generates one from the other, so
**a change to either markdown file must be mirrored by hand into
`privacy-content.ts`**, and vice versa.

This is an **engineering draft written for Jai and any counsel to review — it
is explicitly not legally cleared.** Nothing in it should be read as an
assertion of compliance; it describes what the app actually does today.

## What each section is meant to answer

| Section | Answers |
|---|---|
| "Your stories are written and illustrated by AI" | Plain-language third-party-AI disclosure — the point of issue #12. Names Anthropic and Google directly rather than "our partners", per Korea PIPA's requirement that a privacy notice name the actual recipient of a data transfer, and per general app-store AI-disclosure expectations for generative content. |
| "Every chapter is checked before your child sees it" | Describes the existing parent-preview + safety-filter gate (`supabase/migrations/0002_safety.sql`, `0003_app_access.sql`) in parent-facing language — not a new mechanism, just disclosure of one that already exists. |
| "What we store, and where" | PIPA's cross-border-transfer disclosure (Art. 28-8): what data leaves Korea, to which recipient, for what purpose. **`TODO(Jai)`: confirm the Supabase project's hosting region** so the destination country can be named explicitly rather than left generic. |
| "How long we keep it" | Retention-period disclosure, a standard PIPA/GDPR/CCPA requirement. **`TODO(Jai)`: no retention period has been decided anywhere in this codebase** — this section cannot be considered complete until one exists. |
| "Deleting a child profile" | COPPA/PIPA/GDPR-style deletion-request right. **`TODO(Jai)`: no deletion process/contact address exists yet** — the copy names the gap rather than inventing a process. |
| "Who to contact" | PIPA requires a named 개인정보보호책임자 (data protection officer) with contact details, plus the legal entity's name and address. **`TODO(Jai)`: none of these exist yet in any doc in this repo.** |

## Open items for Jai (not decided here)

1. **Legal entity name and address** — every `TODO(Jai)` placeholder in the two policy files needs this before launch.
2. **Retention periods** — chapters, images, consent records, and (once #28 merges) print-order shipping data.
3. **PIPA data protection officer** (개인정보보호책임자) — name and contact method. PIPA requires this explicitly for a service handling a child's personal data; there is currently no such role anywhere in this project.
4. **Domestic representative** — Korea PIPA's foreign-business rules may require a Korea-based representative if this service processes personal data of Korean residents at scale from outside Korea. Flagging as a question, not asserting either way — this is a legal determination, not an engineering one.
5. **Verifiable parental consent method.** This slice implements consent as an explicit, un-skippable checkbox tied to a signed-in, ideally email-verified account (the same account-creation flow already in place) — not a stronger method like a card-verification or ID check. Whether PIPA/COPPA's "verifiable parental consent" bar requires more than this for a service handling a child's data is a legal call, surfaced here rather than assumed.
6. **Whether the Korean text needs a lawyer's review before launch.** The Korean copy in `privacy-ko.md` was written in a formal, parent-facing register (not a machine translation of the English), but it has not been reviewed by a native legal reader. Treat it as a solid draft, not a cleared translation.
7. **App-store AI-content / kids-data declarations.** Google Play's Data Safety form and Apple's App Privacy "nutrition label" both have their own AI-disclosure and children's-data questions that need to be filed directly in each store's console — this repo cannot do that for you. This sandbox has no outbound web access, so I could not check either store's *current* policy wording to quote it precisely; flagging the gap rather than guessing at requirements that may have changed.
8. **Third-party sub-processor retention terms.** The notice states, as a general description, that Anthropic and Google do not train on data sent through commercial API agreements — this has not been checked against the actual executed DPA/ToS Jai has with each provider, and should be before this notice is called final.
