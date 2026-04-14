import path from "node:path";
import kleur from "kleur";
import Spinnies from "spinnies";
import { resolveCommandScope } from "../command-scope";
import { Orchestrator } from "../orchestrator";
import { getManifestManager } from "../utils";
import { printHeader, printError, printLighthouseSnippet } from "../ui";

export async function lighthouseAction(options: any, command: any) {
    const opts = command.opts();
    const manifestManager = getManifestManager(opts);
    const spinnies = new Spinnies();

    try {
        printHeader("Lighthouse Intelligence Snippet");

        const { useGlobalScope, shouldStop } = await resolveCommandScope(opts, manifestManager, "skill-harbor lighthouse");
        if (shouldStop) return;
        
        // 1. Layered Manifest Loading
        const manifest = useGlobalScope 
            ? await manifestManager.read("global") 
            : await manifestManager.readMerged();

        const skills = Object.values(manifest.skills);
        const metadataList = [];

        // 2. Override Warnings
        if (!useGlobalScope && manifest.overrides && manifest.overrides.length > 0) {
            console.log(kleur.yellow(`\n⚠️  Overrides Active: The following skills are being overridden by personal definitions in harbor-manifest.overrides.json:`));
            manifest.overrides.forEach((name: string) => console.log(kleur.yellow(`   - ${name}`)));
            console.log("");
        }

        for (const skill of skills) {
            const skillLayer = skill.layer || (useGlobalScope ? "global" : "shared");
            const cachedPath = path.join(manifestManager.getSkillsCacheDir(skillLayer), skill.name);
            const orchestrator = new Orchestrator({ skillName: skill.name, spinnies });
            const meta = await orchestrator.getMetadata(cachedPath);
            if (meta) {
                metadataList.push({ ...meta, layer: skill.layer });
            }
        }

        let snippet = `${kleur.yellow("Available specialized skills in this workspace stack:")}\n`;
        for (const meta of metadataList) {
            const layerTag = meta.layer === 'local' ? kleur.yellow(' [Override]') : '';
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
