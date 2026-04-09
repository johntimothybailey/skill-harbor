---
"skill-harbor": patch
---

<!-- hero: The Chart Room Corrected -->

The docs deployment route was steering Vercel into the wrong berth. This patch corrects the GitHub Actions workflow so the documentation build uses the project's configured root directory instead of doubling the `apps/manual` path, and it renames the deployment task to better reflect its real purpose.

## 🛠️ Barnacle Scraping

- Fixed `.github/workflows/deploy-docs.yml` by removing the extra `working-directory` overrides from the Vercel pull/build/deploy steps so the workflow no longer resolves `apps/manual/apps/manual/package.json`.
- Renamed the workflow job from `Deploy-Production` to `Deploy Documentation` for clearer GitHub Actions status output.
