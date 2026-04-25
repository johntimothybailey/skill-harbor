---
"skill-harbor": minor
---

<!-- hero: Benchmark the Voyage, Chart the Contracts -->

Captain's Briefing: Voyager can now sail deterministic benchmark packs for local and CI evaluation, while Harbor health checks can read and report native skill contracts. This pass also calms `up` output when stale manifest cargo is found.

## ✨ New Cargo
- `skill-harbor voyager --file` can now run Harbor-native benchmark pack YAML files, letting teams compare with-skills and without-skills outcomes from deterministic offline fixtures.
- Voyager benchmark packs now support branch assertions, delta assertions, JSON summaries, and saved artifacts so CI jobs can prove whether a skill fleet actually improves an agent workflow.
- New benchmarking and contract-validation docs explain how to write benchmark packs, when to use Voyager versus Fathom, and how to declare `Requires` / `Produces` contracts for chainable skills.

## 🛡️ Hardened Hull
- Added a native contract parser for skill frontmatter and markdown sections, including field validation and producer/consumer compatibility warnings.
- Wired contract validation into `ProfilerService` so Fathom health reports can include contract status alongside token and confidence heuristics.
- Upgraded `skill-harbor check --strict` to fail on invalid, missing, or warning-bearing contracts while normal checks still show contract status in the health output.

## 🔧 Repaired Ships
- `skill-harbor fathom` now shows contract health by default, and `--contracts` surfaces concrete contract errors and warnings instead of only noting missing chaining metadata.
- `skill-harbor up` now rejects invalid remote source strings before invoking Skillfish and gives missing local sources a clear stale-manifest message.
- `skill-harbor up` now keeps relative local source entries intact, avoids shell-joined Git hash checks, and stops raw progress output from replaying old spinner lines on every update.

## 🛠️ Barnacle Scraping
- Expanded regression coverage for `check`, `fathom`, `voyager`, `up`, manifest source resolution, local mooring errors, and deduped progress output.
- Cleaned the workspace harbor manifest by removing the stale `test-skill` entry and keeping `quartermaster` docked from its relative project source.
- Updated the project ignore rules to match the current overrides manifest location.
