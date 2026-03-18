import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import ora from "ora";
import kleur from "kleur";
import { Registry } from "./registry";

export class Orchestrator {
    private tempDir: string;

    constructor() {
        this.tempDir = path.join(os.tmpdir(), `skill-harbor-${Date.now()}`);
    }

    async moor(url: string): Promise<string> {
        const spinner = ora(kleur.cyan(`Mooring skill from ${url}...`)).start();
        try {
            await fs.mkdir(this.tempDir, { recursive: true });

            // We assume skillfish is available as a binary or via npx
            const process = Bun.spawn(["bunx", "@knoxgraeme/skillfish", "fetch", url, "--out", this.tempDir]);
            const output = await new Response(process.stdout).text();

            if (process.exitCode !== 0) {
                throw new Error(`Mooring failed: ${output}`);
            }

            spinner.succeed(kleur.green("Skill cargo successfully moored locally."));
            return this.tempDir;
        } catch (error: any) {
            spinner.fail(kleur.red(`Mooring incident: ${error.message}`));
            throw error;
        }
    }

    async processCargo(cargoPath: string, targetAgent: string): Promise<string> {
        const spinner = ora(kleur.cyan(`Processing cargo via SkillPorter for ${targetAgent}...`)).start();
        try {
            const outputPath = path.join(this.tempDir, "processed", targetAgent);
            await fs.mkdir(outputPath, { recursive: true });

            const process = Bun.spawn(["bunx", "@yamanu/skill-porter", "transpile", cargoPath, "--target", targetAgent, "--out", outputPath]);
            const output = await new Response(process.stdout).text();

            if (process.exitCode !== 0) {
                throw new Error(`Cargo processing failed: ${output}`);
            }

            spinner.succeed(kleur.green(`Cargo processed for ${targetAgent} berth.`));
            return outputPath;
        } catch (error: any) {
            spinner.fail(kleur.red(`Processing incident: ${error.message}`));
            throw error;
        }
    }

    async berth(cargoPath: string, targetPath: string): Promise<void> {
        const spinner = ora(kleur.cyan(`Transporting cargo to berth: ${targetPath}`)).start();
        try {
            // Ensure target directory exists
            await fs.mkdir(targetPath, { recursive: true });

            // Atomic move or copy (since it might be across different filesystems)
            const files = await fs.readdir(cargoPath);
            for (const file of files) {
                const source = path.join(cargoPath, file);
                const destination = path.join(targetPath, file);

                // Use symlink or copy? User's "Vision" mentioned "Atomic move or Symlink".
                // Let's copy the processed files to the global berth.
                await fs.cp(source, destination, { recursive: true });
            }

            spinner.succeed(kleur.green(`Skill successfully berthed at ${targetPath}`));
        } catch (error: any) {
            spinner.fail(kleur.red(`Berthing incident: ${error.message}`));
            throw error;
        }
    }

    async cleanup(): Promise<void> {
        try {
            await fs.rm(this.tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    }
}
