# skill-harbor

## Unreleased

### Patch Changes

## ⚓ Clearer Berth Placement Reporting

- **Fathom status labels** now use concise berth/stowage formatting such as `Codex | .codex` and `Codex | .stowage/codex` across individual output and report views.
- **Fathom report JSON** now exposes additive structured placement detail under `vesselPlacements` while keeping `fleetStatus` count-only.
- **Ghosts output** now aligns with the same concise placement style while preserving berth vs stowage semantics.

## 0.15.1

### Patch Changes

## ⚓ Charting Smoother Waters

Captain's Briefing: The Skill Harbor is navigating through calmer waters with our latest adjustments, ensuring a more streamlined experience for all crew members. Our trusty cartographers have been hard at work, fine-tuning the workflow to prevent any hidden reefs from disrupting our journey.

## 🛡️ Hardened Hull (CI/CD Enhancements)

- Updated `.github/workflows/sync-docs.yml` to include `permissions` with `contents: write`, granting the workflow the necessary permissions to write contents, thus preventing potential bottlenecks in our documentation synchronization process.

## 🛠️ Barnacle Scraping (Technical Fixes)

- Modified the `sync-docs.yml` workflow to monitor changes in `scripts/**` and `package.json`, ensuring that our documentation stays afloat with the latest changes, and our workflow doesn't get stuck in the doldrums due to outdated package information.

## 0.15.0

### Minor Changes

## ⚓ Harbor Navigator

Ahoy! We're weighing anchor on a massive refinement of the Skill Harbor ecosystem. Introducing a Skill Contracts analysis both heuristic with Fathom and through testing chained skills via Voyager! Moreso to make this easier we added documentation via Mintlify and added three skills for assisting you to make the transition to smaller contract based skills.

## ✨ New Cargo (Key Features)

- **⚓ Fathom Contracts**: Introducing formal Semantic Contracts. Agent intelligence is now enforceable through rigorous I/O validation of `## Requires` and `## Produces` headers, preventing hallucinations in chained workflows.
- **⛵ Voyager Orchestration**: Launched the `voyager` suite for end-to-end integration testing. Orchestrate and analyze chained skill journeys through real agent simulations to ensure your fleet is battle-ready.
- **🛠️ Harbor Meta-Skills**: Berth specialized nautical tools like `loft-master`, `fleet-surgeon`, and `contract-notary` to help refine and architect your intelligence layer.
- **📖 Documentation Home**: A high-fidelity documentation suite is launching at **docs.skill-harbor.app** (stay tuned for the signal flare!).

## 🛡️ Hardened Hull (Architecture & Security)

- **📂 The .harbor Standard**: Relocated the nerve center of the harbor. All manifests and control files now reside in the `.harbor/` directory, with moored skills securely berthed in `.harbor/skills/`.
- **📏 Harbor Certified Anatomy**: Formalized the **Skill Standards** taxonomy, introducing **Ship Class** displacement metrics (Dinghy -> Galleon) for precise context management.
- **🔒 Lockdown Governance**: Hardened the hull with improved session isolation and encryption-ready manifest tracking.

## 🛠️ Barnacle Scraping (Refactors & Cleanup)

- **🧹 Global Branding Refinement**: Scrubbed the deck of "AI Agent" terminology in favor of professional "Engineering Context."
- **🔄 Tagline Synchronization**: Updated all CLI help text, `README.md`, and `llms.txt` to reflect our new orchestration-first mission.
- **🧪 Test Alignment**: Synchronized integration test assertions with the refined setup and orchestration branding.

## 0.14.0

### Minor Changes

## ⚓ The Harmonious Horizon

# Captain's Briefing

Captain's Briefing: The Skill Harbor's fleet is expanding! We've commissioned three new powerhouse vessels—**Windsurf**, **Continue.dev**, and **GitHub Copilot**—into our multi-platform support fleet, ensuring your standardized skills can berth seamlessly across even more of the AI ocean. To help you navigate these new waters, we've installed an **Intelligent Target Selection** system. Stop guessing which berths are active in the fog; our new interactive CLI will auto-detect your agents or guide you through a precision selection, ensuring your cargo always finds its destination with zero config required.

## ✨ New Cargo

- **Expanded Fleet Support**: Skill Harbor now provides first-class docking for **Windsurf**, **Continue.dev**, and **GitHub Copilot**, alongside existing support for **Claude Code**, **Cursor**, **Gemini**, and **Antigravity**.
- Introduced the `--target` flag for **Targeted Sync**, allowing you to berth skills to a specific agent without affecting others.
- Added the **list** command to display all skills currently tracked in the harbor.

## 🛡️ Hardened Hull

- Improved **Success Path** with a 4-step guide to standardize your agent rules in under 60 seconds.
- **Interactive Target Selection**: Introduced a premium CLI selection menu that auto-detects active berths or guides you through selecting targets on the fly when no configuration is found.

## 🛠️ Barnacle Scraping

- Fixed the `README.md` to update the Distribution section with the correct IDE configuration folders, including `.gemini/skills` and `.gemini/antigravity/skills`.
- Updated dependencies, including `prompts` and `@types/prompts`, to ensure compatibility and security.
- Mocked `getManagedAgentTargets` in `stow.test.ts` to return a list of managed agent targets, including Claude, Cursor, Antigravity, and Codex, with an option to include Rulesync.

## 0.13.0

### Minor Changes

## ⚓ Tides of Change

### Captain's Briefing

Our fleet support wasn't complete! We've added the **Codex** agent into our multi-platform support fleet, providing explicit orchestration for its unique workspace requirements.
For our brave contributors, we've also anchored a new **Changeset Gate** into our PR pipelines enabling our automated systems to trigger a seamless release to the NPM oceans the moment contributions are merged.

## ✨ New Cargo (Key Features)

- Added support for Codex agent, expanding our multi-agent support fleet to include **Claude Code**, **Cursor**, **Codex**, and **Antigravity**.
- Updated `README.md` to reflect the latest changes and improvements in our declarative workspace orchestrator.

## 🛡️ Hardened Hull (CI/CD Enhancements)

- Introduced a changeset gate in our CI/CD pipeline to ensure consistency and documentation of changes, making every pull request a carefully charted voyage.

## 🛠️ Barnacle Scraping (Technical Fixes)

- Fixed and refactored various commands (`stow`, `undock`, `unstow`) to utilize `getManagedAgentTargets` for consistent target handling, reducing the risk of hidden shoals.
- Updated tests for `stowAction`, `undockAction`, and `unstowAction` to reflect the new target handling, ensuring our lookout tower is always vigilant.

## 0.12.0

### Minor Changes

## ⚓ Ghost Fleet Discovery

# Captain's Briefing

The Skill Harbor has received significant upgrades, allowing for the discovery of ghost skills in agent berths and providing a comprehensive fleet status report.

## ✨ New Cargo (Key Features)

- **👻 Ghost Visibility**: Added a `-u, --ghosts` flag to `fathom` that identifies skills present in your agent folders (or stowage) that aren't registered in the harbor manifest.
- **📡 Agent-Specific Status**: Every skill profiled now explicitly labels where it is active (`[Berthed: Claude, Cursor]`) or suspended (`[Stowed: Antigravity]`).
- **📊 Fleet Summary**: The `fathom --report` summary now includes a **Fleet Status Distribution** section, giving you a high-level view of active, stowed, and dry-docked skills.
- **🚜 Dry Dock Tracking**: Skills moored in the harbor but not yet berthed or stowed are now explicitly tracked and reported as being in **"Dry Dock"**.

## 🛡️ Technical Fixes

- **🛠️ Refactored Core**: Centralized agent path discovery into a reusable utility, ensuring consistency between the `check` and `fathom` commands.
- **🚀 Enhanced Orchestration**: Improved `fathomAction` for better ghost discovery and vessel status determination.

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
