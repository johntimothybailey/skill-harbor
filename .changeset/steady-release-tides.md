---
"skill-harbor": patch
---

<!-- hero: Steadier Releases and Clearer Berths -->

## Captain's Briefing

The harbor now has a sturdier post-merge release route, and Fathom reports berth placement with a fuller view of the active fleet. This patch focuses on reliability: releases should publish after a merged Changesets PR, and berth reporting should reflect every active agent match in the chosen scope.

## 🛠️ Barnacle Scraping (Technical Fixes)

- Split release automation into a dedicated publish workflow so merged `changeset-release/*` PRs can publish from a `pull_request_target` close event instead of relying on merge-commit push behavior.
- Added a guard that refuses to publish when pending `.changeset/*.md` files are still present, so the publish workflow only runs on versioned release states.
- Updated `fathom` berth-status discovery to scan all active berths in the selected local/global scope, so skills can show multiple matches such as Codex plus Rulesync instead of only the manifest-target subset.
- Added regression coverage for the expanded multi-berth Fathom status output.
