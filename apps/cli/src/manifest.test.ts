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

    it("prefers the overrides manifest path for the project-personal layer", async () => {
        const manager = new ManifestManager({ cwd: workspaceDir });

        await manager.init();

        expect(manager.getOverridesPath()).toBe(path.join(workspaceDir, ".harbor", "harbor-manifest.overrides.json"));
        expect(manager.getLocalPath()).toBe(path.join(workspaceDir, ".harbor", "harbor-manifest.overrides.json"));
    });

    it("migrates a legacy local manifest filename to the overrides manifest path", async () => {
        const legacyPath = path.join(workspaceDir, "harbor-manifest.local.json");
        const preferredPath = path.join(workspaceDir, ".harbor", "harbor-manifest.overrides.json");
        await fs.writeFile(
            legacyPath,
            JSON.stringify({
                version: "1.0",
                dependencies: {},
                skills: {
                    localSkill: {
                        name: "localSkill",
                        source: "./skill",
                        localPath: ""
                    }
                }
            }),
            "utf-8"
        );

        const manager = new ManifestManager({ cwd: workspaceDir });
        const messages: string[] = [];

        const migrated = await manager.migrateLegacyOverrides((message) => messages.push(message));

        expect(migrated).toBe(true);
        expect(await pathExists(legacyPath)).toBe(false);
        expect(await pathExists(preferredPath)).toBe(true);
        expect(messages[0]).toContain("harbor-manifest.overrides.json");
        expect(messages[0]).toContain("local filesystem skill sources");
    });

    it("materializes generated children from folder-backed sources for operational commands", () => {
        const manager = new ManifestManager({ cwd: workspaceDir });
        const manifest = {
            version: "1.0",
            dependencies: {},
            skills: {
                rulesyncFolder: {
                    name: "rulesyncFolder",
                    source: "./.rulesync/skills",
                    sourceType: "folder" as const,
                    localPath: "",
                    layer: "shared" as const,
                    generatedChildren: [
                        {
                            name: "team-skill",
                            source: "/workspace/.rulesync/skills/team-skill",
                            localPath: "/workspace/.harbor/skills/team-skill",
                        }
                    ]
                }
            }
        };

        const materialized = manager.materializeSkills(manifest as any);

        expect(materialized).toHaveLength(1);
        expect(materialized[0]).toMatchObject({
            name: "team-skill",
            source: "/workspace/.rulesync/skills/team-skill",
            managedBy: "rulesyncFolder",
            collectionRoot: "./.rulesync/skills",
            generated: true
        });
    });
});
