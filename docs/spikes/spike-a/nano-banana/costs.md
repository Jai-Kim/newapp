# Spike A — cost & latency (nano-banana)

Model: `gemini-2.5-flash-image`  ·  4 images

| Image | Latency | In tok | Out tok | Est. cost |
|---|---:|---:|---:|---:|
| Locked reference sheet | 7,657ms | 310 | 1,290 | $0.0391 |
| Scene 1 — swim lesson | 9,471ms | 566 | 1,290 | $0.0392 |
| Scene 2 — night forest | 8,645ms | 563 | 1,290 | $0.0392 |
| Scene 3 — breakfast table | 9,474ms | 556 | 1,290 | $0.0392 |
| **Total (4 images)** | **35.2s** | | | **$0.1566** |

Mean **$0.0391/image**, **8.8s/image**.

Rates: output billed per image, input per token ($0.039/image + $0.3/1M input tokens), published paid-tier, Aug 2026. Input token counts include the reference image (~258 tokens) on scene renders.
