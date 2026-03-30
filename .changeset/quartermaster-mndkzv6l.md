---
"skill-harbor": minor
---

<!-- hero: Ghost Fleet Discovery -->

# Captain's Briefing
The Skill Harbor has received significant upgrades, allowing for the discovery of ghost skills in agent berths and providing a comprehensive fleet status report.

## ✨ New Cargo (Key Features)

*   **👻 Ghost Visibility**: Added a `-u, --ghosts` flag to `fathom` that identifies skills present in your agent folders (or stowage) that aren't registered in the harbor manifest.
*   **📡 Agent-Specific Status**: Every skill profiled now explicitly labels where it is active (`[Berthed: Claude, Cursor]`) or suspended (`[Stowed: Antigravity]`).
*   **📊 Fleet Summary**: The `fathom --report` summary now includes a **Fleet Status Distribution** section, giving you a high-level view of active, stowed, and dry-docked skills.
*   **🚜 Dry Dock Tracking**: Skills moored in the harbor but not yet berthed or stowed are now explicitly tracked and reported as being in **"Dry Dock"**.

## 🛡️ Technical Fixes

*   **🛠️ Refactored Core**: Centralized agent path discovery into a reusable utility, ensuring consistency between the `check` and `fathom` commands.
*   **🚀 Enhanced Orchestration**: Improved `fathomAction` for better ghost discovery and vessel status determination.
