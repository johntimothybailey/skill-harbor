import path from "node:path";
import kleur from "kleur";
import Spinnies from "spinnies";
import { getManifestManager, exists, getAgentBerths, AgentBerth } from "../utils";
import { ProfilerService } from "../services/profiler";
import { ConfigManager } from "../services/config";
import { printHeader, printError, printInfo, printHarborHealthReport } from "../ui";
import os from "node:os";

export async function fathomAction(options: any, command: any) {
    const opts = command.opts();
    const manifestManager = getManifestManager(opts);
    const spinnies = new Spinnies();
    const profiler = new ProfilerService();
    const configManager = ConfigManager.getInstance();
    
    const showDetails = opts.details ?? false;
    const showReport = opts.report ?? false;
    const query = opts.query;
    const modelOverride = opts.model;
    const baseUrlOverride = opts.baseUrl;

    try {
        if (!opts.format || opts.format === "pretty") {
            printHeader("Fathom: Skill Profiler");
        }
        
        // 1. Load Configuration
        const config = await configManager.loadConfig({
            model: modelOverride,
            baseUrl: baseUrlOverride
        });

        const manifest = opts.global 
            ? await manifestManager.read("global") 
            : await manifestManager.readMerged();

        let skills: any[] = Object.values(manifest.skills);
        const manifestSkillNames = new Set(skills.map(s => s.name));
        const ghostSkillPaths: string[] = [];

        // 2.5 Ghost Skill Discovery
        if (opts.ghosts) {
            const baseDir = opts.global ? os.homedir() : process.cwd();
            const berths = await getAgentBerths(baseDir, manifest.targets);
            
            for (const berth of berths) {
                const foundPaths = await profiler.findSkills(berth.path);
                for (const skillPath of foundPaths) {
                    const name = path.basename(skillPath);
                    if (!manifestSkillNames.has(name)) {
                        ghostSkillPaths.push(skillPath);
                        // Add to individual skills list if not doing a report
                        if (!showReport) {
                            skills.push({
                                name,
                                layer: "ghost" as any,
                                isGhost: true,
                                path: skillPath
                            });
                        }
                    }
                }
            }
        }

        if (skills.length === 0 && ghostSkillPaths.length === 0) {
            printInfo("Empty Harbor", "No skills found in the manifest or agent berths to fathom.");
            return;
        }

        // 3. Override Warnings
        if (!opts.global && manifest.overrides && manifest.overrides.length > 0 && (!opts.format || opts.format === "pretty")) {
            console.log(kleur.yellow(`\n⚠️  Local Override: The following skills are being overridden by personal definitions in harbor-manifest.local.json:`));
            manifest.overrides.forEach((name: string) => console.log(kleur.yellow(`   - ${name}`)));
            console.log("");
        }

        // --- Harbor Health Report ---
        if (showReport) {
            const harborDir = manifestManager.getHarborDir();
            const format = opts.format ?? 'pretty';
            
            if (format === 'pretty') {
                spinnies.add("harbor-scan", { text: `Scanning Harbor: ${kleur.cyan(harborDir)}` });
            }
            
            let skillPaths = await profiler.findSkills(harborDir);
            
            // Include ghosts in the report paths
            if (opts.ghosts) {
                skillPaths = [...new Set([...skillPaths, ...ghostSkillPaths])];
            }

            if (skillPaths.length === 0) {
                if (format === 'pretty') {
                    spinnies.fail("harbor-scan", { text: "No vessels found to fathom. Check manifest or berths." });
                } else {
                    console.error(JSON.stringify({ error: "No vessels found" }));
                }
                return;
            }

            if (format === 'pretty') spinnies.update("harbor-scan", { text: `Analyzing ${skillPaths.length} skills for context bloat...` });
            
            const thresholds = {
                maxTokens: opts.maxTokens ? parseInt(opts.maxTokens) : undefined,
                maxBloat: opts.maxBloat ? parseFloat(opts.maxBloat) : undefined,
                minScore: opts.minScore ? parseFloat(opts.minScore) : undefined
            };

            const report = await profiler.generateHealthReport(skillPaths, thresholds, query, config.sonar);
            
            if (format === 'pretty') {
                spinnies.succeed("harbor-scan", { text: `Fleet audit complete. ${skillPaths.length} vessels scanned.` });
            }
            
            printHarborHealthReport(report, format);

            if (!report.status.isHealthy) {
                process.exit(1);
            }
            
            // Only exit here if details are NOT requested, allowing individual results to follow
            if (!showDetails || format === 'json') {
                return;
            }
        }

        // 4. Individual Skill Analysis (Default)
        for (const skill of skills) {
            const cachedPath = skill.isGhost 
                ? skill.path 
                : path.join(manifestManager.getHarborDir(), skill.name);
            
            let layerLabel = "";
            if (skill.layer === "local") layerLabel = kleur.yellow(" [Local Override]");
            else if (skill.layer === "global") layerLabel = kleur.gray(" [Global]");
            else if (skill.layer === "ghost") layerLabel = kleur.magenta(" [Ghost]");

            if (!(await exists(cachedPath))) {
                spinnies.add(`fathom-${skill.name}`, { text: `${kleur.yellow(`[${skill.name}]`)}${layerLabel} Skill cargo not found in harbor. Run 'up' first.` });
                spinnies.fail(`fathom-${skill.name}`);
                continue;
            }

            spinnies.add(`fathom-${skill.name}`, { text: `Fathoming ${kleur.bold(skill.name)}${layerLabel}...` });

            try {
                const displacement = await profiler.calculateDisplacement(cachedPath);
                const heuristic = await profiler.calculateHeuristicConfidence(cachedPath);
                
                let sonarResult = null;
                if (query) {
                    spinnies.update(`fathom-${skill.name}`, { text: `Conducting Sonar Audit for ${kleur.bold(skill.name)}...` });
                    try {
                        sonarResult = await profiler.conductSonarAudit(skill.name, cachedPath, query, config.sonar);
                    } catch (err: any) {
                        // Sonar failed but we continue with heuristic
                    }
                }

                spinnies.remove(`fathom-${skill.name}`);

                const costGpt4 = displacement.cost.gpt4o.toFixed(4);
                const costMini = displacement.cost.gpt4oMini.toFixed(6);
                const displacementText = `${displacement.icon} ${kleur.bold(displacement.shipClass)} (${displacement.tokens} tokens) | GPT-4o: $${costGpt4}, Mini: $${costMini}`;
                
                let heuristicColor = kleur.red;
                let heuristicEmoji = "🔴";
                if (heuristic.score > 3) { heuristicColor = kleur.yellow; heuristicEmoji = "🟠"; }
                if (heuristic.score > 5) { heuristicColor = kleur.yellow; heuristicEmoji = "🟡"; }
                if (heuristic.score > 6) { heuristicColor = kleur.green; heuristicEmoji = "🟢"; }
                if (heuristic.score > 8) { heuristicColor = kleur.green; heuristicEmoji = "✨"; }

                const heuristicText = `${heuristicEmoji} ${heuristicColor(heuristic.condition)} (${heuristic.score}/10)`;

                let sonarText = kleur.gray("[Offline - Provide --query]");
                if (sonarResult) {
                    const sonarColor = sonarResult.score > 80 ? kleur.green : sonarResult.score > 50 ? kleur.yellow : kleur.red;
                    const barLength = 10;
                    const filledLength = Math.round((sonarResult.score / 100) * barLength);
                    const bar = sonarColor("█".repeat(filledLength)) + kleur.gray("░".repeat(barLength - filledLength));
                    sonarText = `[${bar}] ${sonarColor(sonarResult.score + "%")} (via ${sonarResult.model})`;
                }

                const typeEmoji = heuristic.skillType === "API Tool" ? "🔧" : "🧠";
                const validationEmoji = heuristic.validation.isProperlyFormatted ? "✅" : "⚠️";

                const fmt = (v: number) => { const inv = -v; return inv > 0 ? `+${inv}` : `${inv}`; };

                let heuristicSubtext = "";
                if (heuristic.skillType === "API Tool") {
                    heuristicSubtext = `${kleur.gray(`(Vagueness: ${fmt(heuristic.heuristics.semanticVagueness)}, Constraints: ${fmt(heuristic.heuristics.negativeConstraints)}, Schema: ${fmt(heuristic.heuristics.schemaStrictness || 0)})`)}`;
                } else {
                    heuristicSubtext = `${kleur.gray(`(Vagueness: ${fmt(heuristic.heuristics.semanticVagueness)}, Constraints: ${fmt(heuristic.heuristics.negativeConstraints)}, Tags: ${fmt(heuristic.heuristics.tagDensity ?? 0)}, Triggers: ${fmt(heuristic.heuristics.triggerClarity ?? 0)})`)}`;
                }

                console.log(`${kleur.green("✓")} [${kleur.bold(skill.name)}]${layerLabel} ${typeEmoji} ${kleur.blue(`<${heuristic.skillType}>`)} ${validationEmoji}`);
                console.log(`    ${kleur.cyan("Displacement:")} ${displacementText}`);
                console.log(`    ${kleur.cyan("Confidence (Heuristic):")} ${heuristicText} ${heuristicSubtext}`);
                console.log(`    ${kleur.cyan("Confidence (Sonar):")}     ${sonarText}`);

                if (showDetails) {
                    if (!heuristic.validation.isProperlyFormatted) {
                        console.log(kleur.yellow(`\n    ⚠️  Manifest Validation Warnings:`));
                        for (const err of heuristic.validation.errors) {
                            console.log(kleur.red(`       - ${err}`));
                        }
                    }

                    const h = heuristic.heuristics;
                    console.log("");
                    console.log(kleur.bold().cyan(`    📋 Heuristic Breakdown for ${skill.name}`));
                    console.log(kleur.gray("    ─────────────────────────────────────"));

                    if (heuristic.skillType === "API Tool") {
                        printDetailRow("Vagueness", fmt(h.semanticVagueness),
                            "Measures description clarity. Short (<50 chars) or generic verb-heavy descriptions reduce the score.");
                        printDetailRow("Constraints", fmt(h.negativeConstraints),
                            "Boundary phrases like 'only use this when' or 'do not use' help the LLM know when NOT to trigger.");
                        printDetailRow("Schema", fmt(h.schemaStrictness || 0),
                            "Presence of triggers, enums, regex patterns, or strict parameter schemas tighten invocation rules.");
                    } else {
                        printDetailRow("Vagueness", fmt(h.semanticVagueness),
                            "Evaluates the frontmatter description. Long, specific descriptions (>200 chars) boost the score. Short ones (<50 chars) penalize it.");
                        printDetailRow("Constraints", fmt(h.negativeConstraints),
                            "Boundary phrases like 'only use this when' or 'do not use' help the router know when NOT to dock the skill.");
                        printDetailRow("Tags", fmt(h.tagDensity ?? 0),
                            "Tag count in YAML frontmatter. 3+ tags give a strong routing anchor (+2). 1-2 tags give a smaller boost (+1).");
                        printDetailRow("Triggers", fmt(h.triggerClarity ?? 0),
                            "Looks for ## Trigger, ## Purpose, or ## Exceptions headers. 2+ sections give a massive boost (+3). These tell the router exactly when to invoke the skill.");
                    }

                    console.log(kleur.gray("    ─────────────────────────────────────"));
                    const ratingLabel = heuristic.score >= 9 ? "Excellent" : heuristic.score >= 7 ? "Good" : heuristic.score >= 5 ? "Fair" : heuristic.score >= 3 ? "Poor" : "Critical";
                    console.log(`    ${heuristicEmoji} ${kleur.bold("Rating:")} ${heuristicColor(ratingLabel)} — ${getRatingAdvice(heuristic.score)}`);
                }

                console.log("");
            } catch (err: any) {
                spinnies.fail(`fathom-${skill.name}`, { text: `Failed to fathom ${skill.name}: ${err.message}` });
            }
        }

        if (!showReport) {
            console.log(`\n${kleur.gray("Heuristic Tip: Skills with low scores (1-2) have a 'Massive Wake' and are likely to be triggered accidentally by LLMs.")}`);
            if (!showDetails) {
                console.log(kleur.gray("Use --details for a full breakdown of each heuristic."));
            }
        }
    } catch (error: any) {
        printError(`Fathom failed: ${error.message}`);
    }
}

function printDetailRow(label: string, value: string, explanation: string): void {
    const valColor = value.startsWith("+") ? kleur.green(value) : value === "0" ? kleur.gray(value) : kleur.red(value);
    console.log(`    ${kleur.bold(label.padEnd(12))} ${valColor.padEnd(5)}  ${kleur.gray(explanation)}`);
}

function getRatingAdvice(score: number): string {
    if (score >= 9) return "This skill is well-defined. The router has clear signals for when to invoke it.";
    if (score >= 7) return "Solid skill definition. Minor improvements to tags or trigger sections could push it higher.";
    if (score >= 5) return "Adequate, but could benefit from a more specific description, more tags, or explicit trigger sections.";
    if (score >= 3) return "At risk of accidental triggering. Add boundary phrases, tags, and ## Trigger / ## Purpose sections.";
    return "High false-positive risk. The LLM may invoke this skill incorrectly. Needs significant metadata improvements.";
}
