#!/usr/bin/env python3
"""Spike A, step 2 — render the three scenes from the locked reference sheet.

Run step1_reference.py first; this conditions every scene on the PNG it
produces. Requires a billing-enabled Gemini key (see README.md).
"""
import pathlib

from spike_a import OUT, generate
from step1_reference import MIA, PIP, STYLE

REFERENCE = OUT / "00-reference-sheet.png"

# The identity-preservation block. Repeated verbatim in every scene — this is
# the lever the spike is actually testing, alongside the reference image.
IDENTITY = f"""The attached image is the DEFINITIVE character reference sheet.
Reproduce the SAME child and the SAME owl exactly as drawn there — same face
shape, same skin tone, same two hair puffs, same round yellow glasses, same red
rain boots, same teal owl with the orange scarf. Do not restyle, age, or
redesign them. Only the scene around them changes.

{MIA}

{PIP}

Art style, unchanged from the reference: {STYLE}"""

SCENES = {
    "01-swim-lesson": (
        "Scene: Mia's first swim lesson. She stands at the edge of a bright "
        "indoor pool in a swimsuit, holding a float, looking nervous but brave. "
        "Her red rain boots sit on the tiles beside her. Pip perches on a stack "
        "of towels nearby, watching encouragingly. Warm light, gentle water "
        "reflections."
    ),
    "02-night-forest": (
        "Scene: a nighttime forest. Mia walks a mossy path between tall trees in "
        "her red rain boots and a raincoat, holding a small glowing lantern. Pip "
        "flies just above her shoulder, scarf trailing. Deep blue-green night "
        "palette, soft lantern glow, fireflies, calm and safe rather than scary."
    ),
    "03-breakfast-table": (
        "Scene: a sunny kitchen at breakfast. Mia kneels up on a wooden chair at "
        "the table, spooning porridge, mid-laugh. Pip sits on the table edge "
        "beside a jug of milk, eyeing a blueberry. Morning light through a "
        "window, cosy domestic clutter."
    ),
}

if __name__ == "__main__":
    if not REFERENCE.exists():
        raise SystemExit(f"missing {REFERENCE} — run step1_reference.py first")
    print(f"Rendering {len(SCENES)} scenes from {REFERENCE.name}…")
    for slug, scene in SCENES.items():
        generate(slug, f"{IDENTITY}\n\n{scene}", references=[REFERENCE], aspect="4:3")
