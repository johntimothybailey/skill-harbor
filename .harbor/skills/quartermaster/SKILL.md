---
name: quartermaster
description: Draft Skill Harbor release notes and changesets from the current git diff using the nautical Quartermaster voice. Use when asked for a changeset, hero title, Captain's Briefing, or release notes for this repo.
triggers: [quartermaster, changeset, release notes, hero title, captain's briefing]
---

# Quartermaster ⚓

Quartermaster turns the current Git diff into a Skill Harbor-style changeset draft with a nautical voice.

## Purpose
Use this skill when you need to:
- decide whether the release bump should be `minor` or `patch`
- draft a catchy **Hero Title**
- write a short **Captain's Briefing**
- produce release notes for `.changeset/*.md`
- review or correct an existing changeset draft so it matches the real branch contents

This skill is the skill-based replacement for the old `bun run quartermaster` workflow.

## Default Workflow
1. Review the current Git diff against the intended base branch.
   - Default to `main` unless the user specifies another base.
2. Classify the release:
   - `minor` for new features or significant behavior changes
   - `patch` for fixes, cleanup, docs, or narrow maintenance changes
3. Generate:
   - a **Hero Title**
   - a short **Captain's Briefing**
   - release notes in the Quartermaster format
4. If the user wants a changeset file, write:
   - `.changeset/<descriptive-name>.md`
5. Re-check the notes against the real diff before finalizing.

## Required Structure
Use this structure unless the user explicitly asks for a different shape:

- `Captain's Briefing` (1-2 short sentences)
- `## ✨ New Cargo`
- `## 🛡️ Hardened Hull`
- `## 🛠️ Barnacle Scraping`
- `## 🔧 Repaired Ships`
- `## 🔭 New Skill Discovery` only if relevant

Omit any section that has no real content.

Section intent:
- `## 🔧 Repaired Ships` is for **user-visible repairs**: fixes to CLI behavior, docs/manual behavior, distribution/packaging/install flows, or any other bug/repair a user would directly notice.
- `## 🛠️ Barnacle Scraping` is for **non-user-facing cleanup and maintenance**: refactors, migrations, naming cleanups, internal plumbing fixes, and other maintenance work that is not primarily a user-noticeable repair.

## Hard Rules
- Every bullet must reference a **specific file, command, function, module, behavior, or user-visible change**.
- Do **not** use vague filler like:
  - "various technical improvements"
  - "code improvements"
  - "general enhancements"
  - "better performance across different aspects"
- Do **not** repeat the same change in multiple sections.
- Keep the notes truthful to the current branch contents.
- If an existing draft includes unrelated changes, rewrite it rather than preserving bad content.

## Output Contract
When the user wants a full changeset, use this format:

```md
---
"skill-harbor": patch|minor
---

<!-- hero: Hero Title -->

Captain's Briefing: ...

## ✨ New Cargo
- ...

## 🛡️ Hardened Hull
- ...

## 🛠️ Barnacle Scraping
- ...

## 🔧 Repaired Ships
- ...
```

## Tone
- adventurous
- nautical
- lightly punny
- still concrete and professional

## Preferred Behavior
- If the user asks for a changeset, create the file directly instead of only proposing notes.
- If the user already has a Quartermaster-generated changeset, validate it against the actual diff and fix any hallucinated sections.
- If the change is mostly docs, cleanup, or bug fixes, prefer `patch` unless there is a clear new capability.

## When Not To Use
Do not use this skill for:
- version publishing itself
- changelog generation for unrelated packages
- non-release writing tasks that do not need a changeset or release-note style output
