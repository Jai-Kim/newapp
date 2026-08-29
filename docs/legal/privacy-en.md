# Privacy & AI-use notice (English)

**Status: engineering draft, not legally cleared.** See [`README.md`](./README.md)
for open questions before this ships. Version `1` of this notice — dated
2026-08-29.

This notice is written for a tired parent reading it on a phone at bedtime,
not as a policy blob. If a sentence here isn't clear, that's a bug — tell us.

## Who we are

Storyloom is operated by **[LEGAL ENTITY NAME — TBD]**, **[BUSINESS ADDRESS —
TBD]**. If you have questions about this notice or your family's data,
contact **[DPO NAME / CONTACT — TBD]**.

## What we collect

- **From the parent:** your email address (to sign in), and whatever you type
  when setting up a chapter — a lesson or a real situation your family is
  going through (a fear, a sibling fight, a grief, a divorce). That's the
  point of the app, so we want to be direct: **what you type goes into the
  story your child reads, and it is sent to the AI providers below to write
  and illustrate that story.**
- **About your child, from you:** first name, an age band (3–4, 5–6, 7–8),
  which language leads their stories, and a few interests. We do not ask for
  a birthdate, an email address, or a photo of your child's real face.
- **Generated for your child:** the chapter text and illustrations
  themselves, and a locked character reference so illustrations look
  consistent night to night.
- **If you order a printed book:** a recipient name and a shipping address.
  We do not collect or store payment card details anywhere in the app — a
  completed order is fulfilled by hand for now, not through an automated
  payment/print pipeline.

## Third-party AI providers — named plainly

Two things happen every time a chapter is generated:

1. What you typed (the lesson/situation, and enough of your child's story
   history for continuity) is sent as a **prompt** to a third-party AI text
   model, currently **Anthropic (Claude)**, to write the chapter in both
   English and Korean.
2. Scene descriptions from that chapter are sent to a third-party AI image
   model, currently **Google (Gemini)**, along with your child's locked
   character reference, to illustrate it.

**What that means:** your family's words and your child's likeness (as a
generated illustration, not a photo) leave our servers and are processed by
these two companies' APIs in order to produce the story. Under the kind of
commercial API agreement this product uses, that input and output are not
used by Anthropic or Google to train their general models — but we have not
had that confirmed against a signed DPA with either vendor as of this
notice's version (see `README.md` item 6), so treat that as our
understanding, not a guarantee.

Every generated chapter is automatically screened by an independent safety
filter, in both English and Korean, before a parent ever sees it — and a
parent must explicitly approve a chapter before their child can read it.
Nothing reaches a child unreviewed.

## Where things are stored

Chapter text, illustrations, safety-filter results, and your family's
account data are stored in our database and file storage (Supabase,
currently hosted outside Korea). Provider API keys never leave our servers —
your device never talks to Anthropic or Google directly.

## Cross-border transfer

Because the AI providers above are US-based, **your prompts and your
child's generated content leave Korea and are processed in the United
States** as part of every chapter's generation. Korean law (PIPA Art. 28-8)
requires us to disclose this plainly, which is what this section is for.

## Children's personal data — how we handle consent

Under Korea's Personal Information Protection Act (PIPA), collecting a
child's personal information requires **separate, explicit consent from a
parent or legal guardian**, given by a verifiable adult — not just a general
agreement to terms of service.

In this app, that consent is captured when you (the signed-in, email-verified
parent account holder) set up your child's profile: you must actively check
a box stating you are the child's parent or legal guardian, that you have
read this notice, and that you consent to your child's first name, age band,
language preference, and the story data described above being collected and
processed as described. We record **when** that consent was given and
**which version of this notice** you agreed to. That record lives with your
child's profile in our database, not on your device.

You can withdraw consent at any time by deleting your child's profile
[mechanism TBD — not built yet as of this notice].

## What we do NOT do

- We do not sell your family's data.
- We do not show your child ads.
- We do not let AI providers see your payment information — we don't collect
  payment card details in the app at all, for anything, as of this notice.
- We do not use your family's data to train our own models.

## Your rights

You can ask us to show you what we hold about your family, correct it, or
delete it, by contacting **[DPO NAME / CONTACT — TBD]**. Retention periods
for each kind of data are **[TBD — see README.md item 2]**.

## AI-generated content, labeled

Every chapter's text and every illustration in this app is made by AI models
on our family's behalf, reviewed by a parent, then shown to a child. You'll
see a plain "Made with AI" label wherever a chapter is shown — in the parent
preview before you approve it, and in the reader your child uses.

## Changes to this notice

If this notice changes in a way that matters (a new AI provider, a new kind
of data we collect), we'll ask for consent again rather than silently
updating this page.
