#!/usr/bin/env node
import { Command } from "commander";
import kleur from "kleur";
import { Orchestrator } from "./orchestrator";
import { ManifestManager } from "./manifest";
import path from "node:path";
import os from "node:os";
import Spinnies from "spinnies";
import fs from "node:fs/promises";
import { printHeader, printSuccess, printError, printInfo, printLighthouseSnippet } from "./ui";

const program = new Command();

async function exists(path: string): Promise<boolean> {
    try {
        await fs.access(path);
        return true;
    } catch {
        return false;
    }
}

program
    .name("skill-harbor")
    .version("0.4.0")
    .description(kleur.blue("The Workspace Sync Engine for AI Agents — Standardize skills and context across your entire team."));

function getManifestManager(options: any) {
    if (options.global) {
        return new ManifestManager({ customPath: ManifestManager.getGlobalPath() });
    }
    return new ManifestManager();
}

program
    .command("dock")
    .argument("<url>", "Skill URL to fetch (URL or git repository)")
    .description("Dock a new skill into the harbor manifest.")
    .addHelpText("after", `
Why: Registers a skill's source so all teammates can sync it.
Use Case: Run this when you find a new specialized skill (like 'react-query-rules') that you want the whole team to use.`)
    .option("-g, --global", "Dock into the global manifest at ~/.harbor/")
    .action(async (url, options, command) => {
        const opts = command.opts();
        const manifestManager = getManifestManager(opts);

        try {
            printHeader("Docking Operations Initiated");

            await manifestManager.init();

            const urlParts = url.split("/");
            let skillName = urlParts[urlParts.length - 1].replace(".git", "");
            if (!skillName) skillName = `skill-${Date.now()}`;

            // 3. Update Manifest
            await manifestManager.addSkill({
                name: skillName,
                source: url,
                localPath: "", // Will be populated by the 'up' command
            });

            printSuccess(`Skill successfully manifested! Added ${skillName}.`);
        } catch (error: any) {
            printError(`Major malfunction in harbor operations: ${error.message}`);
            process.exit(1);
        }
    });

program
    .command("list")
    .description("List all skills currently tracked in the harbor manifest.")
    .addHelpText("after", `
Why: Provides a quick overview of what's currently in your project's 'Fleet'.
Use Case: Check this to see if a specific skill is already tracked before trying to dock it.`)
    .option("-g, --global", "List skills from the global manifest at ~/.harbor/")
    .action(async (options, command) => {
        const opts = command.opts();
        const manifestManager = getManifestManager(opts);
        try {
            const manifest = await manifestManager.read();
            const skills = Object.values(manifest.skills);

            printHeader(`${options.global ? "Global" : "Local"} Fleet Manifest`);
            if (skills.length === 0) {
                console.log(kleur.yellow("  No skills are currently docked in this workspace.\n"));
            } else {
                for (const skill of skills) {
                    console.log(`  ${kleur.green("✓")} ${kleur.bold(skill.name)} - ${kleur.gray(skill.source)}`);
                }
                console.log();
            }
        } catch (error: any) {
            printError(`Cannot read manifest. Run 'dock' first to initialize.`);
        }
    });

program
    .command("undock")
    .description("Clear agent skill folders to remove project or global context.")
    .addHelpText("after", `
Why: Forcefully removes agent context to prevent 'skill leakage' between projects.
Use Case: Use this if an agent is getting confused by old skills that are no longer in the manifest.`)
    .option("-g, --global", "Target user-level agent folders (e.g. ~/.claude)")
    .action(async (options, command) => {
        const opts = command.opts();
        const baseDir = opts.global ? os.homedir() : process.cwd();
        const spinnies = new Spinnies();
        const orchestrator = new Orchestrator({ 
            skillName: "Undock", 
            spinnies,
        });

        try {
            printHeader("Undocking Operations Initiated");
            
            const targets = [
                { path: path.join(baseDir, ".claude", "skills"), label: "Claude" },
                { path: path.join(baseDir, ".cursor", "rules"), label: "Cursor" },
                { path: path.join(baseDir, ".antigravity", "skills"), label: "Antigravity" }
            ];

            if (options.global) {
                targets.push({ path: path.join(os.homedir(), ".rulesync", "skills"), label: "Rulesync" });
            }

            for (const target of targets) {
                if (await exists(target.path)) {
                    await orchestrator.purgeTarget(target.path, target.label);
                }
            }

            orchestrator.finalize("All targeted agent berths have been cleared.");
            printSuccess(`Undock complete. ${opts.global ? "Global" : "Local"} workspace is clean.`);
        } catch (error: any) {
            printError(`Undock failed: ${error.message}`);
            process.exit(1);
        }
    });

program
    .command("stow")
    .description("Temporarily move existing skills from agent berths to the harbor stowage area.")
    .addHelpText("after", `
Why: Safely clears the deck without deleting files.
Use Case: You want to work on a clean branch without your personal global skills, but you want to restore them later.`)
    .option("-g, --global", "Stow user-level agent skills (e.g. ~/.claude)")
    .action(async (options, command) => {
        const opts = command.opts();
        const baseDir = opts.global ? os.homedir() : process.cwd();
        const stowageBase = path.join(baseDir, opts.global ? ".harbor" : ".harbor", "stowage");
        const spinnies = new Spinnies();
        const orchestrator = new Orchestrator({ skillName: "Stow", spinnies });

        try {
            printHeader("Stowing Agent Context");
            
            const targets = [
                { path: path.join(baseDir, ".claude", "skills"), label: "Claude" },
                { path: path.join(baseDir, ".cursor", "rules"), label: "Cursor" },
                { path: path.join(baseDir, ".antigravity", "skills"), label: "Antigravity" }
            ];

            if (opts.global) {
                targets.push({ path: path.join(os.homedir(), ".rulesync", "skills"), label: "Rulesync" });
            }

            for (const target of targets) {
                const stowPath = path.join(stowageBase, target.label.toLowerCase());
                await orchestrator.stowTarget(target.path, stowPath, target.label);
            }

            orchestrator.finalize("All agent context has been stowed safely.");
            printSuccess(`Stow complete. Run 'unstow' to restore your environment later.`);
        } catch (error: any) {
            printError(`Stowage failed: ${error.message}`);
            process.exit(1);
        }
    });

program
    .command("unstow")
    .description("Restore stowed skills from the harbor stowage area back to active agent berths.")
    .addHelpText("after", `
Why: Restores your environment to its original state (Unlocks the Harbor).
Use Case: Run this after finishing a 'Lockdown' session to get your personal skills back.`)
    .option("-g, --global", "Restore user-level agent skills")
    .action(async (options, command) => {
        const opts = command.opts();
        const baseDir = opts.global ? os.homedir() : process.cwd();
        const stowageBase = path.join(baseDir, opts.global ? ".harbor" : ".harbor", "stowage");
        const spinnies = new Spinnies();
        const orchestrator = new Orchestrator({ skillName: "Unstow", spinnies });

        try {
            printHeader("Restoring Agent Context (Unlock)");
            
            const targets = [
                { path: path.join(baseDir, ".claude", "skills"), label: "Claude" },
                { path: path.join(baseDir, ".cursor", "rules"), label: "Cursor" },
                { path: path.join(baseDir, ".antigravity", "skills"), label: "Antigravity" }
            ];

            if (opts.global) {
                targets.push({ path: path.join(os.homedir(), ".rulesync", "skills"), label: "Rulesync" });
            }

            for (const target of targets) {
                const stowPath = path.join(stowageBase, target.label.toLowerCase());
                await orchestrator.unstowTarget(stowPath, target.path, target.label);
            }

            orchestrator.finalize("All agent context has been restored.");
            printSuccess(`Unstow complete. Your harbor is fully unlocked.`);
        } catch (error: any) {
            printError(`Unstowage failed: ${error.message}`);
            process.exit(1);
        }
    });

program
    .command("up")
    .description("Sync the workspace by fetching and transpiling all skills from harbor-manifest.json into agent folders.")
    .addHelpText("after", `
Why: Standardizes your team's AI agent behavior across the entire project.
Use Case: Run this after cloning a repo or when a teammate adds new skills to the harbor-manifest.json.`)
    .option("-d, --debug", "Enable debug mode to preserve temporary directories and output verbose logs")
    .option("-g, --global", "Sync the global manifest into user-level agent folders")
    .option("-l, --lockdown", "Clear target agent folders before berthing to ensure ONLY manifest skills exist")
    .action(async (options, command) => {
        const opts = command.opts();
        const manifestManager = getManifestManager(opts);
        const baseDir = opts.global ? os.homedir() : process.cwd();
        const spinnies = new Spinnies();

        try {
            printHeader("Workspace Synchronization Initiated");
            const manifest = await manifestManager.read();
            const skills = Object.values(manifest.skills);

            if (skills.length === 0) {
                printInfo("Empty Manifest", "No skills found in harbor-manifest.json. Run 'dock' to add some.");
                return;
            }

            // --- Lockdown Operation (Non-Destructive Stow) ---
            if (opts.lockdown) {
                const orchestrator = new Orchestrator({ skillName: "Lockdown", spinnies });
                const stowageBase = path.join(baseDir, opts.global ? ".harbor" : ".harbor", "stowage");
                const hasExplicitTargets = Array.isArray(manifest.targets) && manifest.targets.length > 0;
                
                const targetConfigs = [
                    { path: path.join(baseDir, ".claude", "skills"), label: "Claude", key: "claude" },
                    { path: path.join(baseDir, ".cursor", "rules"), label: "Cursor", key: "cursor" },
                    { path: path.join(baseDir, ".antigravity", "skills"), label: "Antigravity", key: "antigravity" }
                ];
                
                const rulesyncBase = path.join(os.homedir(), ".rulesync", "skills");
                targetConfigs.push({ path: rulesyncBase, label: "Rulesync", key: "rulesync" });

                for (const target of targetConfigs) {
                    const shouldLockdown = hasExplicitTargets 
                        ? manifest.targets!.includes(target.key)
                        : (target.key === "rulesync" ? await exists(rulesyncBase) : (opts.global ? await exists(target.path) : await exists(path.dirname(target.path))));

                    if (shouldLockdown) {
                        const stowPath = path.join(stowageBase, target.label.toLowerCase());
                        await orchestrator.stowTarget(target.path, stowPath, target.label);
                    }
                }
                orchestrator.finalize("Lockdown complete. Workspace context stowed.");
            }

            const failures: { skill: string; error: string }[] = [];
            const syncPromises = skills.map(async (skill) => {
                const orchestrator = new Orchestrator({ 
                    skillName: skill.name, 
                    spinnies, 
                    debug: options.debug 
                });
                
                try {
                    // 1. Change Detection
                    const sourceChanged = skill.source !== skill.lastSyncHash;
                    const harborDir = manifestManager.getHarborDir();
                    const cachedPath = path.join(harborDir, skill.name);
                    const cacheExists = await exists(cachedPath);

                    // 2. Target Identification
                    const hasExplicitTargets = Array.isArray(manifest.targets) && manifest.targets.length > 0;
                    const activeTargets: string[] = [];
                    
                    if (hasExplicitTargets ? manifest.targets!.includes("claude") : (opts.global ? await exists(path.join(os.homedir(), ".claude")) : await exists(path.join(baseDir, ".claude")))) activeTargets.push("claude");
                    if (hasExplicitTargets ? manifest.targets!.includes("cursor") : (opts.global ? await exists(path.join(os.homedir(), ".cursor")) : await exists(path.join(baseDir, ".cursor")))) activeTargets.push("cursor");
                    if (hasExplicitTargets ? manifest.targets!.includes("antigravity") : (opts.global ? await exists(path.join(os.homedir(), ".antigravity")) : await exists(path.join(baseDir, ".antigravity")))) activeTargets.push("antigravity");
                    if (hasExplicitTargets ? manifest.targets!.includes("rulesync") : (await exists(path.join(os.homedir(), ".rulesync", "skills")))) activeTargets.push("rulesync");

                    const targetsChanged = JSON.stringify(activeTargets.sort()) !== JSON.stringify((skill.lastSyncTargets || []).sort());

                    // 3. Optimization Bypass
                    if (!sourceChanged && !targetsChanged && cacheExists) {
                        spinnies.add(`sync-${skill.name}`, { text: kleur.gray(`[${skill.name}] No changes detected. Skipping sync.`) });
                        spinnies.succeed(`sync-${skill.name}`);
                        return;
                    }

                    // 4. Moor (Only if source changed or cache missing)
                    let cargoPath = "";
                    if (!sourceChanged && cacheExists) {
                        cargoPath = cachedPath;
                        spinnies.add(`sync-${skill.name}`, { text: kleur.cyan(`[${skill.name}] Source unchanged. Reusing cached cargo.`) });
                    } else {
                        cargoPath = await orchestrator.moor(skill.source);
                    }

                    // 5. Transpile & Berth
                    const berthedTargets: string[] = [];
                    const claudeProcessed = await orchestrator.processCargo(cargoPath, "claude");

                    // Claude
                    if (activeTargets.includes("claude")) {
                        const claudeDest = path.join(baseDir, ".claude", "skills", skill.name);
                        const success = await orchestrator.berth(claudeProcessed, claudeDest, "Claude");
                        if (!success) await orchestrator.berth(cargoPath, claudeDest, "Claude (Raw)");
                        berthedTargets.push("Claude");
                    }

                    // Cursor
                    if (activeTargets.includes("cursor")) {
                        const cursorDest = path.join(baseDir, ".cursor", "rules", skill.name);
                        const success = await orchestrator.berth(claudeProcessed, cursorDest, "Cursor");
                        if (!success) await orchestrator.berth(cargoPath, cursorDest, "Cursor (Raw)");
                        berthedTargets.push("Cursor");
                    }

                    // Antigravity
                    if (activeTargets.includes("antigravity")) {
                        const antigravityDest = path.join(baseDir, ".antigravity", "skills", skill.name);
                        const geminiProcessed = await orchestrator.processCargo(cargoPath, "gemini");
                        const success = await orchestrator.berth(geminiProcessed, antigravityDest, "Antigravity");
                        if (!success) await orchestrator.berth(cargoPath, antigravityDest, "Antigravity (Raw)");
                        berthedTargets.push("Antigravity");
                    }

                    // Rulesync
                    if (activeTargets.includes("rulesync")) {
                        const rulesyncDest = path.join(os.homedir(), ".rulesync", "skills", skill.name);
                        await orchestrator.berth(claudeProcessed, rulesyncDest, "Rulesync");
                        berthedTargets.push("Rulesync");
                    }

                    // 6. Update Cache & State
                    await orchestrator.berth(cargoPath, cachedPath, "Harbor Cache");

                    await manifestManager.addSkill({
                        ...skill,
                        localPath: cachedPath,
                        lastSyncHash: skill.source,
                        lastSyncTargets: activeTargets
                    });

                    orchestrator.finalize(`Successfully berthed to: ${berthedTargets.join(", ") || "Harbor Cache"}`);
                } catch (err: any) {
                    failures.push({ skill: skill.name, error: err.message });
                } finally {
                    await orchestrator.cleanup();
                }
            });

            await Promise.all(syncPromises);

            // --- Lighthouse: Automated Master Fleet Manifest ---
            console.log(kleur.yellow("\n  💡  Shining the Lighthouse..."));
            const latestManifest = await manifestManager.read();
            const latestSkills = Object.values(latestManifest.skills);
            const metadataList = [];
            for (const skill of latestSkills) {
                const cachedPath = path.join(manifestManager.getHarborDir(), skill.name);
                // REUSE spinnies from the main command context
                const orchestrator = new Orchestrator({ skillName: skill.name, spinnies });
                const meta = await orchestrator.getMetadata(cachedPath);
                if (meta) {
                    metadataList.push(meta);
                }
            }

            if (metadataList.length > 0) {
                const manifestContent = `# Master Fleet Manifest\n\nThis workspace is powered by Skill Harbor. The following specialized agentic skills are berthed and active.\n\n${metadataList.map(m => `### ${m.name}\n- **Description**: ${m.description}\n- **Triggers**: ${m.triggers.join(", ") || "Auto-routed"}`).join("\n\n")}`;
                
                const fleetIntelligencePath = "000-fleet-intelligence.md";
                const hasExplicitTargets = Array.isArray(manifest.targets) && manifest.targets.length > 0;
                const targets = [];
                
                if (hasExplicitTargets ? manifest.targets!.includes("claude") : (opts.global ? await exists(path.join(os.homedir(), ".claude")) : await exists(path.join(baseDir, ".claude")))) {
                    targets.push(path.join(baseDir, ".claude", "skills", fleetIntelligencePath));
                }
                if (hasExplicitTargets ? manifest.targets!.includes("cursor") : (opts.global ? await exists(path.join(os.homedir(), ".cursor")) : await exists(path.join(baseDir, ".cursor")))) {
                    targets.push(path.join(baseDir, ".cursor", "rules", fleetIntelligencePath));
                }
                if (hasExplicitTargets ? manifest.targets!.includes("antigravity") : (opts.global ? await exists(path.join(os.homedir(), ".antigravity")) : await exists(path.join(baseDir, ".antigravity")))) {
                    targets.push(path.join(baseDir, ".antigravity", "skills", fleetIntelligencePath));
                }

                for (const target of targets) {
                    await fs.mkdir(path.dirname(target), { recursive: true });
                    await fs.writeFile(target, manifestContent);
                }
                console.log(kleur.green("  ✓ [Lighthouse] Master Fleet Manifest berthed to all active agent folders.\n"));
            }

            if (failures.length > 0) {
                const failureMsg = `Workspace Sync completed with ${failures.length} incident(s).`;
                printError(failureMsg);
                failures.forEach(f => {
                    console.log(kleur.red(`  ✖ [${f.skill}] ${f.error}`));
                });
                process.exit(1);
            }

            printSuccess(`Workspace Sync complete. The fleet is fully loaded with Agent skills.`);
        } catch (error: any) {
            printError(`Synchronization failed: ${error.message}`);
            process.exit(1);
        }
    });

program
    .command("check")
    .description("Verify that all berthed skills have valid SKILL.md metadata (Lighthouse Health).")
    .addHelpText("after", `
Why: Ensures your skills are actually 'discoverable' by AI agents.
Use Case: Run this if an agent isn't 'seeing' a skill you think is berthed.`)
    .option("-g, --global", "Check skills in the global manifest")
    .action(async (options, command) => {
        const opts = command.opts();
        const manifestManager = getManifestManager(opts);
        const baseDir = opts.global ? os.homedir() : process.cwd();
        const spinnies = new Spinnies();

        try {
            printHeader("Lighthouse Health Check");
            const manifest = await manifestManager.read();
            const skills = Object.values(manifest.skills);

            if (skills.length === 0) {
                printInfo("Empty Harbor", "No skills found in the manifest to check.");
                return;
            }

            // Identify active agent targets (Same logic as 'up' command)
            const hasExplicitTargets = Array.isArray(manifest.targets) && manifest.targets.length > 0;
            const targetConfigs = [
                { path: path.join(baseDir, ".claude", "skills"), label: "Claude", key: "claude" },
                { path: path.join(baseDir, ".cursor", "rules"), label: "Cursor", key: "cursor" },
                { path: path.join(baseDir, ".antigravity", "skills"), label: "Antigravity", key: "antigravity" }
            ];
            
            const rulesyncBase = path.join(os.homedir(), ".rulesync", "skills");
            targetConfigs.push({ path: rulesyncBase, label: "Rulesync", key: "rulesync" });

            const activeTargets = [];
            for (const target of targetConfigs) {
                const isActive = hasExplicitTargets 
                    ? manifest.targets!.includes(target.key)
                    : (target.key === "rulesync" ? await exists(rulesyncBase) : (opts.global ? await exists(path.dirname(target.path)) : await exists(path.join(process.cwd(), path.basename(path.dirname(target.path)))) || await exists(target.path)));
                
                // Simplified active check for 'check' command to match environment
                const envExists = opts.global 
                    ? await exists(path.dirname(target.path))
                    : await exists(path.join(process.cwd(), "." + target.key));

                if (isActive || envExists) {
                    activeTargets.push(target);
                }
            }

            for (const skill of skills) {
                const cachedPath = path.join(manifestManager.getHarborDir(), skill.name);
                const orchestrator = new Orchestrator({ skillName: skill.name, spinnies });
                
                spinnies.add(`check-${skill.name}`, { text: `Auditing ${kleur.bold(skill.name)}...` });
                
                // 1. Metadata Quality Check
                const meta = await orchestrator.getMetadata(cachedPath);
                const isDiscoverable = meta && meta.description && meta.description !== "No description provided.";
                const metaStatus = isDiscoverable 
                    ? kleur.green(`📡 Discoverable (${meta!.description.substring(0, 40)}...)`)
                    : kleur.red("📡 Blind (Missing or invalid SKILL.md)");

                // 2. Berth Verification
                const mooredIn: string[] = [];
                const missingFrom: string[] = [];

                for (const target of activeTargets) {
                    const skillBerthPath = path.join(target.path, skill.name);
                    if (await exists(skillBerthPath)) {
                        mooredIn.push(target.label);
                    } else {
                        missingFrom.push(target.label);
                    }
                }

                let berthStatus = "";
                if (mooredIn.length > 0) {
                    berthStatus += kleur.cyan(`⚓ Moored in: [${mooredIn.join(", ")}]`);
                }
                if (missingFrom.length > 0) {
                    if (berthStatus) berthStatus += " | ";
                    berthStatus += kleur.yellow(`⚠️  Missing from: [${missingFrom.join(", ")}]`);
                }
                if (mooredIn.length === 0 && missingFrom.length === 0) {
                    berthStatus = kleur.gray("No active agent berths detected.");
                }

                const statusText = `[${kleur.bold(skill.name)}]\n    ${metaStatus}\n    ${berthStatus}`;
                
                if (isDiscoverable && missingFrom.length === 0) {
                    spinnies.succeed(`check-${skill.name}`, { text: statusText });
                } else {
                    spinnies.fail(`check-${skill.name}`, { text: statusText });
                }
            }
        } catch (error: any) {
            printError(`Check failed: ${error.message}`);
        }
    });

program
    .command("lighthouse")
    .description("Generate a System Prompt Snippet representing your fleet's intelligence.")
    .addHelpText("after", `
Why: Gives you a concise block of text to 'prime' any AI agent with your fleet's capabilities.
Use Case: Copy the output of this command into a custom instructions field or a system prompt.`)
    .option("-g, --global", "Generate snippet for global manifest skills")
    .action(async (options, command) => {
        const opts = command.opts();
        const manifestManager = getManifestManager(opts);
        const spinnies = new Spinnies();

        try {
            const manifest = await manifestManager.read();
            const skills = Object.values(manifest.skills);
            const metadataList = [];

            for (const skill of skills) {
                const cachedPath = path.join(manifestManager.getHarborDir(), skill.name);
                const orchestrator = new Orchestrator({ skillName: skill.name, spinnies });
                const meta = await orchestrator.getMetadata(cachedPath);
                if (meta) metadataList.push(meta);
            }

            let snippet = `${kleur.yellow("Available specialized skills in this workspace:")}\n`;
            for (const meta of metadataList) {
                snippet += `\n- ${kleur.bold(meta.name)}: ${meta.description}`;
                if (meta.triggers.length > 0) {
                    snippet += `\n  Triggers: ${meta.triggers.join(", ")}`;
                }
            }
            
            printLighthouseSnippet(snippet);
        } catch (error: any) {
            printError(`Lighthouse failed: ${error.message}`);
        }
    });

await program.parseAsync(process.argv);
