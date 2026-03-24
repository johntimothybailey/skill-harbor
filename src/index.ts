#!/usr/bin/env bun
import { Command } from "commander";
import kleur from "kleur";
import { Orchestrator } from "./orchestrator";
import { ManifestManager } from "./manifest";
import path from "node:path";
import os from "node:os";
import Spinnies from "spinnies";
import fs from "node:fs/promises";

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
    .option("-g, --global", "Dock into the global manifest at ~/.harbor/")
    .action(async (url, options) => {
        const manifestManager = getManifestManager(options);

        try {
            console.log(kleur.bold().blue("\n⚓  SkillHarbor: Docking Operations Initiated  ⚓\n"));

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

            console.log(kleur.bold().green(`\n🎉  Skill successfully manifested! Added ${skillName} to harbor-manifest.json.`));
            console.log(kleur.italic().gray(`Run 'skill-harbor up' to sync and activate this skill in your workspace.\n`));
        } catch (error: any) {
            console.error(kleur.red(`\n🛳️  SkillHarbor Alert: Major malfunction in harbor operations: ${error.message}\n`));
            process.exit(1);
        }
    });

program
    .command("list")
    .description("List all skills currently tracked in the harbor manifest.")
    .option("-g, --global", "List skills from the global manifest at ~/.harbor/")
    .action(async (options) => {
        const manifestManager = getManifestManager(options);
        try {
            const manifest = await manifestManager.read();
            const skills = Object.values(manifest.skills);

            console.log(kleur.bold().blue(`\n⚓  SkillHarbor: ${options.global ? "Global" : "Local"} Fleet Manifest  ⚓\n`));
            if (skills.length === 0) {
                console.log(kleur.yellow("No skills are currently docked in this workspace.\n"));
            } else {
                for (const skill of skills) {
                    console.log(`${kleur.green("✓")} ${kleur.bold(skill.name)} - ${kleur.gray(skill.source)}`);
                }
                console.log();
            }
        } catch (error: any) {
            console.error(kleur.red(`\n🛳️  SkillHarbor Alert: Cannot read manifest. Run 'dock' first to initialize.\n`));
        }
    });

program
    .command("up")
    .description("Sync the workspace by fetching and transpiling all skills from harbor-manifest.json into agent folders.")
    .option("-d, --debug", "Enable debug mode to preserve temporary directories and output verbose logs")
    .option("-g, --global", "Sync the global manifest into user-level agent folders")
    .action(async (options: any) => {
        const manifestManager = getManifestManager(options);
        const baseDir = options.global ? os.homedir() : process.cwd();
        const spinnies = new Spinnies();

        try {
            console.log(kleur.bold().blue("\n⚓  SkillHarbor: Workspace Synchronization Initiated  ⚓\n"));
            const manifest = await manifestManager.read();
            const skills = Object.values(manifest.skills);

            if (skills.length === 0) {
                console.log(kleur.yellow("No skills found in harbor-manifest.json. Run 'dock' to add some.\n"));
                return;
            }

            const syncPromises = skills.map(async (skill) => {
                const orchestrator = new Orchestrator({ 
                    skillName: skill.name, 
                    spinnies, 
                    debug: options.debug 
                });
                
                try {
                    // 1. Deduplication / Cache Check
                    let cargoPath = "";
                    const harborDir = manifestManager.getHarborDir();
                    const cachedPath = path.join(harborDir, skill.name);

                    if (await exists(cachedPath)) {
                        cargoPath = cachedPath;
                        spinnies.add(`sync-${skill.name}`, { text: kleur.cyan(`[${skill.name}] Using cached cargo from harbor.`) });
                    } else {
                        // Fetch cargo to temp space
                        cargoPath = await orchestrator.moor(skill.source);
                    }

                    // 2. Transpile for modern Agentic Editors (Claude)
                    const claudeProcessed = await orchestrator.processCargo(cargoPath, "claude");

                    // 3. Inject directly into configuration contexts
                    // --- Dynamic Target Detection ---
                    const targets = [];
                    
                    const claudeDest = path.join(baseDir, ".claude", "skills", skill.name);
                    if (options.global || await exists(path.join(baseDir, ".claude"))) {
                        const success = await orchestrator.berth(claudeProcessed, claudeDest, "Claude");
                        if (!success) await orchestrator.berth(cargoPath, claudeDest, "Claude (Raw)");
                        targets.push("Claude");
                    }

                    const cursorDest = path.join(baseDir, ".cursor", "rules", skill.name);
                    if (options.global || await exists(path.join(baseDir, ".cursor"))) {
                        const success = await orchestrator.berth(claudeProcessed, cursorDest, "Cursor");
                        if (!success) await orchestrator.berth(cargoPath, cursorDest, "Cursor (Raw)");
                        targets.push("Cursor");
                    }

                    const antigravityDest = path.join(baseDir, ".antigravity", "skills", skill.name);
                    if (options.global || await exists(path.join(baseDir, ".antigravity"))) {
                        const geminiProcessed = await orchestrator.processCargo(cargoPath, "gemini");
                        const success = await orchestrator.berth(geminiProcessed, antigravityDest, "Antigravity");
                        if (!success) await orchestrator.berth(cargoPath, antigravityDest, "Antigravity (Raw)");
                        targets.push("Antigravity");
                    }

                    // --- Rulesync Integration ---
                    const rulesyncBase = path.join(os.homedir(), ".rulesync", "skills");
                    if (await exists(rulesyncBase)) {
                        const rulesyncDest = path.join(rulesyncBase, skill.name);
                        await orchestrator.berth(claudeProcessed, rulesyncDest, "Rulesync");
                        targets.push("Rulesync");
                    }

                    // 4. Update the Harbor's local cache registry
                    await orchestrator.berth(cargoPath, cachedPath, "Harbor Cache");

                    // Mark success in manifest
                    await manifestManager.addSkill({
                        ...skill,
                        localPath: cachedPath
                    });

                    orchestrator.finalize(`Successfully berthed to: ${targets.join(", ") || "Harbor Cache"}`);
                } catch (err: any) {
                    // Spinnies handles the fail message via orchestrator
                } finally {
                    await orchestrator.cleanup();
                }
            });

            await Promise.all(syncPromises);

            console.log(kleur.bold().green(`\n🎉  Workspace Sync complete. The fleet is fully loaded with Agent skills.\n`));
        } catch (error: any) {
            console.error(kleur.red(`\n🛳️  SkillHarbor Alert: Synchronization failed: ${error.message}\n`));
            process.exit(1);
        }
    });

program.parse(process.argv);
