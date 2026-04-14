import { getManifestManager } from "../utils";
import { printHeader, printSuccess, printError, printInfo } from "../ui";

export async function dockAction(source: string, options: any, command: any) {
    const opts = command.opts();
    const manifestManager = getManifestManager(opts);
    const layer = opts.override ? "local" : (opts.global ? "global" : "shared");

    try {
        printHeader("Docking Operations Initiated");

        await manifestManager.init();
        if (layer === "local") {
            await manifestManager.migrateLegacyOverrides((message: string) => {
                printInfo("Overrides Manifest Updated", message);
            });
        }

        const sourceParts = source.split("/");
        let skillName = sourceParts[sourceParts.length - 1].replace(".git", "");
        if (!skillName) skillName = `skill-${Date.now()}`;

        // 3. Update Manifest
        await manifestManager.addSkill({
            name: skillName,
            source,
            localPath: "", // Will be populated by the 'up' command
        }, layer);

        const manifestLabel = layer === "local"
            ? "Project Overrides Manifest (.harbor/harbor-manifest.overrides.json)"
            : (layer === "global" ? "Global User Manifest" : "Shared Project Manifest");
        printSuccess(`Skill successfully manifested! Added ${skillName} to ${manifestLabel}.`);
    } catch (error: any) {
        printError(`Major malfunction in harbor operations: ${error.message}`);
        process.exit(1);
    }
}
