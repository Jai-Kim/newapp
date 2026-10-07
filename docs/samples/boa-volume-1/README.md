# Boa — Volume 1

A full ten-chapter Volume, generated through the real pipeline against the live
project: `generate-chapter` for each night, `lock-character` for the sheet,
`illustrate-chapter` for chapter one. Nothing here is hand-written or edited.

Reproduce with `npx tsx docs/samples/generate-volume.ts`.

**Boa** — Korean-American, 5–6, `primary_language: ko`, interests: the sea,
rain, birds, baking, drawing. Korean leads on every page because that is her
primary language (ADR-0001 §3); English sits beneath it.

## What this was for

Unit tests can tell you a chapter is bilingual and page-aligned. They cannot
tell you whether ten nights read as **one book**. That is the product's whole
claim, and it only shows up across a Volume.

## The run

| | |
|---|---|
| Chapters | 10, all `safety=safe` |
| Pages | 73 (7–8 per chapter) |
| Generation | 15.5 min total, 78–114s per chapter |
| Illustrated | chapter 1 only, pages 1/3/5/8 — the beats the storyteller marked |
| Order | strictly sequential; each chapter retrieves the Story Bible as it stands |

## Continuity — the part that matters

The arc was not scripted. The ten lessons were fixed in advance; everything
else — the island, the gull, the bicycle, the four friends — the storyteller
invented and then kept.

```
ch1  Boa is the frightened new child. Miru the gull taps the window.
     Shell cookies baked with Mom.
ch2  Miru's thread resolves. Cookies shared with the class. Haru arrives,
     and Haetseom — the island his grandmother lives on.
ch3  The cookies travel to Haetseom. Their shared drawing is given away
     and hung in Grandmother's window.
ch4  A sea-blue bicycle. Padogil, the road along the water.
ch5  Boa rides the whole length of Padogil to the dock. Jo Ajusshi ferries.
ch6  They sail to Haetseom and find their drawing glowing in the window.
     A gull-shaped cookie cutter comes home.
ch7  The cutter is used. Grandmother writes.
ch8  Grandmother crosses on Saturday's boat, walks up Padogil. Nari arrives.
ch9  Nari's first day — and Boa is the one doing the welcoming.
ch10 Nari misses the light of Grandmother's window across the water, so the
     four of them build one: a hundred-square paper window, over four days.
```

Two things stand out.

**The opening is answered by the ending.** Chapter 1 is Boa too frightened to
let go of her mother's hand on her first day. Chapter 9 is Boa welcoming
someone else's first day. Nothing asked for that symmetry.

**A motif runs the whole way through.** A window: rain on the kindergarten
glass (ch1), their drawing in Grandmother's window (ch3), it glowing in the
sun (ch6), and finally a window they build themselves so its light crosses
the water (ch10). Chapter 10's lesson is "finishing something you started",
and it lands on fifty-one paper squares that looked like nothing.

## Chapter 1's illustrations

`art/` holds the four pages the storyteller marked as beats (1, 3, 5, 8),
downloaded from the private bucket so they are reviewable here.

Page 1 is the one to check against `volume.json`'s identity descriptor: black
hair with a blunt fringe in low pigtails, light golden skin, almond monolid
eyes — and the scene matches the page text rather than approximating it
(yellow raincoat, navy boots, the drawing pad in her bag, Mom's hand, the
rainy gate). No lettering anywhere.

**The mole under her left eye did not survive**, which is the same fine-detail
drop Spike A predicted and the reason the look picker offers a distinguishing
detail at all. Everything else on the sheet held.

## The one real defect

**The island's Korean name drifts.** 해뜨섬 in chapters 3, 5, 8 and 9;
**해뜰섬** in 7 and 10.

The cause is visible in `volume.json`: the Story Bible stores the world entry
as `"Haetseom"` — romanised English, no Korean. So the canon that each night
retrieves carries the English name only, and the Korean spelling is re-derived
from scratch every time. It is stable for names that are plain
transliterations (미루, 솔이, 하루, 나리, 파도소, 파도길 are all consistent
across ten chapters) and unstable for this one, because 해뜨섬 is a meaningful
compound — "the island where the sun rises" — and there is more than one
reasonable way to write it.

A child will not notice. A Korean-speaking parent reading aloud will, and it
is exactly the kind of thing that makes a book feel machine-made.

**Fix:** carry Korean names in the Story Bible. `characters` and `world` need
a `name_ko` alongside `name`, written on first appearance and pasted back into
the canon block verbatim — the same discipline the identity descriptor already
uses for the character sheet (ADR-0001 §5). Worth its own issue.

## Also worth noting

- Every interest shows up as material rather than decoration: the sea is the
  setting, rain opens the book, a gull is a character, baking carries the plot
  across three chapters, and the drawing pad becomes the gift that ties the
  island to the mainland.
- Korean reads natively — 톡톡, 꼬옥, 폴폴, 폭 파묻힌 — child-register
  onomatopoeia and phrasing, not translated English.
- Chapter length crept up slightly over the Volume (78s → 90s+) as the canon
  grew. Worth watching: retrieval is currently recent-5 plus open threads, and
  at chapter 40 that prompt will be much larger.
