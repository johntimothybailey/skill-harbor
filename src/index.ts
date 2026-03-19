#!/usr/bin/env bun
import { Command } from "commander";
import kleur from "kleur";
import { Registry, DEFAULT_BERTHS } from "./registry";
import { Orchestrator } from "./orchestrator";
import { HarborServer } from "./server";

const program = new Command();

program
    .name("skill-harbor")
    .version("0.1.0")
    .description(kleur.blue("The Universal Skill Orchestrator (Maritime Authority)"));

program
    .command("berth")
    .argument("<url>", "Skill URL to fetch (URL or git repository)")
    .option("--to <agent>", "Target agent berth (all, claude, gemini, antigravity, codex)", "all")
    .description("Fetch, transpile, and berth a skill into the specified AI agent directories.")
    .action(async (url, options) => {
        const orchestrator = new Orchestrator();

        try {
            console.log(kleur.bold().blue("\n⚓  SkillHarbor: Admiralty Level Orchestration Initiated  ⚓\n"));

            // 1. Fetch cargo
            const cargoPath = await orchestrator.moor(url);

            // 2. Determine targets
            const targets = options.to === "all"
                ? Object.keys(DEFAULT_BERTHS)
                : [options.to];

            // 3. Check for workspace berth
            const workspacePath = await Registry.detectWorkspaceBerth();
            if (workspacePath) {
                console.log(kleur.yellow(`📡  Local workspace detected. Cargo will also be symlinked to ${workspacePath}`));
                targets.push("local-workspace");
            }

            // 4. Process and berth for each target
            for (const agent of targets) {
                if (agent === "local-workspace") {
                    // Special case for local workspace symlinking
                    await orchestrator.berth(cargoPath, workspacePath!);
                    continue;
                }

                const processedCargoPath = await orchestrator.processCargo(cargoPath, agent);
                const berthPath = await Registry.getBerthPath(agent);
                await orchestrator.berth(processedCargoPath, berthPath);
            }

            console.log(kleur.bold().green("\n🎉  All cargo successfully berthed. The harbor is secure.\n"));
        } catch (error: any) {
            console.error(kleur.red(`\n🛳️  SkillHarbor Alert: Major malfunction in harbor operations: ${error.message}\n`));
            process.exit(1);
        } finally {
            await orchestrator.cleanup();
        }
    });

program
    .command("up")
    .description("Start the Skill Harbor Port Authority (local execution server).")
    .option("-p, --port <number>", "Port to bind the SSE HTTP server to", "42721")
    .option("--stdio", "Run the server in STDIO mode for direct MCP tool integration")
    .action(async (options) => {
        const server = new HarborServer(parseInt(options.port, 10));
        if (options.stdio) {
            await server.startStdio();
        } else {
            await server.startHttp();
        }
    });

program.parse(process.argv);
