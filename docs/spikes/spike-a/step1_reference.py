#!/usr/bin/env python3
"""Spike A, step 1 — lock the character reference sheet."""
from spike_a import generate

# ---------------------------------------------------------------------------
# These three strings are the whole experiment. They are pasted VERBATIM into
# every subsequent scene prompt — if the wording drifts, the character drifts.
# ---------------------------------------------------------------------------

STYLE = (
    "Children's picture-book illustration in soft gouache: warm limited palette "
    "of cream, terracotta, sage and dusty teal; visible paper grain; gentle "
    "rounded shapes; soft diffuse lighting; no hard black outlines; painterly "
    "brush texture. Cosy, reassuring, bedtime-story mood."
)

MIA = (
    "Mia is a 5-year-old girl with warm brown skin, dark tightly-curled hair worn "
    "in two round puffs (one on each side), round yellow-rimmed glasses, and red "
    "rain boots. Round cheeks, small nose, wide friendly dark-brown eyes."
)

PIP = (
    "Pip is a small round teal owl, about the size of a teapot, with a fluffy "
    "body, large amber eyes, a tiny hooked beak, and a knitted orange scarf "
    "around his neck."
)

PROMPT = f"""Draw a CHARACTER MODEL SHEET for a children's book, on a plain
neutral cream background with no scenery.

Layout: three views of the SAME girl across the sheet —
  (1) full-body front view, standing, neutral expression, arms at her sides
  (2) full-body three-quarter view, turned slightly to her left
  (3) head-and-shoulders close-up, smiling warmly
Then, at the lower right, one full-body view of her owl companion.

{MIA}

{PIP}

Keep every view unmistakably the same child: identical face shape, identical
glasses, identical two hair puffs, identical red boots, identical skin tone.
This sheet is the definitive reference for the character.

Art style: {STYLE}"""

if __name__ == "__main__":
    print("Generating character reference sheet…")
    generate("00-reference-sheet", PROMPT, aspect="4:3", size="2K")
