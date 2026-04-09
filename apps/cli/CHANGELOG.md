# skill-harbor

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
