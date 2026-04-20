---
"skill-harbor": patch
---

<!-- hero: Calmer Waters for Cached Cargo -->

## Captain's Briefing
Skill Harbor now recovers more cleanly when a berth goes missing but the cargo is still cached in Harbor. The orchestrator keeps its status line alive across cached-cargo sync paths, so a follow-up `up` can actually re-berth the skill instead of failing mid-voyage.

## 🛠️ Barnacle Scraping (Technical Fixes)
* Added `ensureSpinnerActive` in `apps/cli/src/orchestrator.ts` and routed `moor`, `processCargo`, `berth`, and `finalize` through it so cached-cargo sync paths no longer throw `No spinner initialized with name sync-<skill>`.
* Switched the explicit helper-binary spawns in `apps/cli/src/orchestrator.ts` to `shell: false`, removing the noisy `DEP0190` child-process warning during `skill-harbor up`.
* Added regression coverage in `apps/cli/src/orchestrator.test.ts` for re-berthing cached cargo and processing cached cargo without a prior moor spinner.
