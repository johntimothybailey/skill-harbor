#!/usr/bin/env bun
import { Command } from "commander";
import kleur from "kleur";
import { Registry, DEFAULT_BERTHS } from "./registry";
import { Orchestrator } from "./orchestrator";
import { ManifestManager } from "./manifest";
import path from "node:path";

const program = new Command();

program
    .name("skill-harbor")
    .version("0.1.0")
    .description(kleur.blue("The Universal Skill Orchestrator (Maritime Authority)"));

program
    .command("dock")
    .argument("<url>", "Skill URL to fetch (URL or git repository)")
    .description("Dock a new skill into the local harbor manifest.")
    .action(async (url) => {
        const orchestrator = new Orchestrator();
        const manifestManager = new ManifestManager();

        try {
            console.log(kleur.bold().blue("\n⚓  SkillHarbor: Docking Operations Initiated  ⚓\n"));

            await manifestManager.init();

            // 1. Fetch cargo to temp space
            const cargoPath = await orchestrator.moor(url);

            // 2. Berth to local workspace
            const harborDir = manifestManager.getHarborDir();
            const urlParts = url.split("/");
            const skillName = urlParts[urlParts.length - 1].replace(".git", "") || `skill-${Date.now()}`;

            const localPath = path.join(harborDir, skillName);
            await orchestrator.berth(cargoPath, localPath);

            // 3. Update Manifest
            await manifestManager.addSkill({
                name: skillName,
                source: url,
                localPath: localPath,
            });

            console.log(kleur.bold().green(`\n🎉  Skill successfully docked! Added ${skillName} to harbor-manifest.json.\n`));
        } catch (error: any) {
            console.error(kleur.red(`\n🛳️  SkillHarbor Alert: Major malfunction in harbor operations: ${error.message}\n`));
            process.exit(1);
        } finally {
            await orchestrator.cleanup();
        }
    });

program
    .command("up")
    .description("Sync the workspace by fetching and transpiling all skills from harbor-manifest.json into local agent folders.")
    .action(async () => {
        // TODO: Implement Workspace Sync Engine logic here
        console.log(kleur.blue("Setting up the workspace engine..."));
    });

program.parse(process.argv);
