<p align="center">
  <img src="assets/header.png" alt="Skill Harbor Header" width="100%">
</p>

<h1 align="center">⚓ Skill Harbor</h1>

<p align="center">
  <strong>A lightweight CLI for adding and updating skills across Agentic Editors</strong>
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

## 🛠️ The Tech Stack

Skill Harbor leverages powerful tools from the agent ecosystem:

- 🐬 **[skillfish](https://www.skill.fish)**: For high-efficiency skill discovery and manifest management.
- 📦 **[skill-porter](https://mcpmarket.com/tools/skills/skill-porter-cross-platform-ai-converter)**: Used as the transpilation engine to format skills perfectly for different AI agents.

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
- 🏗️ **Cross-Platform Transpilation**: Powered by `skill-porter` to convert Claude Code skills to Cursor rules seamlessly.
- ⚡ **Zero Friction**: Keeps skills as highly effective raw markdown (injected instantly into the agent's brain), without the overhead of MCP servers.
- 🔌 **Idempotent**: Run `skill-harbor up` repeatedly to pull down the latest transpiled skill updates safely.

## ⚖️ Alternatives

For developers and organizations looking for a more **robust, enterprise-grade toolset** or specialized porting capabilities, we highly recommend checking out:

- 🚀 **[agent-skill-porter](https://www.npmjs.com/package/agent-skill-porter)**: A powerful, zero-config lifecycle management CLI for AI agent skills.
- 👉 **[uberskills.dev](https://uberskills.dev/)**

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

<p align="center">
  Built with ❤️ for the AI Agent Ecosystem
</p>
