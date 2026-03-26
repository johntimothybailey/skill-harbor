import path from "node:path";
import kleur from "kleur";
import Spinnies from "spinnies";
import { Orchestrator } from "../orchestrator";
import { getManifestManager } from "../utils";
import { printError, printLighthouseSnippet } from "../ui";

export async function lighthouseAction(options: any, command: any) {
    const opts = command.opts();
    const manifestManager = getManifestManager(opts);
    const spinnies = new Spinnies();

    try {
        const manifest = await manifestManager.read();
        const skills = Object.values(manifest.skills);
        const metadataList = [];

        for (const skill of skills) {
            const cachedPath = path.join(manifestManager.getHarborDir(), skill.name);
            const orchestrator = new Orchestrator({ skillName: skill.name, spinnies });
            const meta = await orchestrator.getMetadata(cachedPath);
            if (meta) metadataList.push(meta);
        }

        let snippet = `${kleur.yellow("Available specialized skills in this workspace:")}\n`;
        for (const meta of metadataList) {
            snippet += `\n- ${kleur.bold(meta.name)}: ${meta.description}`;
            if (meta.triggers.length > 0) {
                snippet += `\n  Triggers: ${meta.triggers.join(", ")}`;
            }
        }
        
        printLighthouseSnippet(snippet);
    } catch (error: any) {
        printError(`Lighthouse failed: ${error.message}`);
    }
}
