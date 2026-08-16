# Spike A — cost & latency (korean)

Model: `gemini-2.5-flash-image`  ·  4 images

| Image | Latency | In tok | Out tok | Est. cost |
|---|---:|---:|---:|---:|
| Locked reference sheet | 6,606ms | 410 | 1,290 | $0.0391 |
| Scene 1 — swim lesson | 8,573ms | 715 | 1,290 | $0.0392 |
| Scene 2 — night forest | 8,015ms | 706 | 1,290 | $0.0392 |
| Scene 3 — breakfast table | 7,866ms | 712 | 1,290 | $0.0392 |
| **Total (4 images)** | **31.1s** | | | **$0.1568** |

Mean **$0.0392/image**, **7.8s/image**.

Rates: output billed per image, input per token ($0.039/image + $0.3/1M input tokens), published paid-tier, Aug 2026. Input token counts include the reference image (~258 tokens) on scene renders.
