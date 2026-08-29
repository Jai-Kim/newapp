# Privacy & consent — source of record

This folder is the source of record for the privacy/data-collection notice
shown in-app at `/privacy` (`src/features/legal/privacy-content.ts`) and
referenced by the first-run consent step in child setup
(`src/features/onboarding/child-setup-screen.tsx`).

- [`privacy-en.md`](./privacy-en.md) — English
- [`privacy-ko.md`](./privacy-ko.md) — Korean

The in-app copy in `privacy-content.ts` is a hand-kept mirror of these two
files, not generated from them — there is no build step wiring markdown into
the app. If you edit one, edit the other, and check `privacy-content.ts`
still matches. (Worth automating later if this drifts; not built here to keep
this slice's diff narrow.)

## Status: engineering draft, not legally cleared

This is a solid, honest first draft written to explain the product's actual
data flows plainly. It has **not** been reviewed by counsel and should not be
treated as compliant until it has. See `docs/RISKS.md` — "Third-party AI
disclosure + Korea PIPA + AI-content labeling" is tracked there as P0.

## Open questions for Jai (not guessed here)

1. **Legal entity name and address.** Both files use a
   `[LEGAL ENTITY NAME — TBD]` / `[BUSINESS ADDRESS — TBD]` placeholder.
2. **Data retention periods** — for chapters, generated images, print-order
   shipping addresses (`print_orders`, once #28 lands), and consent records
   themselves. Nothing here states a period; the docs currently say retention
   is "for as long as the account is active, plus a window we have not yet
   fixed."
3. **PIPA data protection officer (개인정보보호책임자).** Korea's PIPA requires
   naming a specific person/contact for this role, not just a support email.
   Placeholder: `[DPO NAME / CONTACT — TBD]`.
4. **Whether the Korean text needs a lawyer's review before launch.** Almost
   certainly yes for anything PIPA-specific (Arts. 15–22, and the
   cross-border-transfer notice in particular, Art. 28-8) — flagging rather
   than asserting it's fine. The Korean below is written in a formal,
   plain-language parent-facing register (해요체/합니다체 mix matching a
   notice, not a contract), not verified by a native legal reviewer.
5. **Store-listing declarations.** Both stores increasingly ask about
   AI-generated content and children's-data handling in their listing forms
   (Google Play's Data Safety section; Apple's App Privacy "nutrition label"
   and Kids Category requirements). I could not reach either store's current
   policy pages from this sandbox (no outbound web access) to quote exact
   current requirements, so I have not tried to fill those forms in or assert
   precise current rules — that's a step for Jai to do directly against each
   console when the listing is filed, informed by what this document already
   discloses (identity of the AI providers, what data reaches them, that
   content is parent-reviewed before a child sees it).
6. **Third-party sub-processor retention.** The notice states, in general
   terms, that prompts and generated output are sent to Anthropic and Google
   for generation, and that under standard commercial API terms (as opposed
   to consumer-app terms) inputs/outputs are not used to train their models.
   That's accurate for how those APIs are typically offered, but it has not
   been confirmed against this project's actual executed agreements/DPAs
   with either vendor — flagging rather than asserting a specific contract
   term I haven't seen.

None of the above blocks this PR from shipping the *mechanism* (screen,
consent capture, labeling) — only the exact legal text depends on them.
