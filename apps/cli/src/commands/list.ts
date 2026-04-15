import kleur from "kleur";
import { resolveCommandScope } from "../command-scope";
import { getManifestManager } from "../utils";
import { printHeader, printError } from "../ui";

export async function listAction(options: any, command: any) {
    const opts = command.opts();
    const manifestManager = getManifestManager(opts);
    try {
        const { useGlobalScope, shouldStop } = await resolveCommandScope(opts, manifestManager, "skill-harbor list");
        if (shouldStop) return;

        const manifest = useGlobalScope
            ? await manifestManager.read("global")
            : await manifestManager.read();
        const skills = Object.values(manifest.skills);

        printHeader(`${useGlobalScope ? "Global" : "Local"} Fleet Manifest`);
        if (skills.length === 0) {
            console.log(kleur.yellow("  No skills are currently docked in this workspace.\n"));
        } else {
            for (const skill of skills) {
                const folderLabel = skill.sourceType === "folder"
                    ? kleur.cyan(` [Folder Source${skill.generatedChildren?.length ? `: ${skill.generatedChildren.length} child skill${skill.generatedChildren.length === 1 ? "" : "s"}` : ""}]`)
                    : "";
                console.log(`  ${kleur.green("✓")} ${kleur.bold(skill.name)}${folderLabel} - ${kleur.gray(skill.source)}`);
            }
            console.log();
        }
    } catch (error: any) {
        printError(`Cannot read manifest. Run 'dock' first to initialize.`);
    }
}
