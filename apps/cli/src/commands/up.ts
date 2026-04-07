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
import { getManifestManager, getAgentBerths, exists, getManagedAgentTargets } from "../utils";
import { printHeader, printSuccess, printError, printInfo, promptSelectTargets } from "../ui";
import { migrateAction } from "./migrate";

const execAsync = promisify(exec);

/**
 * Automates adding local-only harbor files and cache directories to .gitignore.
 */
async function ensureHarborIgnoreCorrect(cwd: string) {
    const gitignorePath = path.join(cwd, ".gitignore");
    const requiredIgnores = [
        "harbor-manifest.local.json",
        "harbor-compass.yaml",
        ".harbor/skills/",
        ".harbor/stowage/"
    ];
    
    try {
        let content = "";
        try {
            content = await fs.readFile(gitignorePath, "utf-8");
        } catch (e) {
            // .gitignore doesn't exist, create it
            await fs.writeFile(gitignorePath, requiredIgnores.join("\n") + "\n", "utf-8");
            return;
        }

        const lines = content.split("\n");
        let updated = false;

        // 1. If the user was ignoring the entire .harbor directory, transition them to just ignoring skills/
        const legacyIndex = lines.findIndex(l => l.trim() === ".harbor" || l.trim() === ".harbor/");
        if (legacyIndex !== -1) {
            lines[legacyIndex] = ".harbor/skills/";
            updated = true;
        }

        // 2. Add missing ignores
        const currentContent = lines.join("\n");
        for (const ignore of requiredIgnores) {
            if (!currentContent.includes(ignore)) {
                lines.push(ignore);
                updated = true;
            }
        }

        if (updated) {
            await fs.writeFile(gitignorePath, lines.join("\n").replace(/\n{3,}/g, "\n\n"), "utf-8");
        }
    } catch (e) {
        // Silently fail if we can't write to .gitignore (e.g. permission issues)
    }
}

/**
 * Generates a hash for the skill source to detect changes.
 */
async function getSourceHash(source: string): Promise<string> {
    const isRemote = source.startsWith('http') || 
                   (source.includes('/') && !source.startsWith('.') && !source.startsWith('/') && !source.startsWith('file://'));
    
    if (isRemote) {
        try {
            let cleanUrl = source.replace(/^https?:\/\/(www\.)?github\.com\//, '');
            let repo = "";
            let ref = "HEAD";

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
                const { stdout } = await execAsync(`git ls-remote ${repoUrl} ${ref}`, { timeout: 5000 });
                const remoteHash = stdout.split(/\s+/)[0];
                if (remoteHash) return `${source}:${remoteHash}`;
            }
        } catch (err) {
            // Fallback
        }
        return source;
    }

    const localPath = source.replace('file://', '');
    try {
        const stats = await fs.stat(localPath);
        if (stats.isFile()) {
            return `${source}:${stats.size}:${stats.mtimeMs}`;
        }

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
        
        // 1. Layered Manifest Loading
        const manifest = opts.global 
            ? await manifestManager.read("global") 
            : await manifestManager.readMerged();

        const skills = Object.values(manifest.skills);

        if (skills.length === 0) {
            printInfo("Empty Manifest", "No skills found in harbor manifest stack. Run 'dock' to add some.");
            return;
        }

        // 2. Migration Warnings & Execution
        if (opts.migrate) {
            await migrateAction(opts);
        } else {
            if (manifestManager.isMigrationRecommended) {
                console.log(kleur.yellow(`\n💡  Recommendation: Found harbor-manifest.json at project root.`));
                console.log(kleur.gray(`    Run 'skill-harbor migrate' or 'skill-harbor up --migrate' to automate the transition.\n`));
            }

            if (manifestManager.isLocalMigrationRecommended) {
                console.log(kleur.yellow(`\n💡  Recommendation: Found harbor-manifest.local.json at project root.`));
                console.log(kleur.gray(`    Run 'skill-harbor migrate' or 'skill-harbor up --migrate' to automate the transition.\n`));
            }
        }

        if (!opts.global && manifest.overrides && manifest.overrides.length > 0) {
            console.log(kleur.yellow(`\n⚠️  Local Override: The following skills are being overridden by personal definitions in harbor-manifest.local.json:`));
            manifest.overrides.forEach((name: string) => console.log(kleur.yellow(`   - ${name}`)));
            console.log("");
        }

        // 3. Gitignore Automation (Conditional)
        if (!opts.global && opts.migrate) {
            await ensureHarborIgnoreCorrect(process.cwd());
        }
        
        // Always ensure basic local manifest ignore if it exists at root (for safety)
        if (!opts.global && !opts.migrate && await exists(path.join(process.cwd(), "harbor-manifest.local.json"))) {
            await ensureHarborIgnoreCorrect(process.cwd());
        }

        // --- Target Identification & Prompt ---
        let effectiveTargets = opts.target ? [opts.target] : manifest.targets;
        let activeTargetConfigs = await getAgentBerths(baseDir, effectiveTargets);

        if (activeTargetConfigs.length === 0) {
            const allPossibleTargets = getManagedAgentTargets(baseDir);
            const selected = await promptSelectTargets(allPossibleTargets);
            if (!selected) return; // User cancelled
            effectiveTargets = selected;
            activeTargetConfigs = await getAgentBerths(baseDir, effectiveTargets);
        }

        // --- Lockdown Operation ---
        if (opts.lockdown) {
            const orchestrator = new Orchestrator({ skillName: "Lockdown", spinnies });
            const stowageBase = path.join(baseDir, ".harbor", "stowage");
            const hasExplicitTargets = Array.isArray(effectiveTargets) && effectiveTargets.length > 0;
            const rulesyncBase = path.join(os.homedir(), ".rulesync", "skills");
            const targetConfigs = getManagedAgentTargets(baseDir);

            for (const target of targetConfigs) {
                const shouldLockdown = hasExplicitTargets 
                    ? effectiveTargets!.includes(target.key)
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

                // 2. Already identified activeTargetConfigs
                const activeTargets = activeTargetConfigs.map(target => target.key);
                const targetsChanged = JSON.stringify([...activeTargets].sort()) !== JSON.stringify([...(skill.lastSyncTargets || [])].sort());
                
                // 3. Destination Integrity Check
                let destinationsMissing = false;
                for (const target of activeTargetConfigs) {
                    const dest = path.join(target.path, skill.name);
                    if (!(await exists(dest))) {
                        destinationsMissing = true;
                        break;
                    }
                }

                if (!opts.force && !sourceChanged && !targetsChanged && !destinationsMissing && cacheExists) {
                    spinnies.add(`sync-${skill.name}`, { text: kleur.gray(`[${skill.name}] No changes detected. Skipping sync.`) });
                    spinnies.succeed(`sync-${skill.name}`);
                    return;
                }

                let cargoPath = "";
                if (!opts.force && !sourceChanged && cacheExists) {
                    cargoPath = cachedPath;
                    spinnies.add(`sync-${skill.name}`, { text: kleur.cyan(`[${skill.name}] Source unchanged. Reusing cached cargo.`) });
                } else {
                    cargoPath = await orchestrator.moor(skill.source);
                }

                // 5. Transpile & Berth
                const berthedTargets: string[] = [];
                const needsClaudeProcessed = activeTargets.some(target => ["claude", "cursor", "rulesync", "windsurf", "continue", "copilot"].includes(target));
                const needsGeminiProcessed = activeTargets.some(target => ["antigravity", "gemini"].includes(target));

                const claudeProcessed = needsClaudeProcessed
                    ? await orchestrator.processCargo(cargoPath, "claude")
                    : null;
                
                const geminiProcessed = needsGeminiProcessed
                    ? await orchestrator.processCargo(cargoPath, "gemini")
                    : null;

                for (const target of activeTargetConfigs) {
                    const dest = path.join(target.path, skill.name);
                    let success = false;

                    if (["claude", "cursor", "rulesync", "windsurf", "continue", "copilot"].includes(target.key) && claudeProcessed) {
                        success = await orchestrator.berth(claudeProcessed, dest, target.label);
                    } else if (["antigravity", "gemini"].includes(target.key) && geminiProcessed) {
                        success = await orchestrator.berth(geminiProcessed, dest, target.label);
                    } else if (target.key === "codex") {
                        // Codex usually likes raw or specific format, currently raw as per original logic
                        success = await orchestrator.berth(cargoPath, dest, target.label);
                    }

                    if (success) {
                        berthedTargets.push(target.label);
                    } else if (target.key !== "codex") {
                        // Fallback to raw for standard IDE targets if processing failed
                        await orchestrator.berth(cargoPath, dest, `${target.label} (Raw)`);
                        berthedTargets.push(`${target.label} (Raw)`);
                    }
                }

                // 6. Update Cache & State (Only if we fetched fresh cargo)
                if (cargoPath !== cachedPath) {
                    await orchestrator.berth(cargoPath, cachedPath, "Harbor Cache");
                }

                await manifestManager.addSkill({
                    ...skill,
                    localPath: cachedPath,
                    lastSyncHash: currentSourceHash,
                    lastSyncTargets: activeTargets
                }, skill.layer || "shared");

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
        const latestManifest = opts.global ? await manifestManager.read("global") : await manifestManager.readMerged();
        const latestSkills = Object.values(latestManifest.skills);
        const metadataList = [];
        for (const skill of latestSkills) {
            const cachedPath = path.join(manifestManager.getHarborDir(), skill.name);
            const orchestrator = new Orchestrator({ skillName: skill.name, spinnies });
            const meta = await orchestrator.getMetadata(cachedPath);
            if (meta) {
                metadataList.push({ ...meta, layer: skill.layer });
            }
        }

        if (metadataList.length > 0) {
            const manifestContent = `# Master Fleet Manifest\n\nThis workspace is powered by Skill Harbor. The following specialized agent skills are berthed and active.\n\n${metadataList.map(m => `### ${m.name}${m.layer === 'local' ? ' (Layer: Local Override)' : ''}\n- **Description**: ${m.description}\n- **Triggers**: ${m.triggers.join(", ") || "Auto-routed"}`).join("\n\n")}`;
            const codexManifestContent = `---\nname: fleet-intelligence\ndescription: Discover the specialized skills currently berthed by Skill Harbor in this workspace.\n---\n\n${manifestContent}`;
            
            const fleetIntelligencePath = "000-fleet-intelligence.md";
            const activeAgentBerthsForLighthouse = await getAgentBerths(baseDir, effectiveTargets);
            const targets: Array<{ path: string; content: string }> = [];
            
            for (const agent of activeAgentBerthsForLighthouse) {
                if (agent.key === "codex") {
                    targets.push({
                        path: path.join(agent.path, "000-fleet-intelligence", "SKILL.md"),
                        content: codexManifestContent
                    });
                } else {
                    targets.push({
                        path: path.join(agent.path, fleetIntelligencePath),
                        content: manifestContent
                    });
                }
            }

            for (const target of targets) {
                await fs.mkdir(path.dirname(target.path), { recursive: true });
                await fs.writeFile(target.path, target.content);
            }
            console.log(kleur.green("  ✓ [Lighthouse] Master Fleet Manifest berthed to all active agent folders.\n"));
        }

        if (failures.length > 0) {
            const failureMsg = `Workspace Sync completed with ${failures.length} incident(s).`;
            printError(failureMsg);
            failures.forEach(f => {
                printError(`[${f.skill}] ${f.error}`);
            });
            process.exit(1);
        }

        printSuccess(`Workspace Sync complete. The fleet is fully loaded with Agent skills.`);
    } catch (error: any) {
        printError(`Synchronization failed: ${error.message}`);
        process.exit(1);
    }
}
