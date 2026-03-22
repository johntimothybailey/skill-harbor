import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import ora from "ora";
import kleur from "kleur";

export class Orchestrator {
    private tempDir: string;
    private debugMode: boolean;

    constructor(options?: { debug?: boolean }) {
        this.tempDir = path.join(os.tmpdir(), `skill-harbor-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
        this.debugMode = options?.debug ?? false;
    }

    async moor(url: string): Promise<string> {
        const spinner = ora(kleur.cyan(`Mooring skill from ${url}...`)).start();
        try {
            await fs.mkdir(this.tempDir, { recursive: true });

            // Create .claude directory so skillfish detects it as a project
            await fs.mkdir(path.join(this.tempDir, ".claude"), { recursive: true });

            // Pass local paths directly if needed, otherwise parse skillfish owner/repo format
            if (url.startsWith('file://') || url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
                const localPath = url.replace('file://', '');
                await fs.cp(localPath, this.tempDir, { recursive: true });
                spinner.succeed(kleur.green("Local skill cargo successfully moored."));
                return this.tempDir;
            }

            // Format for skillfish: 'owner/repo skillname'
            let repo = url;
            let skillName = "";
            const parts = url.split(" ");
            if (parts.length > 1) {
                repo = parts[0];
                skillName = parts[1];
            } else {
                const slashParts = url.split("/");
                if (slashParts.length >= 3) {
                    repo = `${slashParts[0]}/${slashParts[1]}`;
                    skillName = slashParts[slashParts.length - 1]; // e.g. 'hook-ascender'
                }
            }

            const args = ["bunx", "skillfish", "add", repo];
            if (skillName) args.push(skillName);
            args.push("--project", "--yes");

            const process = Bun.spawn(args, {
                cwd: this.tempDir,
                stdin: "pipe",
                stdout: "pipe",
                stderr: "pipe"
            });
            // Bypass interactive prompts that --yes might miss
            process.stdin.write("\\n\\n\\n");
            process.stdin.flush();
            process.stdin.end();

            await process.exited;
            const out = await new Response(process.stdout).text();
            const err = await new Response(process.stderr).text();

            if (process.exitCode !== 0) {
                throw new Error(`Skillfish failed to moor cargo:\nExit Code: ${process.exitCode}\nStdout: ${out}\nStderr: ${err}`);
            }

            // Extract the cargo from the downloaded directory
            const skillsDir = path.join(this.tempDir, ".claude", "skills");
            let downloadedCargoPath = this.tempDir;

            try {
                const files = await fs.readdir(skillsDir);
                if (files.length > 0) {
                    downloadedCargoPath = path.join(skillsDir, files[0]);
                } else {
                    throw new Error("No skills found after skillfish fetch.");
                }
            } catch (e) {
                const out = await new Response(process.stdout).text();
                throw new Error(`Skillfish failed to moor cargo: ${e} \\nOutput: ${out}`);
            }

            spinner.succeed(kleur.green("Skill cargo successfully moored locally using native skillfish."));
            return downloadedCargoPath;
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

            const process = Bun.spawn(["bunx", "skill-porter", "convert", cargoPath, "-t", targetAgent, "-o", outputPath], {
                stdout: "pipe",
                stderr: "pipe"
            });
            
            await process.exited;
            const output = await new Response(process.stdout).text();
            const stderr = await new Response(process.stderr).text();

            if (process.exitCode !== 0) {
                throw new Error(`Cargo processing failed: ${output || stderr}`);
            }

            spinner.succeed(kleur.green(`Cargo processed for ${targetAgent} berth.`));
            return outputPath;
        } catch (error: any) {
            spinner.fail(kleur.red(`Processing incident: ${error.message}`));
            throw error;
        }
    }

    async berth(cargoPath: string, targetPath: string): Promise<boolean> {
        const hasFiles = await this.hasCargo(cargoPath);
        if (!hasFiles) {
            return false;
        }

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
            return true;
        } catch (error: any) {
            spinner.fail(kleur.red(`Berthing incident: ${error.message}`));
            throw error;
        }
    }

    async hasCargo(dirPath: string): Promise<boolean> {
        try {
            const files = await fs.readdir(dirPath);
            return files.length > 0;
        } catch {
            return false;
        }
    }

    async cleanup(): Promise<void> {
        if (this.debugMode) {
            console.log(kleur.gray(`\n[Debug Mode] Preserving temporary files at: ${this.tempDir}`));
            return;
        }
        try {
            await fs.rm(this.tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    }
}
