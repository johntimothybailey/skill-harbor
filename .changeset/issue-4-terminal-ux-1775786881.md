---
"skill-harbor": patch
---

<!-- hero: Calm Seas for Concurrent Sync -->

The fleet no longer tries to animate its way through parallel sync work. This patch switches concurrent workspace synchronization to deterministic spinner output so mixed success, skip, cache-reuse, and failure states stay readable without fragile multi-spinner animation.

## 🛠️ Barnacle Scraping

- Updated `apps/cli/src/commands/up.ts` to create `Spinnies` with `disableSpins: true` for the concurrent sync path, trading animation for clearer, more stable terminal output.
- Added regression coverage in `apps/cli/src/commands/up.test.ts` to ensure the concurrent sync flow keeps spinner animation disabled.
