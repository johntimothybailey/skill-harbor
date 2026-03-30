---
"skill-harbor": minor
---

<!-- hero: Sonar Intelligence: Probabilistic Auditing -->

Captain's Briefing: Skill Harbor has deployed the **Sonar Intelligence Engine**, a two-fold Confidence auditing system for agentic skills. Move beyond raw token counts with **Confidence (Heuristic)** for instant local analysis and **Confidence (Sonar)** for high-fidelity, probabilistic model verification via logprobs in the actual model provided. With Sonar, it's not guessing; it's testing.

## ✨ New Cargo (Key Features)
* **Confidence (Heuristic)**: Implemented a proprietary scoring algorithm (1-10) that evaluates semantic vagueness, trigger clarity, and collision risk across your entire fleet.
* **Confidence (Sonar)**: Introduced a high-fidelity audit layer that extracts mathematical trigger likelihood (logprobs) from real model responses (OpenAI/Ollama) using a specific user query.
* **Sonar Configuration Layer**: Added `profiler.yaml` and `.env` support for flexible routing between LLM providers and secure API management.
* **Health Reporting**: Enhanced harbor-wide reports now include cumulative context bloat, token consumption, and fleet-wide confidence averages.
* **CI/CD Governance**: Integrated `--max-tokens`, `--max-bloat`, `--min-score`, and `--format json` for automated PR gating and fleet quality enforcement.
* **Maritime UI**: Refined nautical-themed reporting with interactive confidence bars and detailed heuristic breakdowns.
