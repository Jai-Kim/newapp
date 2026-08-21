# Week 1 — De-risking Spikes (build/no-build gate) — GREEN

All four spikes passed. The month is de-risked; committing to Week 2 (core loop).

---

## Spike 0 — Scaffolding — PASSED

Expo/Obytes app scaffolded; Supabase wired (schema + RLS + pgvector); both Edge
Functions deployed; health check green (server-side keys only).

## Spike A — Character & style consistency — PASSED

`gemini-2.5-flash-image` (Nano Banana) held identity across 3 scenes at
**$0.039/image, ~9s**; no drift. Finding: identity/wardrobe split (ADR-0001).

## Spike B — Cross-night memory (the moat) — PASSED

Chapter 2 resolved a chapter-1 thread by UUID from **DB-only canon** (no chat
history), in **native English + Korean**, page-aligned. The moat works.

## Spike C — Unit economics — PASSED

Real cost model built. Reshaped to **4 illustrations/chapter** (ADR-0002);
repackaged as **books, not a feed** (ADR-0003): cheap digital habit-keeper
($1.99/3mo → $1.99/mo, ~1 book/mo allowance) with the margin engine in printed,
giftable bilingual hardcovers. Positive, defensible economics at a believable
price. Open weights remain the deferred lever to lift the digital cap.

## Spike D — Safety — PASSED

Text + image safety. `reviewIllustration` blocks nightmare fixtures while passing
real grief-chapter art; blocked pages degrade to text-only. Parent-preview wired.

---

## Gate decision — GREEN, build

| Spike | Pass bar | Result | Evidence |
|---|---|---|---|
| A — consistency | Parent accepts same character across ≥3 scenes | ☑ passed | [`spike-a/`](spikes/spike-a/) |
| B — memory | Ch.2 continues Ch.1 thread from DB, both languages | ☑ passed | [`spike-b/`](spikes/spike-b/) |
| C — economics | Healthy margin at a believable price | ☑ passed | [`spike-c/`](spikes/spike-c/) |
| D — safety | Sensitive prompts safe (EN+KO); parent gate works | ☑ passed | [`spike-d/`](spikes/spike-d/) |

All four passed → **commit to Week 2 (core loop).**
