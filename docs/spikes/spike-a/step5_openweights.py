#!/usr/bin/env python3
"""Spike A path 2 — open weights via Replicate (ADR-0002).

Renders Mia across the SAME three scenes as the Nano Banana run so the two are
directly comparable on cost, latency and consistency.

Requires REPLICATE_API_TOKEN as a Supabase Edge Function secret:

    npx supabase secrets set REPLICATE_API_TOKEN=r8_...

Then:  python3 step5_openweights.py

--- A caveat to read before trusting the output -----------------------------
PuLID and InstantID are FACE-identity models trained on photographs of real
people. Our identity reference is an illustrated character sheet, not a photo.
They may transfer identity poorly from a drawing, or push the render toward
photorealism and away from the gouache house style.

That is exactly what this spike is for. If identity transfer is weak, the
fallback within path 2 is a fixed storybook style LoRA plus a strong textual
character description — cheaper still, but consistency would rest on the prompt
rather than on the reference image.
"""
import base64
import json
import pathlib
import time
import urllib.error
import urllib.request

import spike_a
from step1_reference import MIA, PIP, STYLE

OUT = spike_a.REPO / "docs/spikes/spike-a/open-weights"
LOG = OUT / "metrics.jsonl"
REFERENCE_PATH = "character-refs/mia/identity.png"

# Candidates in preference order. The first that runs wins; each is tried once
# so a retired or renamed model does not abort the spike.
CANDIDATES = [
    {
        "model": "zsxkib/flux-pulid",
        "reference_field": "main_face_image",
        "prompt_field": "prompt",
        "extra": {"num_outputs": 1, "output_format": "png", "guidance_scale": 4},
    },
    {
        "model": "zsxkib/instant-id",
        "reference_field": "image",
        "prompt_field": "prompt",
        "extra": {"num_outputs": 1},
    },
]

SCENES = {
    "01-swim-lesson": (
        "Mia at the edge of a bright indoor pool holding a foam float, nervous "
        "but brave, a teal owl in an orange scarf on folded towels beside her. "
        "She wears a turquoise swimsuit, barefoot."
    ),
    "02-night-forest": (
        "Mia walking a mossy path between tall trees at night holding a small "
        "glowing lantern, a teal owl in an orange scarf flying above her "
        "shoulder, fireflies, deep blue-green palette, calm not scary. She "
        "wears a cream raincoat and red rain boots."
    ),
    "03-breakfast-table": (
        "Mia kneeling up on a wooden chair at a sunny breakfast table, "
        "mid-laugh, a teal owl in an orange scarf on the table edge, morning "
        "light through a window. She wears a polka-dot dress."
    ),
}


def env(name):
    for line in (spike_a.REPO / ".env").read_text().splitlines():
        if line.startswith(name + "="):
            return line.split("=", 1)[1].strip()
    raise SystemExit(f"{name} not in .env")


BASE, ANON = env("EXPO_PUBLIC_SUPABASE_URL"), env("EXPO_PUBLIC_SUPABASE_ANON_KEY")


def call(payload, timeout=900):
    req = urllib.request.Request(
        f"{BASE}/functions/v1/spike-a2",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {ANON}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        try:
            return json.loads(raw)
        except Exception:
            return {"ok": False, "error": f"HTTP {e.code}: {raw[:600]}"}


def pick_model():
    """Find a candidate that actually runs, with a trivial prompt."""
    for cand in CANDIDATES:
        print(f"  trying {cand['model']} …")
        res = call({
            "mode": "run",
            "model": cand["model"],
            "input": {cand["prompt_field"]: f"{MIA} {STYLE}", **cand["extra"]},
            "reference_path": REFERENCE_PATH,
            "reference_field": cand["reference_field"],
        })
        if res.get("ok"):
            print(f"  using {cand['model']}")
            return cand, res
        print(f"    unavailable: {str(res.get('error'))[:180]}")
    return None, None


def render(cand, slug, scene):
    OUT.mkdir(parents=True, exist_ok=True)
    started = time.time()
    res = call({
        "mode": "run",
        "model": cand["model"],
        "input": {
            cand["prompt_field"]: f"{scene}\n\n{MIA}\n\n{PIP}\n\nArt style: {STYLE}",
            **cand["extra"],
        },
        "reference_path": REFERENCE_PATH,
        "reference_field": cand["reference_field"],
    })
    if not res.get("ok"):
        print(f"  FAIL {slug}: {str(res.get('error'))[:300]}")
        return None

    path = OUT / f"{slug}.png"
    path.write_bytes(base64.b64decode(res["images_base64"][0]))
    rec = {
        "slug": slug,
        "model": cand["model"],
        "latency_ms": res["latency_ms"],
        "predict_seconds": res.get("predict_seconds"),
        "wall_ms": int((time.time() - started) * 1000),
        "bytes": path.stat().st_size,
    }
    with LOG.open("a") as f:
        f.write(json.dumps(rec) + "\n")
    print(f"  ok  {slug:22} {res['latency_ms'] / 1000:>6.1f}s  "
          f"predict={res.get('predict_seconds')}s  {path.stat().st_size / 1024:.0f}KB")
    return path


if __name__ == "__main__":
    print("Selecting an available open-weights model…")
    cand, probe = pick_model()
    if not cand:
        raise SystemExit(
            "No candidate model ran. Check REPLICATE_API_TOKEN is set as an Edge "
            "Function secret, and that the model slugs above still exist.",
        )

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "00-probe.png").write_bytes(base64.b64decode(probe["images_base64"][0]))

    print(f"\nRendering {len(SCENES)} scenes on {cand['model']}…")
    for slug, scene in SCENES.items():
        render(cand, slug, scene)

    print(f"\nOutputs in {OUT}")
    print("Replicate bills per prediction-second; read predict_seconds in "
          "metrics.jsonl against the model's per-second rate for $/image.")
