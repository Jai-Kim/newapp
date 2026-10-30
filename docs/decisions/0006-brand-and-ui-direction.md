# ADR-0006: Brand and UI direction, "warm gouache"

Status: accepted. Date: Oct 29, 2026. Decided by Jai.

## Context

Build 8 still ships the Obytes starter theme: Inter, white backgrounds, orange primary (#FF6C00), charcoal and neutral greys. It has no Dodam identity and clashes with the Boa illustrations, which are warm gouache (mustard raincoat, sage fence, terracotta, navy boots, cream walls). Bedtime reading on a bright white screen is also the wrong default.

## Decision

Build the UI from the illustration palette, with two deliberate modes.

**Night mode** (default for Tonight and the reader): night navy backgrounds, cream text, mustard as the only action color. Dim by design.

**Day mode** (parent review, paywall, library, settings): cream backgrounds, walnut text. Visually distinct so a grown-up always knows which side they are on.

### Tokens

| Token | Hex | Use |
|---|---|---|
| night | #1B2542 | night background |
| boot-navy | #2E3E6E | night cards, chips |
| cream | #F6EBD9 | day background, night text |
| linen | #EBDDC3 | day cards |
| raincoat (mustard) | #E3A829 | primary action, active nav, progress |
| mustard-ink | #7A5208 | accent text on cream (passes AA) |
| sage | #8DB07C | growth, success, sprout |
| sage-ink | #4F6B45 | success text on cream |
| clay | #D4704F | warm alerts |
| clay-ink | #8A3E26 | alert text on cream |
| walnut | #3A2A1E | body text on cream (never pure black) |

Rules: one mustard button per screen. Text on mustard is night navy, never white. Replace the orange `primary` ramp and the charcoal palette in `src/components/ui/colors.js` and `src/global.css`.

### Type

- Story text: Gowun Batang (Korean) and Fraunces (English), both serifs.
- Interface: Noto Sans KR.
- All three load through `@expo-google-fonts`, the same mechanism the app already uses for Inter.
- Bilingual rule from ADR-0001 stays: the child's primary language leads at full size, the other sits beneath at a smaller size, on every screen.

### Logo

Mark A: a mustard crescent moon cradling a sage sprout. The moon says bedtime, the sprout says 도담도담 (growing steadily). Lockup is 도담 in Gowun Batang bold over DODAM in Fraunces, letter-spaced. App icon is the mark on night navy, with the mark inside the centre 66% so circle masks do not crop it. Adaptive icon background becomes #1B2542, and the splash background too.

### Screen changes

1. **Tonight:** brand row (mark, 도담, child chip), greeting, hero card with the chapter illustration, "Chapter N of 10", one mustard "Read together / 함께 읽기" button, a 10-segment progress bar for the current book, bottom nav (Tonight, Books, Grown-ups).
2. **Reader:** full-bleed illustration with a rounded bottom, thin mustard progress bar on top, "Made with AI / AI가 만들었어요" chip over the art, serif text, tap anywhere to turn, large round next button.
3. **Parent review:** day mode, "Only you can see this" pill, chapter preview card, Approve (mustard), Ask for a change (outline), and a quiet "Report a problem with this chapter" link.
4. **Books:** book cover as the unit, 3 of 10 progress, chapter list, "Make it a real book" card.
5. **Paywall:** illustrated header, price stated plainly ($1.99 for 3 months, then $1.99 a month, cancel in Google Play), three benefit lines, one mustard button, Restore purchase.

## Consequences

- A theme migration touches every screen (about 18 use FocusAwareStatusBar), so do it as tokens first, then screens, in small PRs.
- Night mode becomes the default for Tonight and the reader regardless of system theme. Day mode follows for grown-up screens.
- Real chapter art replaces the placeholder scene used in mockups.
- The logo is a concept good enough for v1. A designer can refine the vector later without changing the system.
- Korean text needs native proofreading before launch (tracked in ROADMAP.md item 21).
