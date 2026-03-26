import { getManifestManager } from "../utils";
import { printHeader, printSuccess, printError } from "../ui";

export async function dockAction(url: string, options: any, command: any) {
    const opts = command.opts();
    const manifestManager = getManifestManager(opts);

    try {
        printHeader("Docking Operations Initiated");

        await manifestManager.init();

        const urlParts = url.split("/");
        let skillName = urlParts[urlParts.length - 1].replace(".git", "");
        if (!skillName) skillName = `skill-${Date.now()}`;

        // 3. Update Manifest
        await manifestManager.addSkill({
            name: skillName,
            source: url,
            localPath: "", // Will be populated by the 'up' command
        });

        printSuccess(`Skill successfully manifested! Added ${skillName}.`);
    } catch (error: any) {
        printError(`Major malfunction in harbor operations: ${error.message}`);
        process.exit(1);
    }
}
