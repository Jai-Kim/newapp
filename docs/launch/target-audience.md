# Target audience and content — draft answers

**Status: engineering draft for review — not legally cleared.**

This is the Play Console section that decides whether the **Families Policy**
applies. For Dodam it does, and that is the single most consequential fact in
this whole launch pack: it changes what SDKs are allowed, what the listing must
say, and what the data-safety form must claim.

---

## Target age groups

Dodam writes bedtime stories **for a specific child aged 3–8** — the age bands
are a hard constraint in the schema (`age_band in ('3-4','5-6','7-8')`) and
they drive the reading level of every chapter.

**Select: Ages 5 and under, 6–8.** Do not select adult-only bands.

### "But the parent is the user"

True, and it does not help. The parent creates the account, pays, and approves
every chapter — but the **app's content is made for a child and read by a
child**, and the store listing says so. Play looks at who the content appeals
to, not who holds the credit card. Claiming an adult-only audience for an app
whose listing promises "bedtime stories starring your child" is the kind of
mismatch that gets apps pulled after launch rather than rejected before it.

Answer: children are a target audience.

---

## Consequences of being a Families app

| Requirement | Where Dodam stands |
|---|---|
| Comply with the **Families Policy** | Must be reviewed in full before submission — `TODO(Jai)` |
| All SDKs must be Families-self-certified or allowed | **Open risk.** RevenueCat and Supabase need checking against Play's list. See below. |
| No ads, or only Families-certified ad SDKs | Dodam shows **no ads at all**, which removes the hardest part of this policy |
| No collection of persistent identifiers from children | Only the **parent's** account is identified; the child has no account, no login, no identifier |
| Data safety form must declare children's data | Already drafted — `docs/play-data-safety.md` |
| Privacy policy linked in listing **and** in the app | Exists and is bilingual — `docs/privacy-policy.md` |
| No child-directed in-app purchase pressure | The paywall is behind a parent-only flow; a child reading a chapter never sees it |

### The SDK question — `TODO(Jai)`

Play requires every SDK in a Families app to be appropriate for children. Two
need an explicit decision:

- **RevenueCat** — purchases. Wraps Google Play Billing, which is itself fine;
  confirm RevenueCat's own Families stance and what identifiers it collects.
- **Supabase** — auth, database, storage. Used for the *parent's* account.

Neither is used to profile a child. That is the argument, and it should be
written down before review rather than improvised during an appeal.

---

## What the child actually gives us

Worth stating precisely, because the data-safety answers depend on it and
because it is less than people assume:

| Collected | Not collected |
|---|---|
| First name only | Surname |
| Age **band**, not a birth date | Date of birth |
| Reading language (en/ko) | Location of any kind |
| A handful of chosen interests | Free-text about the child |
| Appearance chosen from **fixed options** — skin tone, hair, eyes, glasses | Any photo of the child, ever |

**No photograph of a child is ever uploaded or requested.** The character is
drawn from a picker of fixed options (ADR-0001), which was a deliberate product
decision and is now also a compliance asset — it is the difference between
"we process children's biometric data" and "we don't".

The illustrations are generated from that description, so no image of a real
child exists anywhere in the system.

---

## Appeals to a child / content appeal

Play asks whether the app's content is likely to appeal to children even if
not designed for them. **Yes** — and the honest answer is that it is *designed*
for them. Do not soften this.

---

## Open items — `TODO(Jai)`

- [ ] Read the Families Policy end to end and record the gaps
- [ ] Written SDK determination for RevenueCat and Supabase
- [ ] Decide whether to enrol in **Teacher Approved** — optional, and a
      meaningful endorsement for this category, but it adds review scope
- [ ] Confirm the Korean GRAC rating path for a children's app, since Korea is
      a primary market and the Korean listing is first-class, not a translation
