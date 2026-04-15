---
"skill-harbor": minor
---

<!-- hero: Ghost Signals Across the Harbor -->

Captain's Briefing: The harbor now charts ghostly drift as clearly as it charts fleet cargo. This release adds a first-class Ghosts workflow, keeps folder-backed sources refreshed during normal syncs, and sharpens the manual so crews can tell sources, targets, and haunted berths apart at a glance.

## ✨ New Cargo
- **Folder-backed manifest sources**: `skill-harbor dock <source>` can now treat a local folder such as `~/.rulesync/skills` as a first-class source, discover nested child skills, and keep them tracked as generated children during syncs.
- **Drift-resistant refresh flow**: `skill-harbor up` rescans docked folder sources, while `skill-harbor freshen` forces a refresh even when Harbor would otherwise reuse cached state.
- **Source vs target guidance**: Added dedicated docs explaining that a path like `~/.rulesync/skills` can be either a **source** (where skills come from) or a **target** (where Harbor berths generated skills), plus guidance on when to use folder-backed sources vs `fathom --ghosts`.
- **Standalone Ghosts workflow**: Added `skill-harbor ghosts` as the primary explicit ghost-inspection command, with support for friendly ghosts that are summarized by default and expanded with `--friendly`.

## 🛠️ Barnacle Scraping
- **Clearer dock semantics**: `dock <url>` became `dock <source>`, `--local` became `--override`, and the project-personal manifest was renamed to `.harbor/harbor-manifest.overrides.json` with migration support from the legacy `.local` name.
- **Safer folder-source reconciliation**: Folder-source sync keeps the folder as the authoritative manifest object, records generated child-skill provenance, skips/warns on collisions, and avoids mutating RuleSync config or auto-deleting manual entries in v1.
- **Manual app alignment**: The generated manual now includes a dedicated foundations page and navigation links that explain sources, targets, folder-backed sources, ghost docking, and RuleSync-backed team workflows.
- **Shared ghost discovery logic**: Fathom now reuses the same underlying ghost-discovery path as the new Ghosts workflow, so ghost inspection stays consistent while Fathom remains the ghost-aware analysis surface.
- **Safer friendly ghosts**: Friendly ghosts are stored outside the manifest and remain non-destructive in v1, so marking a ghost as friendly does not dock it, mutate its berth, or silently erase it from every workflow.
- **Quartermaster as a Harbor skill**: Added a shared `.harbor/skills/quartermaster` skill and wired it into the project manifest so contributors can use Quartermaster through Harbor instead of only through `bun run quartermaster`.
