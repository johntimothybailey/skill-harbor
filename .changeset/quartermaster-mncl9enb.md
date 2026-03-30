---
"skill-harbor": minor
---

<!-- hero: Sonar Intelligence: Probabilistic Auditing -->

Captain's Briefing: Skill Harbor has commissioned the **Sonar Intelligence Engine**, a dual-layer "Confidence" auditor for your agentic fleet. Fathom now scans deeper than ever—moving beyond simple token displacement to measure real-world reliability. Use **Confidence (Heuristic)** for an instant, offline look at your prompt's "wake," or deploy **Confidence (Sonar)** to probe the actual LLM (OpenAI, Groq, Gemini) for the exact mathematical probability (logprobs) of a skill triggering. Stop guessing your way through the fog; start fathoming with probabilistic certainty.

## ✨ New Cargo (Key Features)
* **Confidence (Heuristic)**: Implemented a proprietary scoring algorithm (1-10) that evaluates semantic vagueness, trigger clarity, and collision risk across your entire fleet.
* **Confidence (Sonar)**: Introduced a high-fidelity audit layer that extracts mathematical trigger likelihood (logprobs) from real model responses (OpenAI/Ollama) using a specific user query.
* **Sonar Configuration Layer**: Added `profiler.yaml` and `.env` support for flexible routing between LLM providers and secure API management.
* **Health Reporting**: Enhanced harbor-wide reports now include cumulative context bloat, token consumption, and fleet-wide confidence averages.
* **CI/CD Governance**: Integrated `--max-tokens`, `--max-bloat`, `--min-score`, and `--format json` for automated PR gating and fleet quality enforcement.
* **Maritime UI**: Refined nautical-themed reporting with interactive confidence bars and detailed heuristic breakdowns.
