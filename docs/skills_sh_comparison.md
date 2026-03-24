# Why Not Skills.sh?

This document provides a detailed breakdown of the differences between **Skill Harbor**, Vercel's **skills.sh**, and the low-level **skill.fish** utility. It clarifies why you would choose one over the other, and specifically why Skill Harbor does *not* use `skills.sh` under the hood.

---

## Why use Skills.sh vs Skill Harbor

While both tools deal with "Agent Skills," their core purposes, target audiences, and architectural philosophies are fundamentally different. 

**Think of the difference as `npm` (Package Manager) vs. `Docker Compose` (Environment Orchestrator).**

### 📦 When to use Skills.sh (The Package Manager)
**`skills.sh`** (built by Vercel Labs) is a massive, centralized registry and CLI designed for discovering and installing community skills.

*   **Core Purpose**: Fast discovery and installation of one-off skills.
*   **How it works**: You run `npx skills add <skill-name>`, and it searches its online directory, downloads the skill, and drops the raw files directly into your local IDE folder (like `.claude` or `.cursor`).
*   **Best for**: Individual developers looking to enhance their personal workflow. If your goal is simply: *"I need a React skill I saw on a leaderboard, and I want it in my Claude agent right now,"* then `skills.sh` is the absolute best tool for the job.

### ⚓ When to use Skill Harbor (The Orchestrator)
**`Skill Harbor`** was built to solve the **Enterprise & Team Synchronization Problem**. It governs the entire lifecycle of an AI agent's context across a shared repository.

*   **Core Purpose**: Enforcing strict consistency and governance across an entire engineering team, regardless of which AI agent each developer prefers.
*   **How it works**: A repository maintains a declarative `harbor-manifest.json`. Developers run a single `skill-harbor up` command. Harbor then fetches the exact skills defined in the manifest, cross-compiles them for the developer's specific agent (Claude, Cursor, Gemini), safely stows away any conflicting personal skills, and automatically generates a "Lighthouse" system prompt to teach the agent how to use its new capabilities.
*   **Best for**: Team workspaces. If your goal is: *"I need all 50 engineers on my team to share the exact same custom AI coding standards, strictly locked down, and cross-compiled for 4 different IDEs without manual configuration,"* then you need Skill Harbor.

---

## Why we didn't use Skills.sh inside of Skill Harbor

Given that `skills.sh` fetches files, it might seem logical for Skill Harbor to simply wrap `skills.sh` under the hood to handle downloading. However, doing so would completely break the enterprise architecture Skill Harbor provides.

Instead, Skill Harbor relies on low-level utilities like **`skill.fish`** (for fetching) and **`skill-porter`** (for transpiling). Here is the detailed engineering breakdown of why we rejected `skills.sh` as an internal dependency:

### 1. The "Monolithic" Delivery Problem
Skill Harbor's architecture requires strict separation of concerns into three phases: **Moor** (Fetch) ➔ **Process** (Transpile) ➔ **Berth** (Distribute).

`skills.sh` is highly monolithic. When executed, it automatically drops the downloaded files *directly into your agent directories natively* (e.g., dropping them straight into `.claude/skills`). Because it forcefully handles the final delivery, it prevents Skill Harbor from intercepting the files. 

By contrast, `skill.fish` is a *pure fetcher*. It downloads raw repository files into a temporary staging area and intentionally stops there, handing the baton back to Harbor.

### 2. Loss of Cross-Platform Transpilation
Because `skills.sh` natively installs the files, it entirely bypasses our **Process** phase (powered by `skill-porter`). Skill Harbor relies on this processing phase to translate skill formats between different AI agents. For example, fixing Markdown vs. XML structural differences between Claude Code and Google's Antigravity agent. If `skills.sh` places the files itself, we lose the ability to guarantee cross-platform compatibility.

### 3. Bypassing Strict Workspace Governance
Skill Harbor treats agent context as ephemeral and highly sensitive. Our `--lockdown` and `stow`/`unstow` engine guarantees that a developer's global, personal skills do not bleed into isolated client repositories. Because `skills.sh` writes directly to the local machine's configuration folders, it circumvents our sandboxing and governance layers completely.

### 4. Blinding the Lighthouse Intelligence Engine
One of Skill Harbor's most powerful features is the **Master Fleet Manifest**. Every time Harbor orchestrates a sync, it analyzes all the incoming skills and generates a dynamic `000-fleet-intelligence.md` file—a "Zero-Tier" map that acts as a system prompt, teaching your AI agent exactly what capabilities it has and how to trigger them.

If `skills.sh` handles the fetching and installation independently, Skill Harbor cannot accurately intercept, read, and synthesize the metadata from those skills, effectively "blinding" the Lighthouse engine.

### Summary Verdict
`skills.sh` is an incredible tool for individual discovery and package management. However, its monolithic approach to fetching and immediately installing makes it incompatible as an underlying dependency for Skill Harbor, which must remain the sovereign "General Contractor" over the fetch, transpile, govern, and distribute lifecycle.
