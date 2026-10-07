# Store assets — what you have to supply

**Status: engineering draft.** Sizes are from Play Console's current
requirements; **`TODO(Jai)`: confirm in Console before producing final art** —
Google adjusts these, and a rejected upload at submission time is an avoidable
delay.

Nothing in this list exists yet as *store* art. The app's own icons exist
(`assets/icon.png`, `assets/adaptive-icon.png`, both 1024×1024) but they are
still the Obytes starter's, not Dodam's.

---

## Required before you can submit

| Asset | Spec | Count | Status |
|---|---|---|---|
| **App icon** | 512 × 512 PNG, 32-bit, **no transparency**, under 1 MB | 1 | ❌ starter art |
| **Feature graphic** | 1024 × 500 PNG or JPG, no transparency | 1 | ❌ none |
| **Phone screenshots** | 16:9 or 9:16, each side 320–3840 px | **min 2**, max 8 | ❌ none |
| **Short description** | ≤ 80 characters | per language | ✅ drafted |
| **Full description** | ≤ 4000 characters | per language | ✅ drafted |

Both languages need their own listing text; **screenshots and the feature
graphic can be localised too, and for Dodam they should be** — a Korean-first
family should see Korean on the page in the screenshot.

### Strongly recommended

| Asset | Spec | Why for Dodam |
|---|---|---|
| **Tablet screenshots** | 7" and 10", min 2 each | Bedtime reading on a tablet is a likely use; without these Play may show phone shots letterboxed |
| **Promo video** | YouTube URL | Optional. The product is hard to convey in stills — a 20-second "pick tonight's lesson → it's ready tomorrow" would carry it |

### Not applicable

- **TV / Wear / Auto assets** — not those form factors.
- **Ad-related declarations** — the app shows no ads.

---

## The icon, specifically

Two different icons, and they are not interchangeable:

- **Store icon** — 512×512, flat, no transparency. Uploaded in Console.
- **In-app launcher icon** — `assets/icon.png` plus `assets/adaptive-icon.png`
  for Android's adaptive shape. The adaptive foreground must survive being
  masked to a circle, squircle or rounded square: **keep the meaningful part
  inside the centre ~66%**, or Android will crop it.

The current adaptive background is `#2E3C4B` (`app.config.ts`), a starter
colour that has nothing to do with Dodam's palette. The house illustration
style is warm gouache — cream, terracotta, sage, dusty teal — so the icon
should come from that family, and the background colour should move with it.

**`TODO(Jai)`:** commission or generate the icon, then replace `assets/icon.png`,
`assets/adaptive-icon.png`, `assets/splash-icon.png` and `assets/favicon.png`,
and update `adaptiveIcon.backgroundColor` and the splash `backgroundColor`.
That is a code change, not a docs one — out of scope for this PR.

---

## A screenshot shot list

Screenshots are where this product is won or lost: the differentiator is
*continuity*, which a single screen cannot show. Shoot them as a sequence that
tells the story.

1. **Tonight's chapter is ready** — the home screen in its good state. One tap
   to read. This is the promise.
2. **A page of the story** — Korean and English together on the same page, with
   an illustration. Shows bilingual and shows the art in one frame.
3. **The parent gate** — the review screen before approval. "Nothing reaches
   your child until you've read it." This is the trust shot and the one most
   likely to win a cautious parent.
4. **Choosing tomorrow** — the lesson picker at the end of a read. Shows that
   it continues, not that it's a pile of one-offs.
5. **The character picker** — structured options, no photo of a child. Worth
   showing because "we never ask for a photo" is a real differentiator.
6. **A completed Volume** — the library with a finished book. Books, not a feed
   (ADR-0003).

Use **Boa's generated Volume** (`docs/samples/boa-volume-1/`) as the source
material — it is real output from the real pipeline, so the screenshots will
show what the app actually produces rather than mocked-up copy.

### Rules worth not breaking

- No device frames with a competitor's branding, no fake status bars claiming
  full signal and 100% battery if that is obviously staged.
- Do not show a real child's name or photo. Boa is a generated character; keep
  it that way.
- If a screenshot shows a price, it must match the listing. Simpler not to.
- Text overlaid on screenshots must be localised too — an English caption on
  the Korean listing is a common and avoidable rejection.

---

## Where each piece goes in Console

| Console location | Source |
|---|---|
| Main store listing → Short/Full description | `docs/launch/store-listing.md` |
| Main store listing → Graphics | the assets above |
| Store settings → App category | "Education" or "Parenting" — `TODO(Jai)`, see README |
| Policy → App content → Privacy policy URL | `docs/privacy-policy.md`, published to a URL |
| Policy → App content → Content rating | `docs/launch/content-rating.md` |
| Policy → App content → Target audience | `docs/launch/target-audience.md` |
| Policy → App content → Data safety | `docs/play-data-safety.md` |
