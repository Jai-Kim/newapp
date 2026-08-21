#!/usr/bin/env python3
"""Spike A follow-up — does the identity/wardrobe split actually work?

Spike A found the model OVER-preserves: given a whole-character reference and
asked for a swimsuit, it kept the dress and boots. ADR-0001 §5 asserts that
separating locked identity (face, hair, glasses, skin) from per-scene wardrobe
fixes this. That assertion is baked into the schema (children.character_ref,
chapters.pages[].wardrobe) but was never tested at the image layer.

This is the cheapest possible test: same reference sheet, same scene, but the
prompt now states explicitly which parts of the reference are identity and which
are wardrobe to be replaced. If prompting alone is enough, no new identity-only
reference asset is needed.
"""
from spike_a import OUT, generate
from step1_reference import MIA, PIP, STYLE

REFERENCE = OUT / "00-reference-sheet.png"

# The split. Identity is quoted from the reference; wardrobe is explicitly
# disowned from it — that disowning is the whole experiment.
IDENTITY_ONLY = f"""The attached image is the LOCKED IDENTITY reference.

PRESERVE EXACTLY (this is her identity, it never changes):
  - face shape, features and warm brown skin tone
  - dark tightly-curled hair in two round puffs, one each side
  - round yellow-rimmed glasses
  - wide friendly dark-brown eyes, round cheeks
  - Pip: the small round teal owl with the knitted orange scarf

DO NOT COPY (this is wardrobe, not identity — it MUST change per scene):
  - the cream polka-dot dress
  - the striped tights
  - the red rain boots
Ignore the clothing in the reference entirely. Dress her in the WARDROBE below
instead. Reproducing the reference outfit is a failure.

{MIA}

{PIP}

Art style, unchanged from the reference: {STYLE}"""

SCENE = (
    "Scene: Mia's first swim lesson, at the edge of a bright indoor pool. She "
    "stands on the wet tiles holding a foam float, nervous but brave. Pip "
    "perches on a stack of folded towels nearby, watching encouragingly."
)

WARDROBE = (
    "WARDROBE for this page: a turquoise one-piece swimsuit with a small ruffle. "
    "Bare feet, bare arms and legs. A rolled towel over one shoulder. She is NOT "
    "wearing the dress, NOT wearing tights, and NOT wearing boots — her red rain "
    "boots sit empty on the tiles behind her."
)

if __name__ == "__main__":
    if not REFERENCE.exists():
        raise SystemExit(f"missing {REFERENCE} — run step1_reference.py first")
    print("Testing identity/wardrobe split (ADR-0001 §5)…")
    generate(
        "04-wardrobe-swimsuit",
        f"{IDENTITY_ONLY}\n\n{SCENE}\n\n{WARDROBE}",
        references=[REFERENCE],
        aspect="4:3",
    )
