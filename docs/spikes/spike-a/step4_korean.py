#!/usr/bin/env python3
"""Spike A follow-up — can we render a KOREAN child consistently?

Spike A's test child was fictional and not Korean. The intended first real user
(ADR-0001) is a Korean-American girl, so the consistency result does not
transfer for free: image models are known to render East Asian faces less
reliably than the prompt asks, and the failure modes are specific —

  - drift toward a generic pan-"Asian" face rather than the described child
  - drift toward anime/manga styling, which would break the gouache house style
  - skin tone and eye shape wandering between scenes
  - fine identity details (a mole, a specific fringe) dropped

So this reruns the exact same experiment — one locked reference sheet, three
scenes, one wardrobe change — with a Korean child, and is directly comparable to
the Mia run beside it.

Deliberate identity anchors, chosen to be checkable at a glance:
  - a small mole under the LEFT eye (fine detail — first thing to be dropped)
  - blunt fringe + twin low pigtails with red ribbon ties (silhouette)
  - a specific companion: a magpie, which in Korean folklore brings good news

Run:  SPIKE_A_MODEL=gemini-2.5-flash-image python3 step4_korean.py
"""
import os
import pathlib

import spike_a
from step1_reference import STYLE

# Keep outputs beside the Mia run rather than inside it, so the two are
# comparable but never overwrite each other.
spike_a.OUT = spike_a.REPO / "docs/spikes/spike-a/korean"
spike_a.LOG = spike_a.OUT / "metrics.jsonl"

from spike_a import generate  # noqa: E402  (must follow the OUT override)

YUNA = (
    "Yuna is a 5-year-old Korean girl with straight black hair cut in a blunt "
    "fringe above her eyebrows and worn in two low pigtails tied with red "
    "ribbons. Warm light-golden skin, a round soft face, dark brown almond-"
    "shaped eyes with a gentle monolid, a small nose, and a tiny dark mole just "
    "below her LEFT eye. She looks like a real Korean child, not a generic "
    "cartoon: keep her features specific and true to a Korean five-year-old."
)

KKACHI = (
    "Kkachi is a small round magpie the size of a teapot — glossy black head and "
    "back, a crisp white belly, blue-sheen tail feathers, bright dark eyes, and "
    "a soft mustard-yellow knitted scarf. In Korea a magpie is the bird that "
    "brings good news."
)

REFERENCE_PROMPT = f"""Draw a CHARACTER MODEL SHEET for a children's book, on a
plain neutral cream background with no scenery.

Layout: three views of the SAME girl across the sheet —
  (1) full-body front view, standing, neutral expression, arms at her sides
  (2) full-body three-quarter view, turned slightly to her left
  (3) head-and-shoulders close-up, smiling warmly
Then, at the lower right, one full-body view of her magpie companion.

{YUNA}

{KKACHI}

Keep every view unmistakably the same child: identical face shape, identical
blunt fringe and two low pigtails with red ribbons, identical skin tone, and the
small mole below her left eye visible in every view including the close-up.
This sheet is the definitive reference for the character.

Do NOT render her in an anime or manga style. Art style: {STYLE}"""

IDENTITY = f"""The attached image is the LOCKED IDENTITY reference.

PRESERVE EXACTLY (her identity — never changes):
  - face shape, warm light-golden skin tone, dark brown almond eyes
  - straight black hair, blunt fringe, two low pigtails with red ribbons
  - the small dark mole just below her LEFT eye
  - Kkachi: the round black-and-white magpie with the mustard-yellow scarf

DO NOT COPY the clothing in the reference — that is wardrobe and changes per
scene. Dress her in the WARDROBE given below.

Do NOT restyle her toward anime, manga, or a generic cartoon face. She is a
specific Korean child and must stay recognisably herself.

NO LETTERING. Do not draw any words, titles, captions or signage anywhere in the
image. Illustration only.

{YUNA}

{KKACHI}

Art style, unchanged from the reference: {STYLE}"""

SCENES = {
    "01-swim-lesson": (
        "Scene: Yuna's first swim lesson at the edge of a bright indoor pool, "
        "holding a foam float, nervous but brave. Kkachi perches on a stack of "
        "folded towels nearby.",
        "WARDROBE: a navy one-piece swimsuit with a small white trim. Bare arms, "
        "legs and feet. She is NOT wearing the reference outfit.",
    ),
    "02-night-forest": (
        "Scene: a nighttime forest. Yuna walks a mossy path between tall trees "
        "holding a small glowing lantern. Kkachi flies just above her shoulder. "
        "Deep blue-green night palette, fireflies, calm rather than scary.",
        "WARDROBE: a mustard raincoat over pyjamas, and green rubber boots.",
    ),
    "03-breakfast-table": (
        "Scene: a sunny kitchen at breakfast. Yuna kneels up on a wooden chair "
        "at the table, mid-laugh, a spoon in her hand. Kkachi sits on the table "
        "edge eyeing a piece of fruit. Morning light through a window.",
        "WARDROBE: a soft pink cardigan over a white cotton dress, house socks.",
    ),
}

if __name__ == "__main__":
    if os.environ.get("SPIKE_A_MODEL", "gemini-2.5-flash-image") != "gemini-2.5-flash-image":
        print(f"note: running on {spike_a.MODEL}")
    print("Locking Korean character reference…")
    ref = generate("00-reference-sheet", REFERENCE_PROMPT, aspect="4:3", size="2K")
    if not ref:
        raise SystemExit("reference failed")

    print(f"\nRendering {len(SCENES)} scenes…")
    for slug, (scene, wardrobe) in SCENES.items():
        generate(slug, f"{IDENTITY}\n\n{scene}\n\n{wardrobe}",
                 references=[ref], aspect="4:3")
