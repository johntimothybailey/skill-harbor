# skill-harbor

## 0.11.0

### Minor Changes

## ⚓ Sonar Intelligence: Probabilistic Auditing

Captain's Briefing: Skill Harbor has commissioned the **Sonar Intelligence Engine**, a dual-layer "Confidence" auditor for your agentic fleet. Fathom now scans deeper than ever—moving beyond simple token displacement to measure real-world reliability. Use **Confidence (Heuristic)** for an instant, offline look at your prompt's "wake," or deploy **Confidence (Sonar)** to probe the actual LLM (OpenAI, Groq, Gemini) for the exact mathematical probability (logprobs) of a skill triggering. Stop guessing your way through the fog; start fathoming with probabilistic certainty.

## ✨ New Cargo (Key Features)

- **Confidence (Heuristic)**: Implemented a proprietary scoring algorithm (1-10) that evaluates semantic vagueness, trigger clarity, and collision risk across your entire fleet.
- **Confidence (Sonar)**: Introduced a high-fidelity audit layer that extracts mathematical trigger likelihood (logprobs) from real model responses (OpenAI/Ollama) using a specific user query.
- **Sonar Configuration Layer**: Added `profiler.yaml` and `.env` support for flexible routing between LLM providers and secure API management.
- **Health Reporting**: Enhanced harbor-wide reports now include cumulative context bloat, token consumption, and fleet-wide confidence averages.
- **CI/CD Governance**: Integrated `--max-tokens`, `--max-bloat`, `--min-score`, and `--format json` for automated PR gating and fleet quality enforcement.
- **Maritime UI**: Refined nautical-themed reporting with interactive confidence bars and detailed heuristic breakdowns.

## 0.10.0

### Minor Changes

## ⚓ Nautical Navigator

Captain's Briefing: Charting a new course with the addition of **'fathom'**, our new skill profiling command, and **'freshen'**, the thematic way to pull fresh cargo from any source. These enhancements help you navigate the seas of skill management with greater precision and speed.

## ✨ New Cargo (Key Features)

- Added the **`fathom`** command, a heuristic profiler for evaluating the operational footprint of skills, allowing you to understand the 'displacement' and 'draft' of your skills in the harbor.
- Introduced the **`freshen`** command, providing a thematic way to 'pull fresh cargo' by bypassing the local cache to fetch the latest source from remote repositories or local paths. This ensures your fleet always has the most up-to-date intelligence without manual intervention.

## 🛠️ Barnacle Scraping (Technical Fixes)

- Refactored the Quartermaster CLI to remove the 'edit' option, streamlining the user experience.
- Improved testing for the 'up' and 'freshen' commands, ensuring smoother operation and reducing the risk of barnacles forming on our codebase.

## 0.9.0

### Minor Changes

## ⚓ Anchors Aweigh: Linting and Skill Health

## Captain's Briefing

The Skill Harbor has received a significant upgrade to its hull, with the addition of oxlint for improved code quality and a new `check` command to ensure skill health. The harbor is now better equipped to handle the demands of the high seas.

## ✨ New Cargo (Key Features)

- **New `check` command**: Perform a health check on docked skills, including metadata quality and berth verification.
- **Added oxlint**: Integrate oxlint for improved code quality and linting.

## 🛡️ Hardened Hull (CI/CD Enhancements)

- **Updated dependencies**: Ensure the harbor's dependencies are up-to-date and secure.

## 🛠️ Barnacle Scraping (Technical Fixes)

- **Improved skill management**: Enhance skill management and berthing logic.
- **Code quality improvements**: Address code quality issues and improve maintainability.

## New Skill Discovery

- **Added test-skill**: A new skill has been added to the harbor's manifest, demonstrating the ease of skill discovery and integration.

## 0.8.0

### Minor Changes

## ⚓ Anchors Aweigh for Automation and Efficiency

## Captain's Briefing

The Skill Harbor is ready to set sail with enhanced automation and improved efficiency. Recent changes have bolstered our defenses and sharpened our tools, ensuring a smoother journey for all crew members.

## ✨ New Cargo (Key Features)

- Enhanced changelog formatting with `scripts/changelog-format.cjs` for more engaging release notes.
- Introduction of `scripts/quartermaster.ts` for streamlined release note generation, utilizing the power of AI for creative and pun-filled descriptions.

## 🛡️ Hardened Hull (CI/CD Enhancements)

- Updated GitHub workflow in `.github/workflows/release.yml` to automatically update release titles with hero titles, making our releases more discoverable and engaging.
- Improved dependency management with the addition of `@changesets/get-github-info`, `@changesets/types`, `@types/node`, and `dotenv`, ensuring our hull is watertight against dependency issues.

## 🛠️ Barnacle Scraping (Technical Fixes)

- Various dependency updates to keep our ship running smoothly and securely, including `vitest` and `typescript` updates.
- Enhanced `.gitignore` to keep our harbor clean and organized.

## 0.7.1

### Patch Changes

- 2fa3f02: Global commands: robust error reporting by preventing error swallowing during synchronization and adds enhanced diagnostics to troubleshoot file system berthing issues. It also enforces strict global manifest usage and target filtering to ensure clean synchronization without unintentional local directory or ghost agent folder creation.

## 0.7.0

### Minor Changes

- 853b4f3: ## ✨ Key Features

  - **Universal Portability**: Switched to a compiled JS distribution () to resolve .
  - **Smart Differential Sync**: Optimized syncloop to skip redundant operations if the source hash is unchanged.
  - **Target Array Support**: Optional array in for explicit agent berthing control.
  - **Lighthouse Automated Manifest**: Added automated generation of for zero-tier agent discovery.
  - **Changesets Integration**: Automated versioning and NPM publishing via GitHub Actions.

  ## 🔮 New Skill: Scryer

  - Introduced the **Scryer** skill for 'seeing' hidden portability issues (Bun-isms, hardcoded paths) and navigating the harbor.

  ## 🛡️ CI/CD Enhancements

  - Added **Clean Room Smoke Tests** on a Node matrix (20, 22, 24) without Bun installed.

  ## 🛠️ Technical Fixes

  - Hardened frontmatter regex to support multiple line endings and bracketed triggers.
  - Fixed stale manifest state-sync bug in the syncloop.
  - Corrected command invocation logic.

  Ready for final review and release. ⚓🛳️
