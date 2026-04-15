---
"skill-harbor": minor
---

<!-- hero: Sources, Targets, and Shared Skill Harbors -->

Captain's Briefing: The harbor charts a clearer course for teams sharing skills across local folders and RuleSync-managed roots. This release teaches Harbor to distinguish **sources** from **targets**, keep folder-backed sources refreshed during normal syncs, and explain that workflow clearly in the manual.

## ✨ New Cargo
- **Folder-backed manifest sources**: `skill-harbor dock <source>` can now treat a local folder such as `~/.rulesync/skills` as a first-class source, discover nested child skills, and keep them tracked as generated children during syncs.
- **Drift-resistant refresh flow**: `skill-harbor up` rescans docked folder sources, while `skill-harbor freshen` forces a refresh even when Harbor would otherwise reuse cached state.
- **Source vs target guidance**: Added dedicated docs explaining that a path like `~/.rulesync/skills` can be either a **source** (where skills come from) or a **target** (where Harbor berths generated skills), plus guidance on when to use folder-backed sources vs `fathom --ghosts`.

## 🛠️ Barnacle Scraping
- **Clearer dock semantics**: `dock <url>` became `dock <source>`, `--local` became `--override`, and the project-personal manifest was renamed to `.harbor/harbor-manifest.overrides.json` with migration support from the legacy `.local` name.
- **Safer folder-source reconciliation**: Folder-source sync keeps the folder as the authoritative manifest object, records generated child-skill provenance, skips/warns on collisions, and avoids mutating RuleSync config or auto-deleting manual entries in v1.
- **Manual app alignment**: The generated manual now includes a dedicated foundations page and navigation links that explain sources, targets, folder-backed sources, ghost docking, and RuleSync-backed team workflows.
