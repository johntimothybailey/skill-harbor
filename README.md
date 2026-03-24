<p align="center">
  <img src="assets/header.png" alt="Skill Harbor Header" width="100%">
</p>

<h1 align="center">⚓ Skill Harbor</h1>

<p align="center">
  <strong>The Workspace Sync Engine for AI Agents — Standardize skills and context across your entire team.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/skill-harbor"><img src="https://img.shields.io/npm/v/skill-harbor.svg?style=flat-square" alt="NPM Version"></a>
  <a href="https://github.com/johntimothybailey/skill-harbor/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License"></a>
  <a href="https://github.com/johntimothybailey/skill-harbor"><img src="https://img.shields.io/github/stars/johntimothybailey/skill-harbor.svg?style=flat-square&color=gold" alt="GitHub Stars"></a>
</p>

---

## 🌊 Overview

**Skill Harbor** is a lightweight "Package Manager for Agent Context"—a powerful **Workspace Sync Engine** built for AI agent developers.

Instead of installing skills globally on a single machine or forcing developers to configure MCP servers, Skill Harbor manages a project-level `harbor-manifest.json`. When a developer clones your repo, they simply run `skill-harbor up`, and your specifically chosen skills are instantly fetched, transpiled, and injected natively into their local agent's configuration folders.

**It solves the massive problem of standardizing AI context across enterprise teams.**

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

Install globally or as a project dependency using Bun:

```bash
bun add -g skill-harbor
```

### Basic Commands

Once installed, use `skill-harbor` to standardize your project's AI capabilities:

```bash
# Add a skill to the current project's manifest (like standardizing your team's React rules)
skill-harbor dock <skill-url-or-name>

# List all skills required by the current project workspace
skill-harbor list

# The Magic Command: Sync the workspace. 
# Fetches all manifested skills, transpiles them, and injects them seamlessly into .claude/skills and .cursor/rules.
skill-harbor up
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

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

<p align="center">
  Built with ❤️ for the AI Agent Ecosystem
</p>
