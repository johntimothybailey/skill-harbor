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
        // 1. Layered Manifest Loading
        const manifest = opts.global 
            ? await manifestManager.read("global") 
            : await manifestManager.readMerged();

        const skills = Object.values(manifest.skills);
        const metadataList = [];

        // 2. Override Warnings
        if (!opts.global && manifest.overrides && manifest.overrides.length > 0) {
            console.log(kleur.yellow(`\n⚠️  Local Override: The following skills are being overridden by personal definitions in harbor-manifest.local.json:`));
            manifest.overrides.forEach((name: string) => console.log(kleur.yellow(`   - ${name}`)));
            console.log("");
        }

        for (const skill of skills) {
            const cachedPath = path.join(manifestManager.getHarborDir(), skill.name);
            const orchestrator = new Orchestrator({ skillName: skill.name, spinnies });
            const meta = await orchestrator.getMetadata(cachedPath);
            if (meta) {
                metadataList.push({ ...meta, layer: skill.layer });
            }
        }

        let snippet = `${kleur.yellow("Available specialized skills in this workspace stack:")}\n`;
        for (const meta of metadataList) {
            const layerTag = meta.layer === 'local' ? kleur.yellow(' [Local Override]') : '';
            snippet += `\n- ${kleur.bold(meta.name)}${layerTag}: ${meta.description}`;
            if (meta.triggers && meta.triggers.length > 0) {
                snippet += `\n  Triggers: ${meta.triggers.join(", ")}`;
            }
        }
        
        printLighthouseSnippet(snippet);
    } catch (error: any) {
        printError(`Lighthouse failed: ${error.message}`);
    }
}
