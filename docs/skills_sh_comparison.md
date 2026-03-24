# ⚓ Skill Harbor vs. Vercel's skills.sh vs. skill.fish

This document breaks down the differences between three prominent tools in the AI Agent "Skill" ecosystem, detailing why each exists and why Skill Harbor chooses a specific architectural path for team-based workspaces.

---

## 🏗️ 1. The Overview

If we use classical software development analogies:
*   **`skills.sh`** is like **`npm`** — a centralized package registry and simple installer.
*   **`skill.fish`** is like **`curl`** or **`git clone`** — a low-level fetch utility.
*   **`Skill Harbor`** is like **`Docker Compose`** — an orchestration engine that governs the entire lifecycle of multiple resources across a team's workspace.

---

## 🐬 2. skill.fish (The Fetcher)
**`skill.fish`** is a very lightweight utility designed specifically to locate "skills" inside GitHub repositories and fetch their markdown files.
*   **Role**: *Moor* (Fetch)
*   **What it does**: You give it a GitHub repo (`bunx skillfish add owner/repo`), and it pulls the raw files down to your local machine.

## 📦 3. skills.sh (The Package Manager)
**`skills.sh`** (by Vercel Labs) is a massive, centralized registry and CLI for discovering and installing agent skills.
*   **Role**: *Package Manager* (Fetch & Install)
*   **What it does**: You run `npx skills add <skill-name>`, and it searches its registry, downloads the skill, and drops the raw files directly into your local `.claude` or `.cursor` folder.
*   **Best for**: Individual developers who want to discover popular community skills (like "React Best Practices" or "Next.js UI components") and quickly throw them into their personal IDE configuration.

## ⚓ 4. Skill Harbor (The Orchestrator)
**`Skill Harbor`** was built to solve the **Enterprise/Team Synchronization Problem**. When 50 engineers are working on the same repo, they absolutely must share the exact same AI context rules, regardless of whether they prefer Claude Code, Cursor, or Gemini (Antigravity).
*   **Role**: *Workspace Team Orchestrator* (Fetch ➔ Transpile ➔ Govern ➔ Distribute)
*   **How it works**: A repo maintains a `harbor-manifest.json`. Developers run `skill-harbor up`. Harbor fetches the raw files, cross-compiles them for the developer's specific agent, governs the environment (stowing/removing old skills), and routes them automatically to the correct hidden configuration folders.

---

## ⚖️ Why Skill Harbor uses `skill.fish` instead of `skills.sh`

It might seem logical to use Vercel's shiny new `skills.sh` under the hood. However, doing so breaks the fundamental orchestration lifecycle that enterprise teams require. 

Skill Harbor's architecture requires three distinct phases:
1.  **Moor** (Fetch)
2.  **Process** (Transpile)
3.  **Berth** (Distribute)

### The Problem with `skills.sh` for Orchestration
`skills.sh` is monolithic. When executed, it automatically drops the downloaded files *directly into your agent directories natively* (e.g., dropping them straight into `.claude/skills`).

By doing this, it bypasses the most critical parts of the Skill Harbor pipeline:
*   **Bypassing Transpilation**: Natively dropped skills miss the **Process** phase (powered by `skill-porter`), where skills are translated to work across different agents (e.g., fixing Markdown vs XML structural differences between Claude and Gemini).
*   **Bypassing Governance**: It ignores Skill Harbor's `stow` and `--lockdown` governance systems, which safely sandboxes and protects developers' global personal skills from bleeding into isolated client projects.
*   **Blinding the Lighthouse**: Because `skills.sh` installs the files itself, Harbor cannot intercept and synthesize the skill metadata. This prevents Harbor from automatically generating the `000-fleet-intelligence.md` Master Manifest—the critical "Zero-Tier" map that tells your AI agent *how to use* the skills it was just given.

### The `skill.fish` Advantage
`skill.fish` serves perfectly as a *pure fetcher*. 

It cleanly downloads the raw repository files (Moor) into a temporary staging area and **intentionally stops there**. This allows Skill Harbor to act as the "General Contractor," governing the rest of the lifecycle: analyzing the files, processing them for cross-platform compatibility, extracting intelligence for the Lighthouse prompt, and handling the final safely-governed distribution (Berth).

---

## 🏗️ 5. The Pros: Why we might consider adapting in the future
While `skills.sh` doesn't fit our current architecture, it has undeniable strengths that we are watching closely:
*   **Massive Community Backing**: Backed by Vercel Labs, the `skills.sh` registry is likely to become the de-facto discovery standard.
*   **Dependency Locking**: Its native `skills-lock.json` implementation is excellent for workspace reproducibility.

## 🛳️ 6. The Verdict for v0.5.0
For the "Lighthouse" release, we are sticking firmly with **skill.fish**. 

It allows Skill Harbor to remain the sovereign orchestrator of the workspace. By using a pure fetcher, we ensure that every skill—regardless of its source—is subjected to our governance, our transpilation, and our intelligence discovery engines.

**Looking Ahead**: If `skills.sh` eventually releases a clean "download-only" flag that prevents auto-installation, it would become a very compelling alternative to `skill.fish` for the "Moor" phase of our lifecycle.
