import os from "node:os";
import path from "node:path";
import kleur from "kleur";
import Spinnies from "spinnies";
import { Orchestrator } from "../orchestrator";
import { getManifestManager, exists } from "../utils";
import { printHeader, printError, printInfo } from "../ui";

export async function checkAction(options: any, command: any) {
    const opts = command.opts();
    const manifestManager = getManifestManager(opts);
    const baseDir = opts.global ? os.homedir() : process.cwd();
    const spinnies = new Spinnies();

    try {
        printHeader("Lighthouse Health Check");
        const manifest = await manifestManager.read();
        const skills = Object.values(manifest.skills);

        if (skills.length === 0) {
            printInfo("Empty Harbor", "No skills found in the manifest to check.");
            return;
        }

        // Identify active agent targets (Same logic as 'up' command)
        const hasExplicitTargets = Array.isArray(manifest.targets) && manifest.targets.length > 0;
        const targetConfigs = [
            { path: path.join(baseDir, ".claude", "skills"), label: "Claude", key: "claude" },
            { path: path.join(baseDir, ".cursor", "rules"), label: "Cursor", key: "cursor" },
            { path: path.join(baseDir, ".antigravity", "skills"), label: "Antigravity", key: "antigravity" }
        ];
        
        const rulesyncBase = path.join(os.homedir(), ".rulesync", "skills");
        targetConfigs.push({ path: rulesyncBase, label: "Rulesync", key: "rulesync" });

        const activeTargets = [];
        for (const target of targetConfigs) {
            const isActive = hasExplicitTargets 
                ? manifest.targets!.includes(target.key)
                : (target.key === "rulesync" ? await exists(rulesyncBase) : (opts.global ? await exists(path.dirname(target.path)) : await exists(path.join(process.cwd(), path.basename(path.dirname(target.path)))) || await exists(target.path)));
            
            // Simplified active check for 'check' command to match environment
            const envExists = opts.global 
                ? await exists(path.dirname(target.path))
                : await exists(path.join(process.cwd(), "." + target.key));

            if (isActive || envExists) {
                activeTargets.push(target);
            }
        }

        for (const skill of skills) {
            const cachedPath = path.join(manifestManager.getHarborDir(), skill.name);
            const orchestrator = new Orchestrator({ skillName: skill.name, spinnies });
            
            spinnies.add(`check-${skill.name}`, { text: `Auditing ${kleur.bold(skill.name)}...` });
            
            // 1. Metadata Quality Check
            const meta = await orchestrator.getMetadata(cachedPath);
            const isDiscoverable = meta && meta.description && meta.description !== "No description provided.";
            const metaStatus = isDiscoverable 
                ? kleur.green(`📡 Discoverable (${meta!.description.substring(0, 40)}...)`)
                : kleur.red("📡 Blind (Missing or invalid SKILL.md)");

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

            const statusText = `[${kleur.bold(skill.name)}]\n    ${metaStatus}\n    ${berthStatus}`;
            
            if (isDiscoverable && missingFrom.length === 0) {
                spinnies.succeed(`check-${skill.name}`, { text: statusText });
            } else {
                spinnies.fail(`check-${skill.name}`, { text: statusText });
            }
        }
    } catch (error: any) {
        printError(`Check failed: ${error.message}`);
    }
}
