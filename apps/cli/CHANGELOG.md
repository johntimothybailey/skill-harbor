# skill-harbor

## 0.19.1

### Patch Changes

## ⚓ Calmer Waters for Cached Cargo

## Captain's Briefing

Skill Harbor now recovers more cleanly when a berth goes missing but the cargo is still cached in Harbor. The orchestrator keeps its status line alive across cached-cargo sync paths, so a follow-up `up` can actually re-berth the skill instead of failing mid-voyage.

## 🛠️ Barnacle Scraping (Technical Fixes)

- Added `ensureSpinnerActive` in `apps/cli/src/orchestrator.ts` and routed `moor`, `processCargo`, `berth`, and `finalize` through it so cached-cargo sync paths no longer throw `No spinner initialized with name sync-<skill>`.
- Switched the explicit helper-binary spawns in `apps/cli/src/orchestrator.ts` to `shell: false`, removing the noisy `DEP0190` child-process warning during `skill-harbor up`.
- Added regression coverage in `apps/cli/src/orchestrator.test.ts` for re-berthing cached cargo and processing cached cargo without a prior moor spinner.

## 0.19.0

### Minor Changes

## ⚓ Ghost Signals Across the Harbor

Captain's Briefing: The harbor now charts ghostly drift as clearly as it charts fleet cargo. This release adds a first-class Ghosts workflow, keeps folder-backed sources refreshed during normal syncs, and sharpens the manual so crews can tell sources, targets, and haunted berths apart at a glance.

## ✨ New Cargo

- **Folder-backed manifest sources**: `skill-harbor dock <source>` can now treat a local folder such as `~/.rulesync/skills` as a first-class source, discover nested child skills, and keep them tracked as generated children during syncs.
- **Drift-resistant refresh flow**: `skill-harbor up` rescans docked folder sources, while `skill-harbor freshen` forces a refresh even when Harbor would otherwise reuse cached state.
- **Source vs target guidance**: Added dedicated docs explaining that a path like `~/.rulesync/skills` can be either a **source** (where skills come from) or a **target** (where Harbor berths generated skills), plus guidance on when to use folder-backed sources vs `fathom --ghosts`.
- **Standalone Ghosts workflow**: Added `skill-harbor ghosts` as the primary explicit ghost-inspection command, with support for friendly ghosts that are summarized by default and expanded with `--friendly`.
- **Safer friendly ghosts**: Friendly ghosts are stored outside the manifest and remain non-destructive in v1, so marking a ghost as friendly does not dock it, mutate its berth, or silently erase it from every workflow.
- **Richer berth placement output**: Ghost inspection can now surface per-skill metadata and full paths with `--details`, while Fathom adds structured `vesselPlacements` berth/stowage detail without breaking the existing count-focused `fleetStatus` summary.

## 🛠️ Barnacle Scraping

- **Clearer dock semantics**: `dock <url>` became `dock <source>`, `--local` became `--override`, and the project-personal manifest was renamed to `.harbor/harbor-manifest.overrides.json` with migration support from the legacy `.local` name.
- **Safer folder-source reconciliation**: Folder-source sync keeps the folder as the authoritative manifest object, records generated child-skill provenance, skips/warns on collisions, and avoids mutating RuleSync config or auto-deleting manual entries in v1.
- **Manual app alignment**: The generated manual now includes a dedicated foundations page and navigation links that explain sources, targets, folder-backed sources, ghost docking, and RuleSync-backed team workflows.
- **Quartermaster as a Harbor skill**: Added a tracked `skills/quartermaster` source skill and wired it into the project manifest so contributors can use Quartermaster through Harbor instead of only through `bun run quartermaster`.

## 🔧 Repaired Ships

- **Shared ghost discovery logic**: Fathom now reuses the same underlying ghost-discovery path as the new Ghosts workflow, so ghost inspection stays consistent while Fathom remains the ghost-aware analysis surface.
- **Headless-safe review flows**: Local `skill-harbor list` now reflects the merged manifest stack, and `voyager` only offers ghost docking in interactive terminals while reusing the scoped ghost-discovery path.
- **Cleaner npm cargo**: The published CLI package now whitelists the real distribution files and avoids shipping stale tarballs or extra workspace artifacts in `npm pack`.
- **AI export source-of-truth alignment**: `llms-full.txt` now reads from the same repo-root `docs/` tree that powers the manual app, and the manual README points contributors at that same content source.
- **Workspace-aware helper binaries**: Local `apps/cli/dist` builds can now find workspace-installed `skillfish` and `skill-porter` helpers by searching upward from the package root instead of assuming a package-local `node_modules/.bin`.

## 0.18.0

### Minor Changes

## ⚓ Charting Clearer Waters

Captain's Briefing: The harbor's charts are sharper and the rigging is tighter. This release adds stronger Voyager tooling, manual clarifications for a similiar project, and explanations for product boundaries.

## ✨ New Cargo

- **Voyager Comparison Mode**: Added `skill-harbor voyager --compare` to assess skill impact on agent performance, now found in `apps/cli/src/index.ts` and `apps/cli/src/commands/voyager.ts`.
- **Structured Voyager Results**: Introduced result models in `apps/cli/src/types/voyager.ts` for better comparison and analysis.
- **Dedicated Manual Documentation App**: Launched `apps/manual`, a Next.js site for our manual, enhancing navigation, search, and documentation structure.

## 🛡️ Hardened Hull

- **Monorepo Verification**: Updated `turbo.json` to include the `test` task, ensuring `bun run test` covers the entire workspace.
- **CI/CD Enhancements**: Adjusted GitHub Actions for monorepo support and dedicated manual deployment.

## 🛠️ Barnacle Scraping

- **Refactored Voyager Command**: Broken down `apps/cli/src/commands/voyager.ts` into smaller helpers for easier maintenance and future additions.
- **Improved Cache Handling**: Enhanced manifest and cache handling in `apps/cli/src/manifest.ts` to prevent global and project cache mix-ups.
- **Version Alignment**: Ensured `skill-harbor --version` reflects the package version in `apps/cli/package.json`, now covered by integration tests.

### Patch Changes

## ⚓ The Chart Room Corrected

The docs deployment route was steering Vercel into the wrong berth. This patch corrects the GitHub Actions workflow so the documentation build uses the project's configured root directory instead of doubling the `apps/manual` path, and it renames the deployment task to better reflect its real purpose.

## 🛠️ Barnacle Scraping

- Fixed `.github/workflows/deploy-docs.yml` by removing the extra `working-directory` overrides from the Vercel pull/build/deploy steps so the workflow no longer resolves `apps/manual/apps/manual/package.json`.
- Renamed the workflow job from `Deploy-Production` to `Deploy Documentation` for clearer GitHub Actions status output.

## ⚓ Calm Seas for Concurrent Sync

The fleet no longer tries to animate its way through parallel sync work. This patch switches concurrent workspace synchronization to deterministic spinner output so mixed success, skip, cache-reuse, and failure states stay readable without fragile multi-spinner animation.

## 🛠️ Barnacle Scraping

- Updated `apps/cli/src/commands/up.ts` to create `Spinnies` with `disableSpins: true` for the concurrent sync path, trading animation for clearer, more stable terminal output.
- Added regression coverage in `apps/cli/src/commands/up.test.ts` to ensure the concurrent sync flow keeps spinner animation disabled.

## 0.17.0

### Minor Changes

## ⚓ The Double-Run Navigator

The harbor has learned a new trick: not just whether the crew _used_ a skill, but whether that skill actually improved the voyage. Alongside that sharper compass, the docs now chart a clearer course for how Skill Harbor aligns with the SkillsBench research without mistaking the benchmark for the fleet itself.

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

## 0.16.0

### Minor Changes

## ⚓ New Charts, Clearer Berths

Captain's Briefing: This voyage reorganizes the harbor rather than pretending the sea itself has changed. Skill Harbor now ships from a monorepo with a dedicated manual docs app, while the CLI is clearer about where it should berth skills and how narrowly it should sync them.

## ✨ New Cargo (Key Features)

- **Dedicated manual documentation app**: The branch introduces `apps/manual`, a standalone Next.js docs site with richer navigation, search, MDX components, API routes, tests, and a refreshed docs structure for the public manual.
- **Clearer command-scope behavior**: `up`, `list`, `check`, `lighthouse`, `fathom`, and `voyager` now handle the "no project manifest, but a global manifest exists" case more deliberately by prompting in interactive terminals and falling back to the global harbor in non-interactive runs.
- **More precise targeted syncs**: `skill-harbor up --target` now supports a single target, a comma-separated list, or repeated flags such as `--target codex --target cursor`, with explicit validation against supported berth keys.

## 🛡️ Hardened Hull (CI/CD Enhancements)

- **Monorepo verification is wired back together**: `turbo.json` now includes the missing `test` task so root `bun run test` once again exercises the workspace instead of failing before it leaves the dock.
- **Docs app linting/build now match the current toolchain**: the manual app now uses flat ESLint config (`apps/manual/eslint.config.mjs`) and an `eslint .` script instead of the older `next lint` flow, which restores repo-level lint/build verification under the current Next 16 and ESLint 9 setup.
- **Deployment/release workflows were updated for the workspace layout**: GitHub Actions in `.github/workflows/` were adjusted to reflect the monorepo structure and the dedicated manual docs deployment path.

## 🛠️ Barnacle Scraping (Technical Fixes)

- **Global and project caches are less likely to get crossed**: manifest/cache handling in `apps/cli/src/manifest.ts` and the CLI commands that read from it now resolve cache paths by manifest layer, so global skills stop pretending to be project-local cargo.
- **Version output is pinned to the package manifest**: `skill-harbor --version` is now explicitly covered by integration tests so the CLI's reported version stays aligned with `apps/cli/package.json`.
- **Manual site metadata now points at the real harbor**: the docs theme config now uses the actual Skill Harbor GitHub repository instead of template placeholder links, and its config shape was tightened to match what the docs UI actually reads.
