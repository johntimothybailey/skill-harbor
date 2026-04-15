import fs from "node:fs/promises";
import path from "node:path";
import { getManifestManager } from "../utils";
import { printHeader, printSuccess, printError, printInfo } from "../ui";
import { ProfilerService } from "../services/profiler";
import { SkillSourceType } from "../manifest";

function isLocalSource(source: string): boolean {
    return source.startsWith("file://") || source.startsWith("/") || source.startsWith("./") || source.startsWith("../");
}

async function detectSourceType(source: string): Promise<SkillSourceType> {
    if (!isLocalSource(source)) {
        return "single";
    }

    const localPath = source.replace("file://", "");
    const absolutePath = path.resolve(process.cwd(), localPath);
    const stats = await fs.stat(absolutePath).catch(() => null);

    if (!stats?.isDirectory()) {
        return "single";
    }

    const rootSkillPath = path.join(absolutePath, "SKILL.md");
    const hasRootSkill = await fs.access(rootSkillPath).then(() => true).catch(() => false);
    if (hasRootSkill) {
        return "single";
    }

    const profiler = new ProfilerService();
    const foundSkills = await profiler.findSkills(absolutePath);
    return foundSkills.length > 0 ? "folder" : "single";
}

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
        const sourceType = await detectSourceType(source);

        // 3. Update Manifest
        await manifestManager.addSkill({
            name: skillName,
            source,
            sourceType,
            localPath: "", // Will be populated by the 'up' command
        }, layer);

        const manifestLabel = layer === "local"
            ? "Project Overrides Manifest (.harbor/harbor-manifest.overrides.json)"
            : (layer === "global" ? "Global User Manifest" : "Shared Project Manifest");
        printSuccess(`Skill successfully manifested! Added ${skillName} to ${manifestLabel}.`);
        if (sourceType === "folder") {
            printInfo("Folder Source Detected", "Harbor will treat this directory as a collection source and rescan it during 'up' and 'freshen'.");
        }
    } catch (error: any) {
        printError(`Major malfunction in harbor operations: ${error.message}`);
        process.exit(1);
    }
}
