<p align="center">
  <img src="assets/header.png" alt="Skill Harbor Header" width="100%">
</p>

<h1 align="center">⚓ Skill Harbor</h1>

<p align="center">
  <strong>The Declarative Workspace Orchestrator for AI Agents — Standardize skills and context across your entire team.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/skill-harbor"><img src="https://img.shields.io/npm/v/skill-harbor.svg?style=flat-square" alt="NPM Version"></a>
  <a href="https://github.com/johntimothybailey/skill-harbor/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License"></a>
  <a href="https://github.com/johntimothybailey/skill-harbor"><img src="https://img.shields.io/github/stars/johntimothybailey/skill-harbor.svg?style=flat-square&color=gold" alt="GitHub Stars"></a>
</p>

---

## 🌊 Overview

**Skill Harbor** is the **Declarative Workspace Orchestrator for AI Agents**. It is a powerful **Sync & Governance Engine** designed to standardize agent behavior, specialized skills, and project context across your entire team.

Instead of manual skill installation or fragile global configurations, Skill Harbor uses a declarative `harbor-manifest.json` to manage your team's "Collective Intelligence." With a single command (`skill-harbor up`), Harbor orchestrates the entire lifecycle: fetching raw repositories, transpiling them for specific platforms (Claude, Gemini, Cursor), enforcing security lockdowns, and injecting them natively into agent configuration berths.

**It is the infrastructure layer for professional AI agent workflows.**

## 🛠️ The Architecture: How It Works

Skill Harbor is designed as the **Commander** of your Workspace Sync Engine. Instead of reinventing the wheel, it acts as a high-level orchestrator that tightly integrates two incredibly powerful underlying tools from the agent ecosystem.

Here is exactly how the three tools relate to each other:

- ⚓ **Skill Harbor (The General Contractor)**: Coordinates the entire lifecycle via `skill-harbor up`. It manages the `harbor-manifest.json` and ensures the final cargo is successfully delivered.
- 🐬 **[skillfish](https://www.skill.fish) (⚓ Moor)**: When Harbor reads your manifest, it calls upon `skillfish` under the hood to locate the correct repository and download the raw markdown files into a temporary harbor.
- 📦 **[skill-porter](https://mcpmarket.com/tools/skills/skill-porter-cross-platform-ai-converter) (📦 Process)**: Harbor passes the downloaded files to `skill-porter` to handle complex transpilation. It "cuts the lumber" so it perfectly fits your local agent's strict prompt and rules expectations.
- 🛳️ **Distribution (🛳️ Berth)**: Once processed, Harbor "berths" the skills—routing them seamlessly into the correct (and often hidden) IDE configuration folders like `.claude/skills`, `.cursor/rules`, or `.antigravity/skills`.

> **In summary**: Skill Harbor holds the blueprints. It uses `skillfish` to deliver the raw lumber, and `skill-porter` to cut that lumber so it perfectly fits your local `.claude` or `.cursor` directories.

## 🚀 Usage

### Installation

Install Skill Harbor globally via your preferred package manager to use the `skill-harbor` command anywhere:

Install Skill Harbor globally via your preferred package manager to use the `skill-harbor` command anywhere:

```bash
# Using bun (Recommended)
bun add -g skill-harbor

# Using npm
npm install -g skill-harbor

# Using pnpm
pnpm add -g skill-harbor
```
## ⚓ The Harbor Command Suite

| Command | Why it exists | Typical Use Case |
| :--- | :--- | :--- |
| **`dock <url>`** | Registers a skill's source in the manifest. | You found a great repo of React hooks and want your whole team to have them. |
| **`up`** | The core engine. Syncs, transpiles, and berths skills. | Run after `git pull` or when you've just docked new skills. |
| **`up --lockdown`** | Enforces a strict, manifest-only environment. | Switching from a personal project to a client project with strict rules. |
| **`stow`** | Safely backs up current agent context without deleting. | You need a clean slate for a few hours but want your old skills back later. |
| **`unstow`** | Restores previously stowed context (The "Unlock"). | Re-enabling your personal global fleet after a lockdown session. |
| **`lighthouse`** | Generates a fleet intelligence prompt snippet. | Priming an agent like ChatGPT or Claude on what specialized skills you have berthed. |
| **`check`** | Verifies that berthed skills have valid metadata. | Debugging why an agent isn't "seeing" or routing to a specific berthed skill. |
| **`fathom`** | Heuristic profiler for skill operational footprint. | Evaluating if a skill is a "small boat" or a "massive cargo ship". |
| **`list`** | Shows all skills currently tracked in the harbor. | Seeing if you already have 'sia-hooks' docked before adding it again. |
| **`undock`** | Destructive purge of agent skill folders. | Deep cleaning or resetting an environment that has become cluttered. |

### 🔐 Governance & Lockdown
Enforce team-wide consistency by isolating your agent's context.

*   **Lockdown Mode**: Sync and stow. Moves current agent context to stowage before berthing manifest skills.
    ```bash
    skill-harbor up --lockdown
    ```
*   **Unstow (Unlock)**: Restore your original environment.
    ```bash
    skill-harbor unstow
    ```

### 💡 Lighthouse & Intelligence
Coordinate Skill Harbor with the agent's internal routing logic.

*   **Master Fleet Manifest**: Every time you run `up`, Skill Harbor automatically berths a `000-fleet-intelligence.md` file into your agent's folders. This acts as a "Zero-Tier" map that help agents discover your skills instantly.
*   **Lighthouse Snippet**: Generate a prompt to prime your agent.
    ```bash
    skill-harbor lighthouse
    ```

### 🌍 Global Fleet: Personal Skills, Everywhere
Managing skills shouldn't be limited to a single repo. Skill Harbor allows you to maintain a **Global Manifest** to synchronize your personal utilities across every project you touch.

*   **Sync Anywhere**: Run `skill-harbor up --global` in *any* directory to instantly berth your personal global skills into your local agent folders (Claude, Cursor, etc.).
*   **The `-g` Flag**: Use `--global` or `-g` with any command to target the user-level manifest at `~/.harbor/harbor-manifest.json`.
*   **Personal Governance**: Keep your project manifests clean while still having access to your custom keybindings, refactor rules, and personal documentation helpers.

```bash
# Register a personal skill globally
skill-harbor dock https://github.com/my-org/my-rules --global

# Sync your personal brain into the current project workspace
skill-harbor up --global
```

## ✨ Features

- 🚢 **Workspace Sync Engine**: Standardize AI context rules for your entire repo.
- 🏗️ **Multi-Agent Support**: Automatic distribution to **Claude Code**, **Cursor**, and **Antigravity**.
- ⚡ **Parallel Synchronization**: Sync your entire fleet of skills concurrently for maximum performance.
- 🏗️ **Cross-Platform Transpilation**: Powered by `skill-porter` to convert skill formats between Gemini and Claude seamlessly.
- 🔌 **Idempotent**: Run `skill-harbor up` safely to pull down the latest transpiled skill updates.

## ⚓ The Bottom Line: Why Skill Harbor?

If you are an engineer asking *"Why use Harbor when I can just use `sk` (agent-skill-porter), or skillfish, or Rulesync?"*, consider this:

1. **Orchestration vs. Utility**: Harbor is a **manager**, not just a tool. It coordinates the parallel execution of fetching (**Moor**), transpiling (**Process**), and distributing (**Berth**) across your entire workspace in a single idempotent command.
2. **Team Standardization (Declarative)**: Harbor uses a manifest (`harbor-manifest.json`). You commit it to Git once, and every developer on your team gets the exact same context. Without it, your team's rules become fragmented and "idiosyncratic" per developer machine.
3. **The Ecosystem Glue**: Harbor handles the "Hard Parts" of the lifecycle—unique process isolation, parallel synchronization, and automatic agent configuration discovery (e.g., hidden VS Code paths) that simple utilities expect you to handle yourself.

## ⚖️ Alternatives & Ecosystem Roles

Skill Harbor is designed to be the **Orchestrator**. It doesn't replace these tools; it coordinates them into a seamless team workflow.

### Feature Matrix

| Feature | [skillfish](https://www.skill.fish) | [Agent Skill Porter](https://github.com/skill-mill/agent-skill-porter) | [Rulesync](https://github.com/dyoshikawa/rulesync) | **⚓ Skill Harbor** |
| :--- | :---: | :---: | :---: | :---: |
| **⚓ Moor** (Remote Fetching) | ✅ | ❌ | ❌ | ✅ |
| **📦 Process** (Transpilation) | ❌ | ✅ | ⚠️ | ✅ |
| **🛳️ Berth** (Auto-Distribution) | ❌ | ❌ | ✅ | ✅ |
| **📄 Team Manifest** (`.json`) | ❌ | ❌ | ❌ | ✅ |
| **⚡ Parallel Syncing** | ❌ | ❌ | ❌ | ✅ |
| **🎯 Dynamic Target Detection** | ❌ | ❌ | ❌ | ✅ |
| **🏠 Global & Local Duality** | ❌ | ❌ | ❌ | ✅ |
| **Best For...** | Discovery | Power Users | Personal Config | **Team Workspaces** |

### When to use Skill Harbor?
Choose **Skill Harbor** if you are working on a team project. While individual utilities are great for one-off tasks, Skill Harbor provides the **governance** and **reproducibility** a professional codebase needs. It acts as the "npm" for your AI agents—one `up` command gives every developer the exact same "synced brain."

### When to use Agent Skill Porter?
Choose **[agent-skill-porter](https://github.com/skill-mill/agent-skill-porter)** directly if you are an individual power-user or a "skill developer" who needs granular control over lossless conversions (Chimera Hub workflow) without managing a project manifest.

### When to use Rulesync?
Choose **Rulesync** if you want a local, unified source of truth for your personal AI agent configurations across multiple tools. Harbor actually supports Rulesync as a **Berthing Target**—it can feed your processed team skills directly into your Rulesync setup.

### When to use uberskills.dev?

👉 **[uberskills.dev](https://uberskills.dev/)**: For large organizations that require centralized, cloud-synced context rules with enterprise-level security.

### When to use skills.sh? (And why Harbor uses `skill.fish` instead)

**[skills.sh](https://skills.sh/)** (by Vercel Labs) serves as a fantastic, centralized package manager (like "npm") for discovering and installing community agent skills. 

Choose `skills.sh` if your goal is: *"I am an individual developer who wants to find a popular React skill on a leaderboard and quickly throw it into my `.claude` folder."*

**Why does Skill Harbor use `skill.fish` under the hood instead of `skills.sh`?**
Skill Harbor acts as the "Docker Compose" of agent skills—it is a strict team orchestrator, not a simple installer. Our architecture requires three distinct phases: **Moor** (Fetch), **Process** (Transpile), and **Berth** (Distribute).

*   **The problem with `skills.sh` for Orchestration**: It is monolithic. It automatically drops files directly into your agent directories natively (e.g. `.claude` or `.cursor`). By doing this, it entirely bypasses our `skill-porter` transpilation engine (which allows skills to cross-compile between Gemini/Antigravity and Claude identically). It also bypasses our safe `stow` lockdown governance, and it prevents Harbor from accurately intercepting metadata for your dynamic `000-fleet-intelligence.md` Master Manifest.
*   **The `skill.fish` advantage**: `skill.fish` serves as a *pure fetcher*. It cleanly downloads the raw repository files (Moor) into a temporary harbor and intentionally stops there. This allows Skill Harbor to govern the rest of the lifecycle: processing the skills for the correct platform, enforcing `--lockdown` constraints, extracting intelligence for Lighthouse, and handling the final targeted berthing.

---


## 🤝 Contributing

We welcome contributions! To ensure a smooth release process, we use **[Changesets](https://github.com/changesets/changesets)** for automated versioning and changelog generation.

### The "Intent-Based" Workflow
Instead of reconstructioning releases from git diffs, we capture the **intent** of every change at the moment it is made.

1.  **Make your changes**.
2.  **Run `bun x changeset`** (Human) or ask your agent to create a changeset.
3.  **Choose the bump type** (patch, minor, major) and write a short, meaningful summary of what changed.
    - *Tip: You can use the `[e]dit` option in the Quartermaster CLI to refine the notes. To use a specific editor (like Cursor), set the `QUARTERMASTER_EDITOR` environment variable (via `export` or in your `.env.local` file):*
    ```bash
    export QUARTERMASTER_EDITOR="cursor --wait"
    ```
4.  **Commit the generated `.changeset/*.md` file** along with your code.

When your PR is merged to `main`, our GitHub Action will automatically:
- Create (or update) a "Version Packages" Pull Request.
- When that PR is merged, the new version will be built and published to NPM automatically.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

<p align="center">
  Built with ❤️ for the AI Agent Ecosystem
</p>
