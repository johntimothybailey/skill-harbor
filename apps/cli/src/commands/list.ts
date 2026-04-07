import kleur from "kleur";
import { getManifestManager } from "../utils";
import { printHeader, printError } from "../ui";

export async function listAction(options: any, command: any) {
    const opts = command.opts();
    const manifestManager = getManifestManager(opts);
    try {
        const manifest = await manifestManager.read();
        const skills = Object.values(manifest.skills);

        printHeader(`${opts.global ? "Global" : "Local"} Fleet Manifest`);
        if (skills.length === 0) {
            console.log(kleur.yellow("  No skills are currently docked in this workspace.\n"));
        } else {
            for (const skill of skills) {
                console.log(`  ${kleur.green("✓")} ${kleur.bold(skill.name)} - ${kleur.gray(skill.source)}`);
            }
            console.log();
        }
    } catch (error: any) {
        printError(`Cannot read manifest. Run 'dock' first to initialize.`);
    }
}
