import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ManifestManager } from "./manifest";

async function pathExists(targetPath: string): Promise<boolean> {
    try {
        await fs.access(targetPath);
        return true;
    } catch {
        return false;
    }
}

describe("ManifestManager", () => {
    let workspaceDir: string;
    let homeDir: string;

    beforeEach(async () => {
        workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "skill-harbor-workspace-"));
        homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "skill-harbor-home-"));
        vi.spyOn(os, "homedir").mockReturnValue(homeDir);
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await fs.rm(workspaceDir, { recursive: true, force: true });
        await fs.rm(homeDir, { recursive: true, force: true });
    });

    it("does not create local .harbor state when only reading merged manifests", async () => {
        await fs.mkdir(path.join(homeDir, ".harbor"), { recursive: true });
        await fs.writeFile(
            path.join(homeDir, ".harbor", "harbor-manifest.json"),
            JSON.stringify({
                version: "1.0",
                dependencies: {},
                skills: {
                    globalSkill: {
                        name: "globalSkill",
                        source: "https://github.com/example/global-skill",
                        localPath: ""
                    }
                }
            }),
            "utf-8"
        );

        const manager = new ManifestManager({ cwd: workspaceDir });
        const manifest = await manager.readMerged();

        expect(Object.keys(manifest.skills)).toEqual(["globalSkill"]);
        expect(manifest.skills.globalSkill.layer).toBe("global");
        expect(await pathExists(path.join(workspaceDir, ".harbor"))).toBe(false);
    });

    it("returns a global cache dir for global-layer skills", () => {
        const manager = new ManifestManager({ cwd: workspaceDir });

        expect(manager.getSkillsCacheDir("shared")).toBe(path.join(workspaceDir, ".harbor", "skills"));
        expect(manager.getSkillsCacheDir("local")).toBe(path.join(workspaceDir, ".harbor", "skills"));
        expect(manager.getSkillsCacheDir("global")).toBe(path.join(homeDir, ".harbor", "skills"));
    });
});
