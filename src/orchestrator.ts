import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import Spinnies from "spinnies";
import kleur from "kleur";

export class Orchestrator {
    private tempDir: string;
    private debugMode: boolean;
    private spinnies: Spinnies;
    private skillName: string;

    constructor(options: { 
        skillName: string, 
        spinnies: Spinnies, 
        debug?: boolean 
    }) {
        this.tempDir = path.join(os.tmpdir(), `skill-harbor-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
        this.debugMode = options?.debug ?? false;
        this.spinnies = options.spinnies;
        this.skillName = options.skillName;
    }

    private get spinnerId(): string {
        return `sync-${this.skillName}`;
    }

    async moor(url: string): Promise<string> {
        this.spinnies.add(this.spinnerId, { text: kleur.cyan(`[${this.skillName}] Mooring skill from ${url}...`) });
        try {
            await fs.mkdir(this.tempDir, { recursive: true });

            // Create .claude directory so skillfish detects it as a project
            await fs.mkdir(path.join(this.tempDir, ".claude"), { recursive: true });

            // Pass local paths directly if needed, otherwise parse skillfish owner/repo format
            if (url.startsWith('file://') || url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
                const localPath = url.replace('file://', '');
                await fs.cp(localPath, this.tempDir, { recursive: true });
                this.spinnies.update(this.spinnerId, { text: kleur.green(`[${this.skillName}] Local skill cargo successfully moored.`) });
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
            process.stdin.write("\n\n\n");
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
                    throw new Error("No skills home found after skillfish fetch.");
                }
            } catch (e) {
                throw new Error(`Skillfish failed to moor cargo: ${e} \nOutput: ${out}`);
            }

            this.spinnies.update(this.spinnerId, { text: kleur.green(`[${this.skillName}] Skill cargo moored using skillfish.`) });
            return downloadedCargoPath;
        } catch (error: any) {
            this.spinnies.fail(this.spinnerId, { text: kleur.red(`[${this.skillName}] Mooring incident: ${error.message}`) });
            throw error;
        }
    }

    async processCargo(cargoPath: string, targetAgent: string): Promise<string> {
        this.spinnies.update(this.spinnerId, { text: kleur.cyan(`[${this.skillName}] Processing cargo for ${targetAgent}...`) });
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

            this.spinnies.update(this.spinnerId, { text: kleur.green(`[${this.skillName}] Cargo processed for ${targetAgent} berth.`) });
            return outputPath;
        } catch (error: any) {
            this.spinnies.fail(this.spinnerId, { text: kleur.red(`[${this.skillName}] Processing incident: ${error.message}`) });
            throw error;
        }
    }

    async berth(cargoPath: string, targetPath: string, label: string): Promise<boolean> {
        const hasFiles = await this.hasCargo(cargoPath);
        if (!hasFiles) {
            return false;
        }

        this.spinnies.update(this.spinnerId, { text: kleur.cyan(`[${this.skillName}] Transporting to ${label} berth...`) });
        try {
            // Ensure target directory exists
            await fs.mkdir(targetPath, { recursive: true });

            const files = await fs.readdir(cargoPath);
            for (const file of files) {
                const source = path.join(cargoPath, file);
                const destination = path.join(targetPath, file);
                await fs.cp(source, destination, { recursive: true });
            }

            this.spinnies.update(this.spinnerId, { text: kleur.green(`[${this.skillName}] Successfully berthed at ${label}.`) });
            return true;
        } catch (error: any) {
            this.spinnies.fail(this.spinnerId, { text: kleur.red(`[${this.skillName}] Berthing incident at ${label}: ${error.message}`) });
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

    async purgeTarget(targetPath: string, label: string): Promise<void> {
        if (!this.spinnies.pick(this.spinnerId)) {
            this.spinnies.add(this.spinnerId, { text: kleur.yellow(`[${this.skillName}] Purging ${label} berth...`) });
        } else {
            this.spinnies.update(this.spinnerId, { text: kleur.yellow(`[${this.skillName}] Purging ${label} berth...`) });
        }
        try {
            await fs.rm(targetPath, { recursive: true, force: true });
            await fs.mkdir(targetPath, { recursive: true });
        } catch (error: any) {
            this.spinnies.fail(this.spinnerId, { text: kleur.red(`[${this.skillName}] Purge incident at ${label}: ${error.message}`) });
            throw error;
        }
    }

    async stowTarget(targetPath: string, stowagePath: string, label: string): Promise<void> {
        if (!this.spinnies.pick(this.spinnerId)) {
            this.spinnies.add(this.spinnerId, { text: kleur.yellow(`[${this.skillName}] Stowing ${label} context...`) });
        } else {
            this.spinnies.update(this.spinnerId, { text: kleur.yellow(`[${this.skillName}] Stowing ${label} context...`) });
        }

        try {
            if (!(await this.exists(targetPath))) return;

            // Ensure stowage parent exists
            await fs.mkdir(path.dirname(stowagePath), { recursive: true });
            
            // If stowage already exists, remove it first (single-level backup)
            await fs.rm(stowagePath, { recursive: true, force: true });
            
            // Move target to stowage
            await fs.rename(targetPath, stowagePath);
            
            // Re-create target for fresh berthing
            await fs.mkdir(targetPath, { recursive: true });
        } catch (error: any) {
            this.spinnies.fail(this.spinnerId, { text: kleur.red(`[${this.skillName}] Stowage failure at ${label}: ${error.message}`) });
            throw error;
        }
    }

    async unstowTarget(stowagePath: string, targetPath: string, label: string): Promise<void> {
        if (!this.spinnies.pick(this.spinnerId)) {
            this.spinnies.add(this.spinnerId, { text: kleur.cyan(`[${this.skillName}] Unstowing ${label} context...`) });
        } else {
            this.spinnies.update(this.spinnerId, { text: kleur.cyan(`[${this.skillName}] Unstowing ${label} context...`) });
        }

        try {
            if (!(await this.exists(stowagePath))) {
                this.spinnies.update(this.spinnerId, { text: kleur.gray(`[${this.skillName}] No stowage found for ${label}. Skipping.`) });
                return;
            }

            // Clear target if it exists (to avoid merge conflicts)
            await fs.rm(targetPath, { recursive: true, force: true });
            await fs.mkdir(path.dirname(targetPath), { recursive: true });

            // Restore from stowage
            await fs.rename(stowagePath, targetPath);
        } catch (error: any) {
            this.spinnies.fail(this.spinnerId, { text: kleur.red(`[${this.skillName}] Unstowage failure at ${label}: ${error.message}`) });
            throw error;
        }
    }

    async getMetadata(targetPath: string): Promise<{ name: string; description: string; triggers: string[] } | null> {
        const skillPath = path.join(targetPath, "SKILL.md");
        if (!(await this.exists(skillPath))) return null;

        try {
            const content = await fs.readFile(skillPath, "utf-8");
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            
            if (!frontmatterMatch) return null;

            const yaml = frontmatterMatch[1];
            const metadata: any = {
                name: this.skillName,
                description: "No description provided.",
                triggers: []
            };

            // Simple regex-based YAML parsing for name/description/triggers
            const nameMatch = yaml.match(/^name:\s*(.*)$/m);
            const descMatch = yaml.match(/^description:\s*(.*)$/m);
            const triggersMatch = yaml.match(/^triggers:\s*\[(.*)\]$/m);

            if (nameMatch) metadata.name = nameMatch[1].trim();
            if (descMatch) metadata.description = descMatch[1].trim();
            if (triggersMatch) {
                metadata.triggers = triggersMatch[1].split(",").map(t => t.trim().replace(/^['"](.*)['"]$/, "$1"));
            }

            return metadata;
        } catch {
            return null;
        }
    }

    private async exists(path: string): Promise<boolean> {
        try {
            await fs.access(path);
            return true;
        } catch {
            return false;
        }
    }

    public finalize(message: string): void {
        this.spinnies.succeed(this.spinnerId, { text: kleur.bold().green(`[${this.skillName}] ${message}`) });
    }
}
