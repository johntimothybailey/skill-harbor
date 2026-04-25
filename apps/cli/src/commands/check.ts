import os from "node:os";
import path from "node:path";
import kleur from "kleur";
import Spinnies from "spinnies";
import { resolveCommandScope } from "../command-scope";
import { Orchestrator } from "../orchestrator";
import { getManifestManager, exists, getAgentBerths } from "../utils";
import { printHeader, printError, printInfo } from "../ui";
import { ProfilerService } from "../services/profiler";

export async function checkAction(options: any, command: any) {
    const opts = command.opts();
    const manifestManager = getManifestManager(opts);
    const baseDir = opts.global ? os.homedir() : process.cwd();
    const spinnies = new Spinnies();
    const profiler = new ProfilerService();
    let hasFailures = false;

    try {
        printHeader("Lighthouse Health Check");

        const { useGlobalScope, shouldStop } = await resolveCommandScope(opts, manifestManager, "skill-harbor check");
        if (shouldStop) return;
        
        // 1. Layered Manifest Loading
        const manifest = useGlobalScope 
            ? await manifestManager.read("global") 
            : await manifestManager.readMerged();

        const skills = manifestManager.materializeSkills(manifest);

        if (skills.length === 0) {
            printInfo("Empty Harbor", "No skills found in the manifest stack to check.");
            return;
        }

        // 2. Override Warnings
        if (!useGlobalScope && manifest.overrides && manifest.overrides.length > 0) {
            console.log(kleur.yellow(`\n⚠️  Overrides Active: The following skills are being overridden by personal definitions in harbor-manifest.overrides.json:`));
            manifest.overrides.forEach((name: string) => console.log(kleur.yellow(`   - ${name}`)));
            console.log("");
        }

        // Identify active agent targets using the utility
        const activeTargets = await getAgentBerths(useGlobalScope ? os.homedir() : baseDir, manifest.targets);

        for (const skill of skills) {
            const skillLayer = skill.layer || (useGlobalScope ? "global" : "shared");
            const cachedPath = path.join(manifestManager.getSkillsCacheDir(skillLayer), skill.name);
            const orchestrator = new Orchestrator({ skillName: skill.name, spinnies });
            
            let layerLabel = "";
            if (skill.layer === "local") layerLabel = kleur.yellow(" [Override]");
            else if (skill.layer === "global") layerLabel = kleur.gray(" [Global]");
            
            spinnies.add(`check-${skill.name}`, { text: `Auditing ${kleur.bold(skill.name)}${layerLabel}...` });
            
            // 1. Metadata Quality Check
            const meta = await orchestrator.getMetadata(cachedPath);
            const isDiscoverable = meta && meta.description && meta.description !== "No description provided.";
            const metaStatus = isDiscoverable 
                ? kleur.green(`📡 Discoverable (${meta!.description.substring(0, 40)}...)`)
                : kleur.red("📡 Blind (Missing or invalid SKILL.md)");

            const contracts = (await profiler.getContractValidation(cachedPath)) ?? {
                missingStandard: true,
                requires: {},
                produces: {},
                isValid: true,
                status: "missing" as const,
                errors: [],
                warnings: []
            };
            const contractStatus = formatContractCheckStatus(contracts);

            // 2. Berth Verification
            const mooredIn: string[] = [];
            const missingFrom: string[] = [];

            for (const target of activeTargets) {
                const skillBerthPath = path.join(target.path, skill.name);
                if (await exists(skillBerthPath)) {
                    mooredIn.push(target.label);
                } else {
                    missingFrom.push(target.label);
                }
            }

            let berthStatus = "";
            if (mooredIn.length > 0) {
                berthStatus += kleur.cyan(`⚓ Moored in: [${mooredIn.join(", ")}]`);
            }
            if (missingFrom.length > 0) {
                if (berthStatus) berthStatus += " | ";
                berthStatus += kleur.yellow(`⚠️  Missing from: [${missingFrom.join(", ")}]`);
            }
            if (mooredIn.length === 0 && missingFrom.length === 0) {
                berthStatus = kleur.gray("No active agent berths detected.");
            }

            const statusText = `[${kleur.bold(skill.name)}]${layerLabel}\n    ${metaStatus}\n    ${contractStatus}\n    ${berthStatus}`;
            const contractInvalid = contracts.status === "invalid";
            const contractMissingStrict = opts.strict && contracts.status === "missing";
            const contractWarningStrict = opts.strict && contracts.warnings.length > 0;
            const skillFailed = !isDiscoverable || missingFrom.length > 0 || contractInvalid || contractMissingStrict || contractWarningStrict;
            
            if (!skillFailed) {
                spinnies.succeed(`check-${skill.name}`, { text: statusText });
            } else {
                hasFailures = true;
                spinnies.fail(`check-${skill.name}`, { text: statusText });
            }
        }

        if (hasFailures) {
            process.exit(1);
        }
    } catch (error: any) {
        if (error?.message === "exit") {
            throw error;
        }
        printError(`Check failed: ${error.message}`);
    }
}

function formatContractCheckStatus(contracts: NonNullable<Awaited<ReturnType<ProfilerService["getContractValidation"]>>>) {
    if (contracts.status === "valid") {
        const requires = Object.keys(contracts.requires);
        const produces = Object.keys(contracts.produces);
        if (contracts.warnings.length > 0) {
            return kleur.yellow(`🤝 Contracts: warning (${contracts.warnings.join("; ")})`);
        }
        return kleur.green(`🤝 Contracts: valid${requires.length || produces.length ? ` (Requires: [${requires.join(", ") || "none"}] | Produces: [${produces.join(", ") || "none"}])` : ""}`);
    }

    if (contracts.status === "invalid") {
        return kleur.red(`🤝 Contracts: invalid (${contracts.errors.join("; ")})`);
    }

    return kleur.yellow("🤝 Contracts: missing");
}
