---
"skill-harbor": minor
---

<!-- hero: The Double-Run Navigator -->

The harbor has learned a new trick: not just whether the crew *used* a skill, but whether that skill actually improved the voyage. Alongside that sharper compass, the docs now chart a clearer course for how Skill Harbor aligns with the SkillsBench research without mistaking the benchmark for the fleet itself.

## ✨ New Cargo

- Added `skill-harbor voyager --compare` in `apps/cli/src/index.ts` and `apps/cli/src/commands/voyager.ts` so Voyager can run the same scenario with and without skills, then report the delta.
- Added structured Voyager result models in `apps/cli/src/types/voyager.ts`, including run status, assertion summaries, traces, and compare output payloads.
- Added trace artifact persistence in `apps/cli/src/commands/voyager.ts` so compare runs can save `with-skills.json`, `without-skills.json`, and `summary.json` for later inspection or CI use.

## 🛡️ Hardened Hull

- Expanded `apps/cli/src/commands/voyager.test.ts` to cover compare-mode JSON output, saved traces, and the no-skills branch so the new evaluation path is guarded against regressions.
- Verified the new Voyager path with `oxlint`, `tsc --noEmit`, the full Vitest suite, and a production build.

## 🛠️ Barnacle Scraping

- Refactored `apps/cli/src/commands/voyager.ts` into smaller internal helpers for scenario loading, tool discovery, paired execution, assertions, compare-result formatting, and artifact persistence, making future benchmark-pack work easier to bolt on.
- Added a new FAQ at `docs/faq/skillsbench.mdx` and linked it from `README.md`, `docs/index.mdx`, `docs/faq/comparison.mdx`, `docs/foundations/governance.mdx`, `docs/foundations/voyager.mdx`, and `docs/skill-standards.mdx` to clarify how Skill Harbor aligns with SkillsBench.
- Tightened SkillsBench-related language across the docs so Skill Harbor is consistently framed as the governance and operations layer, while SkillsBench remains the research and evaluation lens.
