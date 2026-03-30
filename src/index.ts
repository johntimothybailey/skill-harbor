#!/usr/bin/env node
import { Command } from "commander";
import { dockAction } from "./commands/dock";
import { upAction } from "./commands/up";
import { freshenAction } from "./commands/freshen";
import { checkAction } from "./commands/check";
import { listAction } from "./commands/list";
import { undockAction } from "./commands/undock";
import { stowAction } from "./commands/stow";
import { unstowAction } from "./commands/unstow";
import { lighthouseAction } from "./commands/lighthouse";
import { fathomAction } from "./commands/fathom";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, "../package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

const program = new Command();

program
    .name("skill-harbor")
    .description("⚓ Skill Harbor: The Declarative Workspace Orchestrator for AI Agents")
    .version(pkg.version);


program
    .command("dock <url>")
    .description("Register a skill's source in the manifest.")
    .option("-g, --global", "Register the skill in the global manifest (~/.harbor)")
    .option("-l, --local <path>", "Register a local project-specific skill from a file path")
    .action(dockAction);

program
    .command("up")
    .description("⚓ The Core Engine. Syncs, transpiles, and berths skills.")
    .option("-g, --global", "Include global manifest skills in the sync")
    .option("-l, --lockdown", "Enforces a strict, manifest-only environment. Stows existing rules first.")
    .action(upAction);

program
    .command("freshen")
    .description("Force-syncs fresh cargo by bypassing all local hashes and cache.")
    .option("-g, --global", "Freshen global manifest skills as well")
    .action(freshenAction);

program
    .command("check")
    .description("Verifies that berthed skills have valid metadata and integrity.")
    .option("-g, --global", "Check global manifest skills")
    .action(checkAction);

program
    .command("list")
    .description("Shows all skills currently tracked in the harbor.")
    .option("-g, --global", "List global manifest skills")
    .action(listAction);

program
    .command("undock")
    .description("Destructive purge of agent skill folders.")
    .option("-g, --global", "Undock global manifest skills")
    .action(undockAction);

program
    .command("stow")
    .description("Safely backs up current agent context without deleting.")
    .action(stowAction);

program
    .command("unstow")
    .description("Restores previously stowed context (The 'Unlock').")
    .action(unstowAction);

program
    .command("lighthouse")
    .description("Generates a fleet intelligence prompt snippet.")
    .option("-g, --global", "Include global manifest skills in the master manifest")
    .action(lighthouseAction);

program
    .command("fathom")
    .description("Fleet-scale profiler for context bloat & API costs.")
    .option("-d, --details", "Show granular heuristic analysis for each skill.")
    .option("-r, --report", "Generate a harbor-wide health report.")
    .option("-f, --format <type>", "Output format ('pretty' | 'json'). Default: 'pretty'.")
    .option("-q, --query <text>", "Run a 'Sonar' audit using a specific user query to test trigger confidence.")
    .option("-m, --model <name>", "Override the default LLM model for Sonar auditing.")
    .option("-b, --baseUrl <url>", "Override the default API base URL for Sonar auditing (e.g., local Ollama).")
    .option("-u, --ghosts", "Scan agent berths for unregistered 'ghost' skills.")
    .option("--max-tokens <number>", "Gate threshold: Maximum total tokens allowed.")
    .option("--max-bloat <percentage>", "Gate threshold: Maximum context bloat percentage (GPT-4o).")
    .option("--min-score <number>", "Gate threshold: Minimum average fleet wake score.")
    .option("-g, --global", "Target the global manifest (~/.harbor).")
    .action(fathomAction);

await program.parseAsync(process.argv);
