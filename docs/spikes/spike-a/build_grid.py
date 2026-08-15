#!/usr/bin/env python3
"""Spike A, step 3 — assemble the comparison grid and cost/latency table.

Reads the PNGs and metrics.jsonl for a model directory and writes:
  <model>/grid.png   reference sheet on top, the three scenes below, labelled
  <model>/costs.md   per-image latency and cost, for Spike C

Usage:  python3 build_grid.py [model-dir-name]   (default: nano-banana)
"""
import json
import pathlib
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = pathlib.Path(__file__).resolve().parent

# Published paid-tier rates, Aug 2026. Output images are billed per image;
# input is per token. https://ai.google.dev/gemini-api/docs/pricing
RATES = {
    "gemini-2.5-flash-image": {"out_per_image": 0.039, "in_per_mtok": 0.30},
    "gemini-3-pro-image": {"out_per_image": 0.134, "in_per_mtok": 2.00},
}

LABELS = {
    "00-reference-sheet": "Locked reference sheet",
    "01-swim-lesson": "Scene 1 — swim lesson",
    "02-night-forest": "Scene 2 — night forest",
    "03-breakfast-table": "Scene 3 — breakfast table",
}


def font(size):
    for p in (
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ):
        if pathlib.Path(p).exists():
            try:
                return ImageFont.truetype(p, size)
            except OSError:
                pass
    return ImageFont.load_default()


def build(model_dir):
    d = HERE / model_dir
    records = [json.loads(l) for l in (d / "metrics.jsonl").read_text().splitlines() if l.strip()]
    # Keep the newest record per slug, in case a scene was re-rolled.
    by_slug = {r["slug"]: r for r in records}

    ref = Image.open(d / "00-reference-sheet.png").convert("RGB")
    scenes = [
        Image.open(d / f"{s}.png").convert("RGB")
        for s in ("01-swim-lesson", "02-night-forest", "03-breakfast-table")
        if (d / f"{s}.png").exists()
    ]

    PAD, CAP, BG = 24, 46, (250, 248, 243)
    cell_w = 620
    scene_h = round(scenes[0].height * cell_w / scenes[0].width)
    ref_w = cell_w * len(scenes) + PAD * (len(scenes) - 1)
    ref_h = round(ref.height * ref_w / ref.width)

    W = ref_w + PAD * 2
    H = PAD + CAP + ref_h + PAD + CAP + scene_h + PAD
    canvas = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(canvas)
    f_cap, f_small = font(26), font(19)

    y = PAD
    draw.text((PAD, y), LABELS["00-reference-sheet"], fill=(60, 50, 45), font=f_cap)
    y += CAP
    canvas.paste(ref.resize((ref_w, ref_h), Image.LANCZOS), (PAD, y))
    y += ref_h + PAD

    draw.text((PAD, y), "Same cast, rendered from that sheet", fill=(60, 50, 45), font=f_cap)
    y += CAP
    for i, (img, slug) in enumerate(
        zip(scenes, ("01-swim-lesson", "02-night-forest", "03-breakfast-table"))
    ):
        x = PAD + i * (cell_w + PAD)
        canvas.paste(img.resize((cell_w, scene_h), Image.LANCZOS), (x, y))
        r = by_slug.get(slug, {})
        draw.text(
            (x + 6, y + scene_h + 6),
            f"{LABELS[slug]}  ·  {r.get('api_latency_ms', '?')}ms",
            fill=(110, 98, 90),
            font=f_small,
        )

    out = d / "grid.png"
    canvas.save(out, optimize=True)
    print(f"wrote {out.relative_to(HERE.parents[2])}  ({out.stat().st_size/1024:.0f}KB)")

    # ---- cost + latency table -------------------------------------------
    lines = [
        f"# Spike A — cost & latency ({model_dir})",
        "",
        f"Model: `{records[0]['model']}`  ·  {len(by_slug)} images",
        "",
        "| Image | Latency | In tok | Out tok | Est. cost |",
        "|---|---:|---:|---:|---:|",
    ]
    total_cost = total_ms = 0.0
    for slug in LABELS:
        r = by_slug.get(slug)
        if not r:
            continue
        rate = RATES[r["model"]]
        u = r.get("usage", {})
        in_tok, out_tok = u.get("promptTokenCount", 0), u.get("candidatesTokenCount", 0)
        cost = rate["out_per_image"] + in_tok * rate["in_per_mtok"] / 1e6
        total_cost += cost
        total_ms += r["api_latency_ms"]
        lines.append(
            f"| {LABELS[slug]} | {r['api_latency_ms']:,}ms | {in_tok:,} | {out_tok:,} | ${cost:.4f} |"
        )
    n = len(by_slug)
    lines += [
        f"| **Total ({n} images)** | **{total_ms/1000:.1f}s** | | | **${total_cost:.4f}** |",
        "",
        f"Mean **${total_cost/n:.4f}/image**, **{total_ms/n/1000:.1f}s/image**.",
        "",
        "Rates: output billed per image, input per token "
        f"(${RATES[records[0]['model']]['out_per_image']}/image + "
        f"${RATES[records[0]['model']]['in_per_mtok']}/1M input tokens), "
        "published paid-tier, Aug 2026. Input token counts include the "
        "reference image (~258 tokens) on scene renders.",
    ]
    (d / "costs.md").write_text("\n".join(lines) + "\n")
    print(f"mean ${total_cost/n:.4f}/image, {total_ms/n/1000:.1f}s/image")


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "nano-banana")
