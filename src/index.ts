#!/usr/bin/env node
import { Command } from "commander";
import kleur from "kleur";
import { dockAction } from "./commands/dock";
import { listAction } from "./commands/list";
import { undockAction } from "./commands/undock";
import { stowAction } from "./commands/stow";
import { unstowAction } from "./commands/unstow";
import { upAction } from "./commands/up";
import { checkAction } from "./commands/check";
import { lighthouseAction } from "./commands/lighthouse";

const program = new Command();

program
    .name("skill-harbor")
    .version("0.4.0")
    .description(kleur.blue("The Workspace Sync Engine for AI Agents — Standardize skills and context across your entire team."));

program
    .command("dock")
    .argument("<url>", "Skill URL to fetch (URL or git repository)")
    .description("Dock a new skill into the harbor manifest.")
    .addHelpText("after", `
Why: Registers a skill's source so all teammates can sync it.
Use Case: Run this when you find a new specialized skill (like 'react-query-rules') that you want the whole team to use.`)
    .option("-g, --global", "Dock into the global manifest at ~/.harbor/")
    .action(dockAction);

program
    .command("list")
    .description("List all skills currently tracked in the harbor manifest.")
    .addHelpText("after", `
Why: Provides a quick overview of what's currently in your project's 'Fleet'.
Use Case: Check this to see if a specific skill is already tracked before trying to dock it.`)
    .option("-g, --global", "List skills from the global manifest at ~/.harbor/")
    .action(listAction);

program
    .command("undock")
    .description("Clear agent skill folders to remove project or global context.")
    .addHelpText("after", `
Why: Forcefully removes agent context to prevent 'skill leakage' between projects.
Use Case: Use this if an agent is getting confused by old skills that are no longer in the manifest.`)
    .option("-g, --global", "Target user-level agent folders (e.g. ~/.claude)")
    .action(undockAction);

program
    .command("stow")
    .description("Temporarily move existing skills from agent berths to the harbor stowage area.")
    .addHelpText("after", `
Why: Safely clears the deck without deleting files.
Use Case: You want to work on a clean branch without your personal global skills, but you want to restore them later.`)
    .option("-g, --global", "Stow user-level agent skills (e.g. ~/.claude)")
    .action(stowAction);

program
    .command("unstow")
    .description("Restore stowed skills from the harbor stowage area back to active agent berths.")
    .addHelpText("after", `
Why: Restores your environment to its original state (Unlocks the Harbor).
Use Case: Run this after finishing a 'Lockdown' session to get your personal skills back.`)
    .option("-g, --global", "Restore user-level agent skills")
    .action(unstowAction);

program
    .command("up")
    .description("Sync the workspace by fetching and transpiling all skills from harbor-manifest.json into agent folders.")
    .addHelpText("after", `
Why: Standardizes your team's AI agent behavior across the entire project.
Use Case: Run this after cloning a repo or when a teammate adds new skills to the harbor-manifest.json.`)
    .option("-d, --debug", "Enable debug mode to preserve temporary directories and output verbose logs")
    .option("-g, --global", "Sync the global manifest into user-level agent folders")
    .option("-l, --lockdown", "Clear target agent folders before berthing to ensure ONLY manifest skills exist")
    .action(upAction);

program
    .command("check")
    .description("Verify that all berthed skills have valid SKILL.md metadata (Lighthouse Health).")
    .addHelpText("after", `
Why: Ensures your skills are actually 'discoverable' by AI agents.
Use Case: Run this if an agent isn't 'seeing' a skill you think is berthed.`)
    .option("-g, --global", "Check skills in the global manifest")
    .action(checkAction);

program
    .command("lighthouse")
    .description("Generate a System Prompt Snippet representing your fleet's intelligence.")
    .addHelpText("after", `
Why: Gives you a concise block of text to 'prime' any AI agent with your fleet's capabilities.
Use Case: Copy the output of this command into a custom instructions field or a system prompt.`)
    .option("-g, --global", "Generate snippet for global manifest skills")
    .action(lighthouseAction);

await program.parseAsync(process.argv);
