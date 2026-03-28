import path from "node:path";
import kleur from "kleur";
import Spinnies from "spinnies";
import { getManifestManager, exists } from "../utils";
import { printHeader, printError, printInfo } from "../ui";
import { ProfilerService } from "../services/profiler";

export async function fathomAction(options: any, command: any) {
    const opts = command.opts();
    const manifestManager = getManifestManager(opts);
    const spinnies = new Spinnies();
    const profiler = new ProfilerService();
    const showDetails = opts.details ?? false;

    try {
        printHeader("Fathom: Skill Profiler");
        const manifest = await manifestManager.read();
        const skills = Object.values(manifest.skills);

        if (skills.length === 0) {
            printInfo("Empty Harbor", "No skills found in the manifest to fathom.");
            return;
        }

        for (const skill of skills) {
            const cachedPath = path.join(manifestManager.getHarborDir(), skill.name);
            
            if (!(await exists(cachedPath))) {
                spinnies.add(`fathom-${skill.name}`, { text: `${kleur.yellow(`[${skill.name}]`)} Skill cargo not found in harbor. Run 'up' first.` });
                spinnies.fail(`fathom-${skill.name}`);
                continue;
            }

            spinnies.add(`fathom-${skill.name}`, { text: `Fathoming ${kleur.bold(skill.name)}...` });

            const displacement = await profiler.calculateDisplacement(cachedPath);
            const draft = await profiler.calculateDraft(cachedPath);

            const displacementText = `${displacement.icon} ${kleur.bold(displacement.shipClass)} (${displacement.tokens} tokens)`;
            
            let draftColor = kleur.red;
            let draftEmoji = "🔴";
            if (draft.score > 3) { draftColor = kleur.yellow; draftEmoji = "🟠"; }
            if (draft.score > 5) { draftColor = kleur.yellow; draftEmoji = "🟡"; }
            if (draft.score > 6) { draftColor = kleur.green; draftEmoji = "🟢"; }
            if (draft.score > 8) { draftColor = kleur.green; draftEmoji = "✨"; }

            const draftText = `${draftEmoji} ${draftColor(draft.condition)} (Score: ${draft.score}/10, Wake: ${draft.wakeSize})`;

            const typeEmoji = draft.skillType === "API Tool" ? "🔧" : "🧠";

            // Invert signs for display: positive = helped score, negative = hurt score
            const fmt = (v: number) => { const inv = -v; return inv > 0 ? `+${inv}` : `${inv}`; };

            let heuristicSubtext = "";
            if (draft.skillType === "API Tool") {
                heuristicSubtext = `${kleur.gray(`(Vagueness: ${fmt(draft.heuristics.semanticVagueness)}, Constraints: ${fmt(draft.heuristics.negativeConstraints)}, Schema: ${fmt(draft.heuristics.schemaStrictness)})`)}`;
            } else {
                heuristicSubtext = `${kleur.gray(`(Vagueness: ${fmt(draft.heuristics.semanticVagueness)}, Constraints: ${fmt(draft.heuristics.negativeConstraints)}, Tags: ${fmt(draft.heuristics.tagDensity ?? 0)}, Triggers: ${fmt(draft.heuristics.triggerClarity ?? 0)})`)}`;
            }

            const statusText = `[${kleur.bold(skill.name)}] ${typeEmoji} ${kleur.blue(`<${draft.skillType}>`)}
    ${kleur.cyan("Displacement:")} ${displacementText}
    ${kleur.cyan("Draft/Wake:")}   ${draftText}
    ${heuristicSubtext}`;

            spinnies.succeed(`fathom-${skill.name}`, { text: statusText });

            if (showDetails) {
                const h = draft.heuristics;
                console.log("");
                console.log(kleur.bold().cyan(`    📋 Heuristic Breakdown for ${skill.name}`));
                console.log(kleur.gray("    ─────────────────────────────────────"));

                if (draft.skillType === "API Tool") {
                    printDetailRow("Vagueness", fmt(h.semanticVagueness),
                        "Measures description clarity. Short (<50 chars) or generic verb-heavy descriptions reduce the score.");
                    printDetailRow("Constraints", fmt(h.negativeConstraints),
                        "Boundary phrases like 'only use this when' or 'do not use' help the LLM know when NOT to trigger.");
                    printDetailRow("Schema", fmt(h.schemaStrictness),
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
                const ratingLabel = draft.score >= 9 ? "Excellent" : draft.score >= 7 ? "Good" : draft.score >= 5 ? "Fair" : draft.score >= 3 ? "Poor" : "Critical";
                console.log(`    ${draftEmoji} ${kleur.bold("Rating:")} ${draftColor(ratingLabel)} — ${getRatingAdvice(draft.score)}`);
            }

            console.log(""); // Spacing between skills
        }

        console.log(`\n${kleur.gray("Heuristic Tip: Skills with low scores (1-2) have a 'Massive Wake' and are likely to be triggered accidentally by LLMs.")}`);
        if (!showDetails) {
            console.log(kleur.gray("Use --details for a full breakdown of each heuristic."));
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
