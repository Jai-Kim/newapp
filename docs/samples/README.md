# Sample Volumes

Human-review output from `scripts/generate-sample-volume.ts` (issue #22) — the
real generation pipeline, not fixtures. Each subdirectory is one taste-check
run: a bilingual, 10-chapter Volume for a specific test child, exported as
markdown (one file per chapter, plus a `README.md` index with cost and setup
notes), with the first chapter's illustrated pages saved alongside it.

This exists to answer the one question CI cannot: are the stories, and the
Korean, actually good? Nothing in this directory is a fixture another test
depends on — it is safe to delete a sample once it has been read.

To generate a new one:

```
pnpm tsx scripts/generate-sample-volume.ts --name <name> --lead ko --slug <slug>
```

See the script's own header comment for the required environment and what it
costs.
