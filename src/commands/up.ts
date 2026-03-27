import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { lstatSync } from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import crypto from "node:crypto";
import glob from "fast-glob";
import kleur from "kleur";
import Spinnies from "spinnies";
import { Orchestrator } from "../orchestrator";
import { getManifestManager, exists } from "../utils";
import { printHeader, printSuccess, printError, printInfo } from "../ui";

const execAsync = promisify(exec);

/**
 * Generates a hash for the skill source to detect changes.
 * For remote URLs, it returns the URL itself.
 * For local paths, it hashes file stats (size, mtime) to detect updates.
 */
async function getSourceHash(source: string): Promise<string> {
    if (source.startsWith('http') || (source.includes('/') && !source.startsWith('.') && !source.startsWith('/') && !source.startsWith('file://'))) {
        // Assume it's a remote repo/URL
        try {
            // Extract the repo URL (owner/repo) from the source string
            let cleanUrl = source.replace(/^https?:\/\/(www\.)?github\.com\//, '');
            let repo = "";
            let ref = "HEAD"; // Default ref

            const hashParts = cleanUrl.split("#");
            if (hashParts.length > 1) {
                cleanUrl = hashParts[0];
                ref = hashParts[1];
            }

            const parts = cleanUrl.split(" ");
            if (parts.length > 1) {
                repo = parts[0];
            } else {
                const slashParts = cleanUrl.split("/");
                if (slashParts.length >= 2) {
                    repo = `${slashParts[0]}/${slashParts[1]}`;
                }
            }

            if (repo) {
                const repoUrl = `https://github.com/${repo}.git`;
                // Use a short timeout to prevent hanging the sync
                const { stdout } = await execAsync(`git ls-remote ${repoUrl} ${ref}`, { timeout: 5000 });
                const remoteHash = stdout.split(/\s+/)[0];
                if (remoteHash) return `${source}:${remoteHash}`;
            }
        } catch (err) {
            // If git fails or network is down, fallback to the source string itself
            // to avoid breaking the sync (it will just be conservative)
        }
        return source;
    }

    const localPath = source.replace('file://', '');
    try {
        const stats = await fs.stat(localPath);
        if (stats.isFile()) {
            return `${source}:${stats.size}:${stats.mtimeMs}`;
        }

        // It's a directory, hash the contents (stats only for speed)
        const files = await glob("**/*", { cwd: localPath, absolute: true, ignore: ["**/node_modules/**", "**/.git/**"] });
        const fileStats = files
            .map(f => {
                try {
                    const s = lstatSync(f);
                    return `${path.relative(localPath, f)}:${s.size}:${s.mtimeMs}`;
                } catch {
                    return "";
                }
            })
            .sort()
            .join("|");
        
        return crypto.createHash("md5").update(fileStats).digest("hex");
    } catch {
        // Fallback to source string if path doesn't exist
        return source;
    }
}

export async function upAction(options: any, command: any) {
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
                { path: path.join(baseDir, ".cursor", "skills"), label: "Cursor", key: "cursor" },
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
                const currentSourceHash = await getSourceHash(skill.source);
                const sourceChanged = currentSourceHash !== skill.lastSyncHash;
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
                
                // 3. Destination Integrity Check
                let destinationsMissing = false;
                for (const target of activeTargets) {
                    let dest = "";
                    if (target === "claude") dest = path.join(baseDir, ".claude", "skills", skill.name);
                    else if (target === "cursor") dest = path.join(baseDir, ".cursor", "skills", skill.name);
                    else if (target === "antigravity") dest = path.join(baseDir, ".antigravity", "skills", skill.name);
                    else if (target === "rulesync") dest = path.join(os.homedir(), ".rulesync", "skills", skill.name);
                    
                    if (dest && !(await exists(dest))) {
                        destinationsMissing = true;
                        break;
                    }
                }

                // 4. Optimization Bypass
                if (!opts.force && !sourceChanged && !targetsChanged && !destinationsMissing && cacheExists) {
                    spinnies.add(`sync-${skill.name}`, { text: kleur.gray(`[${skill.name}] No changes detected. Skipping sync.`) });
                    spinnies.succeed(`sync-${skill.name}`);
                    return;
                }

                // 5. Moor (Only if source changed or cache missing, unless forced)
                let cargoPath = "";
                if (!opts.force && !sourceChanged && cacheExists) {
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
                    const cursorDest = path.join(baseDir, ".cursor", "skills", skill.name);
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
                    lastSyncHash: currentSourceHash,
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
                targets.push(path.join(baseDir, ".cursor", "skills", fleetIntelligencePath));
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
}
