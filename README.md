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

**Skill Harbor** is a lightweight command-line interface (CLI) built for AI agent developers. It provides a simple, unified way to **add**, **update**, and **manage** skills across various Agentic Editors and environments. 

Think of it as a specialized port for your AI capabilities: ensuring that every "skill container" is properly docked, registered, and ready for deployment.

## 🛠️ The Tech Stack

Skill Harbor leverages powerful tools from the agent ecosystem to provide its functionality:

- 🐬 **[skillfish](https://www.skill.fish)**: For high-efficiency skill discovery and manifest management.
- 📦 **[skill-porter](https://mcpmarket.com/tools/skills/skill-porter-cross-platform-ai-converter)**: A cross-platform AI converter used for importing and exporting skills between formats.

## 🚀 Usage

### Installation

Install globally or as a project dependency using Bun:

```bash
bun add -g skill-harbor
```

### Basic Commands

Once installed, you can use the `skill-harbor` command to manage your local skill environment:

```bash
# Register a new skill from a local path or URL
skill-harbor dock <path-to-skill>

# Update an existing skill to its latest version
skill-harbor refresh <skill-name>

# List all available skills in the current harbor
skill-harbor list
```

## ✨ Features

- 🚢 **Lightweight CLI**: Fast, minimal, and focused on developers.
- 🏗️ **Cross-Platform**: Powered by `skill-porter` for broad tool compatibility.
- ⚡ **Bun Optimized**: Native support for Bun scripts and environments.
- 🔌 **Agentic-Ready**: Designed to integrate directly with modern agent-based editors.

## ⚖️ Alternatives

For developers and organizations looking for a more **robust, enterprise-grade toolset** with advanced automation and cloud synchronization, we highly recommend checking out:

👉 **[uberskills.dev](https://uberskills.dev/)**

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

<p align="center">
  Built with ❤️ for the AI Agent Ecosystem
</p>
