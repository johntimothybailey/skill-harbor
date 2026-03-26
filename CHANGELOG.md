# skill-harbor

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
