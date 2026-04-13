---
"skill-harbor": minor
---

<!-- hero: Charting Clearer Waters -->

Captain's Briefing: The harbor's charts are sharper and the rigging is tighter. This release adds stronger Voyager tooling, manual clarifications for a similiar project, and explanations for product boundaries.
## ✨ New Cargo 
- **Voyager Comparison Mode**: Added `skill-harbor voyager --compare` to assess skill impact on agent performance, now found in `apps/cli/src/index.ts` and `apps/cli/src/commands/voyager.ts`. 
- **Structured Voyager Results**: Introduced result models in `apps/cli/src/types/voyager.ts` for better comparison and analysis. 
- **Dedicated Manual Documentation App**: Launched `apps/manual`, a Next.js site for our manual, enhancing navigation, search, and documentation structure. 
## 🛡️ Hardened Hull 
- **Monorepo Verification**: Updated `turbo.json` to include the `test` task, ensuring `bun run test` covers the entire workspace. 
- **CI/CD Enhancements**: Adjusted GitHub Actions for monorepo support and dedicated manual deployment. 
## 🛠️ Barnacle Scraping 
- **Refactored Voyager Command**: Broken down `apps/cli/src/commands/voyager.ts` into smaller helpers for easier maintenance and future additions. 
- **Improved Cache Handling**: Enhanced manifest and cache handling in `apps/cli/src/manifest.ts` to prevent global and project cache mix-ups. 
- **Version Alignment**: Ensured `skill-harbor --version` reflects the package version in `apps/cli/package.json`, now covered by integration tests.
