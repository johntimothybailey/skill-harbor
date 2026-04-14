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
import { ManifestManager } from "../manifest";
import { Orchestrator } from "../orchestrator";
import { getManifestManager, getAgentBerths, exists, getManagedAgentTargets, getSupportedTargetKeys } from "../utils";
import { printHeader, printSuccess, printError, printInfo, promptEmptyProjectHarborAction, promptSelectTargets } from "../ui";
import { migrateAction } from "./migrate";

const execAsync = promisify(exec);

/**
 * Automates adding local-only harbor files and cache directories to .gitignore.
 */
async function ensureHarborIgnoreCorrect(cwd: string) {
    const gitignorePath = path.join(cwd, ".gitignore");
    const requiredIgnores = [
        ".harbor/harbor-manifest.overrides.json",
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

        const legacyOverridesIgnoreIndex = lines.findIndex(l => l.trim() === "harbor-manifest.local.json" || l.trim() === ".harbor/harbor-manifest.local.json");
        if (legacyOverridesIgnoreIndex !== -1) {
            lines[legacyOverridesIgnoreIndex] = ".harbor/harbor-manifest.overrides.json";
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

function parseTargetOption(targetOption?: string | string[]): string[] | undefined {
    if (!targetOption) return undefined;

    const rawTargets = Array.isArray(targetOption) ? targetOption : [targetOption];

    const targets = rawTargets
        .flatMap(target => target.split(","))
        .map(target => target.trim())
        .filter(Boolean);

    return targets.length > 0 ? [...new Set(targets)] : undefined;
}

export async function upAction(options: any, command: any) {
    const opts = command.opts();
    const manifestManager = getManifestManager(opts);
    // Concurrent sync is easier to read as deterministic line updates than as
    // animated multi-spinner rendering, especially in mixed success/failure runs.
    const spinnies = new Spinnies({ disableSpins: true });

    try {
        printHeader("Workspace Synchronization Initiated");

        let useGlobalScope = opts.global ?? false;

        if (!useGlobalScope) {
            await manifestManager.init();
            await manifestManager.migrateLegacyOverrides((message: string) => {
                printInfo("Overrides Manifest Updated", message);
            });
        }

        if (!useGlobalScope) {
            const hasProjectManifestStack = await manifestManager.hasProjectManifestStack();
            const hasGlobalManifest = await ManifestManager.globalManifestExists();

            if (!hasProjectManifestStack && hasGlobalManifest) {
                if (!process.stdin.isTTY || !process.stdout.isTTY) {
                    printInfo("Using Global Harbor", "No project harbor manifest was found, and interactive prompting is unavailable. Falling back to the global harbor manifest.");
                    useGlobalScope = true;
                } else {
                const action = await promptEmptyProjectHarborAction();

                    if (action === "cancel") {
                        return;
                    }

                    if (action === "initialize") {
                        await manifestManager.write({
                            version: "1.0",
                            dependencies: {},
                            skills: {}
                        }, "shared");
                        printSuccess("Project harbor initialized at .harbor/harbor-manifest.json. Run 'skill-harbor dock <source>' to add skills, then run 'skill-harbor up' again.");
                        return;
                    }

                    useGlobalScope = true;
                }
            }
        }

        const baseDir = useGlobalScope ? os.homedir() : process.cwd();
        const requestedTargets = parseTargetOption(opts.target);

        if (requestedTargets) {
            const supportedTargets = getSupportedTargetKeys(true);
            const invalidTargets = requestedTargets.filter(target => !supportedTargets.includes(target));
            if (invalidTargets.length > 0) {
                printError(`Unknown target(s): ${invalidTargets.join(", ")}. Supported targets: ${supportedTargets.join(", ")}`);
                process.exit(1);
            }
        }
        
        // 1. Layered Manifest Loading
        const manifest = useGlobalScope 
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
                console.log(kleur.yellow(`\n💡  Recommendation: Found a legacy overrides manifest filename.`));
                console.log(kleur.gray(`    Run 'skill-harbor migrate' or 'skill-harbor up --migrate' to rename it to harbor-manifest.overrides.json.\n`));
            }
        }

        if (!useGlobalScope && manifest.overrides && manifest.overrides.length > 0) {
            console.log(kleur.yellow(`\n⚠️  Overrides Active: The following skills are being overridden by personal definitions in harbor-manifest.overrides.json:`));
            manifest.overrides.forEach((name: string) => console.log(kleur.yellow(`   - ${name}`)));
            console.log("");
        }

        // 3. Gitignore Automation (Conditional)
        if (!useGlobalScope && opts.migrate) {
            await ensureHarborIgnoreCorrect(process.cwd());
        }
        
        // Always ensure basic overrides manifest ignore if the project uses it (for safety)
        if (!useGlobalScope && !opts.migrate && await exists(ManifestManager.getProjectOverridesPath(process.cwd()))) {
            await ensureHarborIgnoreCorrect(process.cwd());
        }

        // --- Target Identification & Prompt ---
        let effectiveTargets = requestedTargets ?? manifest.targets;
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
                    : (target.key === "rulesync" ? await exists(rulesyncBase) : (useGlobalScope ? await exists(target.path) : await exists(path.dirname(target.path))));

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
                const skillLayer = skill.layer || (useGlobalScope ? "global" : "shared");
                const currentSourceHash = await getSourceHash(skill.source);
                const sourceChanged = currentSourceHash !== skill.lastSyncHash;
                const harborDir = manifestManager.getSkillsCacheDir(skillLayer);
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
                }, skillLayer);

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
        const latestManifest = useGlobalScope ? await manifestManager.read("global") : await manifestManager.readMerged();
        const latestSkills = Object.values(latestManifest.skills);
        const metadataList = [];
        for (const skill of latestSkills) {
            const skillLayer = skill.layer || (useGlobalScope ? "global" : "shared");
            const cachedPath = path.join(manifestManager.getSkillsCacheDir(skillLayer), skill.name);
            const orchestrator = new Orchestrator({ skillName: skill.name, spinnies });
            const meta = await orchestrator.getMetadata(cachedPath);
            if (meta) {
                metadataList.push({ ...meta, layer: skill.layer });
            }
        }

        if (metadataList.length > 0) {
            const manifestContent = `# Master Fleet Manifest\n\nThis workspace is powered by Skill Harbor. The following specialized agent skills are berthed and active.\n\n${metadataList.map(m => `### ${m.name}${m.layer === 'local' ? ' (Layer: Override)' : ''}\n- **Description**: ${m.description}\n- **Triggers**: ${m.triggers.join(", ") || "Auto-routed"}`).join("\n\n")}`;
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
