---
"skill-harbor": minor
---

<!-- hero: The Harmonious Horizon -->

# Captain's Briefing
Captain's Briefing: The Skill Harbor's fleet is expanding! We've commissioned three new powerhouse vessels—**Windsurf**, **Continue.dev**, and **GitHub Copilot**—into our multi-platform support fleet, ensuring your standardized skills can berth seamlessly across even more of the AI ocean. To help you navigate these new waters, we've installed an **Intelligent Target Selection** system. Stop guessing which berths are active in the fog; our new interactive CLI will auto-detect your agents or guide you through a precision selection, ensuring your cargo always finds its destination with zero config required.
## ✨ New Cargo
* **Expanded Fleet Support**: Skill Harbor now provides first-class docking for **Windsurf**, **Continue.dev**, and **GitHub Copilot**, alongside existing support for **Claude Code**, **Cursor**, **Gemini**, and **Antigravity**.
* Introduced the `--target` flag for **Targeted Sync**, allowing you to berth skills to a specific agent without affecting others.
* Added the **list** command to display all skills currently tracked in the harbor.
## 🛡️ Hardened Hull
* Improved **Success Path** with a 4-step guide to standardize your agent rules in under 60 seconds.
* **Interactive Target Selection**: Introduced a premium CLI selection menu that auto-detects active berths or guides you through selecting targets on the fly when no configuration is found.
## 🛠️ Barnacle Scraping
* Fixed the `README.md` to update the Distribution section with the correct IDE configuration folders, including `.gemini/skills` and `.gemini/antigravity/skills`.
* Updated dependencies, including `prompts` and `@types/prompts`, to ensure compatibility and security.
* Mocked `getManagedAgentTargets` in `stow.test.ts` to return a list of managed agent targets, including Claude, Cursor, Antigravity, and Codex, with an option to include Rulesync.

