#!/usr/bin/env python3
"""Spike A runner — calls the spike-a Edge Function, saves PNGs, logs metrics."""
import base64
import json
import os
import pathlib
import sys
import time
import urllib.request

REPO = pathlib.Path(__file__).resolve().parents[3]

# Which image model to test. Spike A starts on the cheaper Nano Banana and
# escalates to Nano Banana Pro only if the character drifts, so outputs are
# kept in per-model directories and never overwrite each other.
MODEL = os.environ.get("SPIKE_A_MODEL", "gemini-2.5-flash-image")
SHORT = {
    "gemini-2.5-flash-image": "nano-banana",
    "gemini-3-pro-image": "nano-banana-pro",
}.get(MODEL, MODEL)

OUT = REPO / "docs/spikes/spike-a" / SHORT
LOG = OUT / "metrics.jsonl"


def env(name):
    for line in (REPO / ".env").read_text().splitlines():
        if line.startswith(name + "="):
            return line.split("=", 1)[1].strip()
    raise SystemExit(f"{name} not in .env")


BASE = env("EXPO_PUBLIC_SUPABASE_URL")
ANON = env("EXPO_PUBLIC_SUPABASE_ANON_KEY")


def call(payload, timeout=300):
    req = urllib.request.Request(
        f"{BASE}/functions/v1/spike-a",
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {ANON}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    started = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = json.loads(r.read())
    except urllib.error.HTTPError as e:
        # The function returns JSON on errors too — that body is the whole
        # point, so don't let urllib turn it into a bare exception.
        raw = e.read().decode(errors="replace")
        try:
            body = json.loads(raw)
        except Exception:
            body = {"ok": False, "error": f"HTTP {e.code}: {raw[:1000]}"}
    body["_wall_ms"] = int((time.time() - started) * 1000)
    return body


def generate(slug, prompt, references=(), aspect="1:1", size="2K"):
    """Generate one image; save PNG + append metrics. Returns the file path."""
    OUT.mkdir(parents=True, exist_ok=True)
    refs = []
    for p in references:
        data = base64.b64encode(pathlib.Path(p).read_bytes()).decode()
        refs.append({"mime_type": "image/png", "data": data})

    res = call({
        "mode": "generate",
        "model": MODEL,
        "prompt": prompt,
        "references": refs,
        "aspect_ratio": aspect,
        "image_size": size,
    })
    if not res.get("ok"):
        print(f"  FAIL {slug}: {res.get('error', '')[:600]}")
        return None

    path = OUT / f"{slug}.png"
    path.write_bytes(base64.b64decode(res["image_base64"]))

    rec = {
        "slug": slug,
        "model": MODEL,
        "aspect": aspect,
        "size": size,
        "n_references": len(refs),
        "api_latency_ms": res["latency_ms"],
        "wall_ms": res["_wall_ms"],
        "usage": res.get("usage", {}),
        "finish_reason": res.get("finish_reason"),
        "bytes": path.stat().st_size,
        "prompt": prompt,
    }
    with LOG.open("a") as f:
        f.write(json.dumps(rec) + "\n")

    u = rec["usage"]
    print(f"  ok  {slug:22} {res['latency_ms']:>6}ms  {path.stat().st_size/1024:>7.0f}KB  usage={u}")
    return path


if __name__ == "__main__":
    print(json.dumps(call({"mode": "list"}), indent=2)[:400])
