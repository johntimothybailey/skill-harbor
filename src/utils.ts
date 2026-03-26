import fs from "node:fs/promises";
import { ManifestManager } from "./manifest";

export async function exists(path: string): Promise<boolean> {
    try {
        await fs.access(path);
        return true;
    } catch {
        return false;
    }
}

export function getManifestManager(options: any) {
    if (options.global) {
        return new ManifestManager({ customPath: ManifestManager.getGlobalPath() });
    }
    return new ManifestManager();
}
