---
"skill-harbor": patch
---

<!-- hero: Fathom Surfaces Cleanly -->

Captain's Briefing: Fathom now finishes its voyage without leaving a spinner line moored to the terminal, and the harbor trims generated local files out of future diffs.

## 🔧 Repaired Ships
- Fixed `fathomAction` in `apps/cli/src/commands/fathom.ts` so each per-skill spinner removal also stops the `Spinnies` manager, preventing the command from appearing to hang after the report finishes.
- Added regression coverage in `apps/cli/src/commands/fathom.test.ts` to assert Fathom stops the spinner manager after removing an individual skill spinner.

## 🛠️ Barnacle Scraping
- Stopped tracking generated Next.js `next-env.d.ts` files and added `**/next-env.d.ts` to `.gitignore`, preventing dev/build route-type churn in `apps/manual` and future Next apps.
- Added `.harbor/harbor-manifest.overrides.json` as an explicit empty override layer so Harbor tooling can distinguish intentional override defaults from a missing file.
- Grouped local agent, release, and generated-source ignore rules in `.gitignore`, including `.codex/`, `.omx/`, `.unmint`, and Harbor stowage artifacts.
