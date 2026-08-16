# Spike A — Korean child consistency

Status: **PASS.** A Korean child renders as consistently as the original test
character, in the same house style, with fine identity detail retained across all
three scenes and a full wardrobe change.

**Grid:** [`grid.png`](grid.png) · $0.0392/image, 7.8s/image — identical to the
Mia run, so there is no cost or latency penalty for the intended user.

## Why this needed its own test

Spike A's test child was fictional and not Korean. ADR-0001 says the intended
first real user is a Korean-American girl, so **the original result does not
transfer for free.** Image models are measurably weaker on East Asian faces than
prompts imply, and the failure modes are specific and damaging for this product:

- drift toward a generic pan-"Asian" face rather than *this* child
- drift toward anime/manga styling, which would break the gouache house style
- skin tone and eye shape wandering between scenes
- fine identity details silently dropped

Running the same experiment with a Korean character is the only way to know.

## Result

Character: **Yuna**, 5, straight black hair with a blunt fringe and two low
pigtails tied with red ribbons, warm light-golden skin, and — deliberately — **a
tiny mole below her left eye**. Companion: **Kkachi**, a magpie, the bird that
brings good news in Korean folklore.

| Check | Result |
|---|---|
| Face consistent across 3 scenes | ✅ |
| **Mole under the left eye retained** | ✅ in every scene |
| Blunt fringe + red-ribbon pigtails | ✅ |
| Skin tone stable | ✅ |
| Stayed in gouache house style | ✅ no anime drift |
| Wardrobe changed per scene | ✅ swimsuit / raincoat / cardigan |
| Kkachi consistent | ✅ reads as a magpie, not a generic bird |

**The mole is the headline.** It is the smallest identity anchor in the brief and
the first thing a model drops when it is approximating rather than reproducing —
and it survived a swimsuit, a night forest and a breakfast table. That is strong
evidence the model is holding *this specific child* rather than regenerating a
plausible Korean girl each time.

No anime drift, which was the risk I most expected. The explicit
"Do NOT render her in an anime or manga style" line is in both the reference and
the per-scene prompt; I would not remove it to find out whether it was load-bearing.

## One real defect: baked-in title text

The model rendered **"YUNA'S FIRST SWIM"** into the swim-lesson artwork, and
"YUNA & KKACHI" onto the reference sheet. The reference sheet is fine — it is a
model sheet and a caption is appropriate. **On a story page it is a bug:** the
page already has text, in two languages, and burned-in English typography would
sit wrong on a Korean spread and cannot be localised or edited.

The Mia scenes did not do this, so it is prompt-sensitive rather than universal —
the likely trigger is that the reference sheet carried a title, and the model
treated titling as part of the style to preserve.

**Fix before the reader ships:** add an explicit no-text instruction to the scene
prompt in `_shared/illustrate.ts` (`no lettering, no titles, no words anywhere in
the image`), and consider generating reference sheets without a caption so there
is nothing to imitate. Not yet done — it wants a re-run of both character sets to
confirm, and I would rather land it as one verified change than a blind edit.

## Cultural note

The scenes are deliberately culture-neutral (pool, forest, kitchen) per
ADR-0001 §2, which defers Korean settings and foods to a later option. This test
establishes only that the *child* can be Korean and stay consistent — it does not
test Korean settings, hanbok, or a Korean home, all of which would be new
territory for the style and worth their own pass if v2 goes there.

Kkachi is the one cultural choice made here, and it is a small one: a magpie
instead of an owl, because in Korea it is the bird that brings good news. It
rendered convincingly, which is mild evidence the model handles culturally
specific animals well.

## Reproducing

```bash
python3 step4_korean.py          # reference + 3 scenes
python3 build_grid.py korean     # grid.png + costs.md
```
