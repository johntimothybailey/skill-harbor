---
"skill-harbor": minor
---

## ✨ Key Features
- **Universal Portability**: Switched to a compiled JS distribution () to resolve .
- **Smart Differential Sync**: Optimized syncloop to skip redundant  operations if the source hash is unchanged.
- **Target Array Support**: Optional  array in  for explicit agent berthing control.
- **Lighthouse Automated Manifest**: Added automated generation of  for zero-tier agent discovery.
- **Changesets Integration**: Automated versioning and NPM publishing via GitHub Actions.

## 🔮 New Skill: Scryer
- Introduced the **Scryer** skill for 'seeing' hidden portability issues (Bun-isms, hardcoded paths) and navigating the harbor.

## 🛡️ CI/CD Enhancements
- Added **Clean Room Smoke Tests** on a Node matrix (20, 22, 24) without Bun installed.

## 🛠️ Technical Fixes
- Hardened frontmatter regex to support multiple line endings and bracketed triggers.
- Fixed stale manifest state-sync bug in the syncloop.
- Corrected  command invocation logic.

Ready for final review and release. ⚓🛳️
