import { ManifestManager } from "./manifest";
import { printInfo, printSuccess, promptEmptyProjectHarborAction } from "./ui";

export async function resolveCommandScope(
    opts: any,
    manifestManager: ManifestManager,
    rerunCommand: string
): Promise<{ useGlobalScope: boolean; shouldStop: boolean }> {
    let useGlobalScope = opts.global ?? false;

    if (useGlobalScope) {
        return { useGlobalScope, shouldStop: false };
    }

    const hasProjectManifestStack = await manifestManager.hasProjectManifestStack();
    const hasGlobalManifest = await ManifestManager.globalManifestExists();

    if (!hasProjectManifestStack && hasGlobalManifest) {
        if (!process.stdin.isTTY || !process.stdout.isTTY) {
            printInfo("Using Global Harbor", "No project harbor manifest was found, and interactive prompting is unavailable. Falling back to the global harbor manifest.");
            return { useGlobalScope: true, shouldStop: false };
        }

        const action = await promptEmptyProjectHarborAction();

        if (action === "cancel") {
            return { useGlobalScope: false, shouldStop: true };
        }

        if (action === "initialize") {
            await manifestManager.write({
                version: "1.0",
                dependencies: {},
                skills: {}
            }, "shared");
            printSuccess(`Project harbor initialized at .harbor/harbor-manifest.json. Add skills with 'skill-harbor dock <source>' and rerun '${rerunCommand}'.`);
            return { useGlobalScope: false, shouldStop: true };
        }

        useGlobalScope = true;
    }

    return { useGlobalScope, shouldStop: false };
}
