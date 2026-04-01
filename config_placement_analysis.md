# Config File Placement: `.harbor/` vs Project Root

## The Question

Where should `harbor-compass.yaml` and `harbor-manifest.json` live when consumed by other projects? What are the trade-offs for monorepos?

---

## Industry Landscape

### Traditional Dev Tools — Two Dominant Patterns

| Pattern | Examples | Characteristics |
|---|---|---|
| **Root-level files** | `tsconfig.json`, `package.json`, `.prettierrc`, `docker-compose.yml` | Maximum discoverability; CI/CD tools expect them here; no directory to create |
| **Dotfolder** | `.github/`, `.changeset/`, `.husky/`, `.vscode/` | Groups related files (config + assets + hooks); keeps root clean; signals "tooling infrastructure" |

**Key insight:** Tools that are *file-only* (single config) tend to live at root. Tools that are a *file + directory of assets* gravitate toward a dotfolder.

### AI Agent Tooling — The Dotfolder Standard

Every major AI coding tool uses a project-level dotfolder:

| Tool | Config Location | Committed? |
|---|---|---|
| Claude Code | `.claude/` (settings, skills, `CLAUDE.md`) | ✅ Yes |
| Cursor | `.cursor/rules/` | ✅ Yes |
| GitHub Copilot | `.github/copilot-instructions.md` | ✅ Yes |
| Windsurf | `.windsurf/rules/` | ✅ Yes |

This is the ecosystem Skill Harbor operates in. Users already expect a dotfolder pattern for agent-related tooling.

### Monorepo Tools — Root + Per-Package Override

| Tool | Root Config | Per-Package Override |
|---|---|---|
| Turborepo | `turbo.json` (root) | `turbo.json` per package (extends root) |
| Nx | `nx.json` (root) | `project.json` per package |
| Changesets | `.changeset/config.json` (root) | N/A (tracks all packages from root) |
| TypeScript | `tsconfig.json` (root) | `tsconfig.json` per package (extends base) |

**Pattern:** A single root-level config defines defaults. Packages can extend/override. The config always lives in the *same relative location* regardless of level.

---

## Applying This to Skill Harbor

Skill Harbor has **two distinct file types** with different sharing semantics:

| File | Purpose | Shared? | Has companion assets? |
|---|---|---|---|
| `harbor-manifest.json` | Declarative skill list (team state) | ✅ Committed | Skills cache (`.harbor/*`) |
| `harbor-compass.yaml` | Execution preferences (engines, hooks) | ⚙️ Optional | Hooks directory |

### Three Options

#### Option A: Everything at Root
```
project/
├── harbor-manifest.json    ← committed
├── harbor-compass.yaml     ← optionally committed
├── .harbor/                ← gitignored skills cache
│   ├── hooks/              ← 🤔 hooks separate from their config
│   └── <cached-skills>/
```

**Pros:** Maximum discoverability; follows `package.json` / `tsconfig.json` convention.
**Cons:** Hooks/scripts directory has no obvious parent; two harbor files at root adds clutter; `.harbor/` becomes an ambiguous mix of cache + user-authored hooks.

#### Option B: Everything in `.harbor/`
```
project/
├── .harbor/
│   ├── harbor-manifest.json  ← committed
│   ├── harbor-compass.yaml   ← optionally committed
│   ├── hooks/                ← co-located with compass config
│   └── <cached-skills>/     ← gitignored
```

**Pros:** Clean root; all Harbor concerns in one place; follows `.github/`, `.claude/`, `.cursor/` convention; hooks live next to their config; familiar to the AI-tooling audience.
**Cons:** Manifest is less discoverable; need selective `.gitignore` patterns (ignore cache, commit config); slight learning curve ("where's the manifest?").

#### Option C: Hybrid (Current State)
```
project/
├── harbor-manifest.json    ← committed (at root)
├── harbor-compass.yaml     ← optionally committed (at root)
├── .harbor/
│   ├── hooks/              ← user-authored
│   └── <cached-skills>/    ← gitignored
```

**Pros:** Manifest is prominent and discoverable; compass pairs with it; `.harbor/` is purely runtime.
**Cons:** Hooks are physically separated from compass config that references them; `.harbor/` mixes user-authored content (hooks) with generated cache.

---

## Recommendation

> [!IMPORTANT]
> **Option B (everything in `.harbor/`) is the strongest choice** for consuming projects, with one refinement: separate the cache from authored content.

### Rationale

1. **Audience alignment** — Skill Harbor users already work with `.claude/`, `.cursor/`, `.github/`. A `.harbor/` dotfolder is immediately intuitive.
2. **Co-location** — Compass config and the hooks it references live in the same tree. No split-brain between root config and dotfolder assets.
3. **Monorepo support** — Each workspace gets its own `.harbor/` directory. The root can also have a `.harbor/` with base configs. This mirrors `turbo.json` / `project.json` inheritance perfectly.
4. **Clean gitignore** — Instead of ignoring all of `.harbor/`, use a targeted pattern:

### Proposed `.harbor/` Layout for Consuming Projects

```
project/
├── .harbor/
│   ├── harbor-manifest.json   ← ✅ committed (team state)
│   ├── harbor-compass.yaml    ← ✅ committed (team preferences)
│   ├── hooks/                 ← ✅ committed (custom logic)
│   │   └── strict-validator.ts
│   └── skills/                ← 🚫 gitignored (downloaded cache)
│       ├── some-skill/
│       └── another-skill/
```

**`.gitignore` for consuming projects:**
```gitignore
# Skill Harbor — ignore cached/downloaded skills only
.harbor/skills/
```

### Monorepo Layout

```
monorepo/
├── .harbor/                        ← root-level defaults
│   ├── harbor-manifest.json        ← base manifest
│   ├── harbor-compass.yaml         ← base engine config
│   └── skills/                     ← gitignored
├── packages/
│   ├── frontend/
│   │   └── .harbor/                ← extends/overrides root
│   │       ├── harbor-manifest.json
│   │       └── skills/             ← gitignored
│   └── backend/
│       └── .harbor/
│           ├── harbor-manifest.json
│           ├── harbor-compass.yaml ← backend-specific hooks
│           ├── hooks/
│           └── skills/             ← gitignored
```

---

## Migration Impact on This Repo

> [!WARNING]
> Moving `harbor-manifest.json` from root into `.harbor/` is a **breaking change** for anyone using Skill Harbor today. The `ManifestManager` currently defaults to `path.join(cwd, "harbor-manifest.json")`.

This would need:
1. Update `ManifestManager` to look in `.harbor/harbor-manifest.json` by default (with fallback to root for backwards compat)
2. Update README and all documentation references
3. Consider a migration path / deprecation warning for root-level manifests

This is a larger effort. For now, the immediate question is just about compass placement.

## Open Questions

1. **Do you want to move the manifest into `.harbor/` too** (Option B fully), or keep manifest at root and only move compass into `.harbor/` (a variant of Option C)?
2. **Should the skills cache directory be renamed** from the implicit `.harbor/*` to an explicit `.harbor/skills/` to cleanly separate cache from config?
3. **Is monorepo inheritance (child extends parent `.harbor/`)** something you want to support near-term, or is that a future consideration?
