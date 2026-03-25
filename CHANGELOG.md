# skill-harbor

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
