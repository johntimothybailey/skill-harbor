#!/usr/bin/env bun
import { Command } from "commander";
import kleur from "kleur";
import { Orchestrator } from "./orchestrator";
import { ManifestManager } from "./manifest";
import path from "node:path";

const program = new Command();

program
    .name("skill-harbor")
    .version("0.1.1")
    .description(kleur.blue("The Universal Skill Orchestrator (Maritime Authority)"));

program
    .command("dock")
    .argument("<url>", "Skill URL to fetch (URL or git repository)")
    .description("Dock a new skill into the local harbor manifest.")
    .action(async (url) => {
        const manifestManager = new ManifestManager();

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
    .description("List all skills currently tracked in the local harbor manifest.")
    .action(async () => {
        const manifestManager = new ManifestManager();
        try {
            const manifest = await manifestManager.read();
            const skills = Object.values(manifest.skills);

            console.log(kleur.bold().blue("\n⚓  SkillHarbor: Local Fleet Manifest  ⚓\n"));
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
    .description("Sync the workspace by fetching and transpiling all skills from harbor-manifest.json into local agent folders.")
    .action(async () => {
        const orchestrator = new Orchestrator();
        const manifestManager = new ManifestManager();
        try {
            console.log(kleur.bold().blue("\n⚓  SkillHarbor: Workspace Synchronization Initiated  ⚓\n"));
            const manifest = await manifestManager.read();
            const skills = Object.values(manifest.skills);

            if (skills.length === 0) {
                console.log(kleur.yellow("No skills found in harbor-manifest.json. Run 'dock' to add some.\n"));
                return;
            }

            for (const skill of skills) {
                console.log(kleur.magenta(`\nProcessing cargo: ${skill.name}`));
                // 1. Fetch cargo to temp space
                const cargoPath = await orchestrator.moor(skill.source);

                // 2. Transpile for modern Agentic Editors (Claude)
                const claudeProcessed = await orchestrator.processCargo(cargoPath, "claude");

                // 3. Inject directly into local workspace configuration contexts
                const claudeDest = path.join(process.cwd(), ".claude", "skills", skill.name);
                await orchestrator.berth(claudeProcessed, claudeDest);

                const cursorDest = path.join(process.cwd(), ".cursor", "rules", skill.name);
                await orchestrator.berth(claudeProcessed, cursorDest);

                // 4. Update the Harbor's local cache registry
                const harborDir = manifestManager.getHarborDir();
                const localPath = path.join(harborDir, skill.name);
                await orchestrator.berth(cargoPath, localPath);

                // Mark success in manifest
                await manifestManager.addSkill({
                    ...skill,
                    localPath: localPath
                });
            }

            console.log(kleur.bold().green(`\n🎉  Workspace Sync complete. The fleet is fully loaded with Agent skills.\n`));
        } catch (error: any) {
            console.error(kleur.red(`\n🛳️  SkillHarbor Alert: Synchronization failed: ${error.message}\n`));
            process.exit(1);
        } finally {
            await orchestrator.cleanup();
        }
    });

program.parse(process.argv);
