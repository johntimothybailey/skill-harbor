import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { discoverGhosts, resolveGhostScanContext } from "./ghosts";

describe("discoverGhosts", () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skill-harbor-ghosts-"));
    });

    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it("scans the current Codex berth path for ghost skills", async () => {
        const codexSkillsDir = path.join(tempDir, ".codex", "skills");
        await fs.mkdir(codexSkillsDir, { recursive: true });

        const profiler = {
            findSkills: vi.fn().mockImplementation(async (dirPath: string) => {
                if (dirPath === codexSkillsDir) {
                    return [path.join(codexSkillsDir, "ghost-skill")];
                }

                return [];
            })
        };

        const ghosts = await discoverGhosts({
            baseDir: tempDir,
            manifestManager: {
                materializeSkills: () => []
            } as any,
            manifest: {
                skills: {}
            } as any,
            scanContext: await resolveGhostScanContext({
                baseDir: tempDir,
                scanMode: "autodetect"
            }),
            profiler: profiler as any
        });

        expect(profiler.findSkills).toHaveBeenCalledWith(codexSkillsDir);
        expect(ghosts).toEqual([
            expect.objectContaining({
                name: "ghost-skill",
                path: path.join(codexSkillsDir, "ghost-skill"),
                berthLabel: "Codex",
                berthLocation: ".codex",
                location: "berth",
                friendly: false
            })
        ]);
    });

    it("returns no berths for targets-only when no manifest targets are declared", async () => {
        const codexSkillsDir = path.join(tempDir, ".codex", "skills");
        await fs.mkdir(codexSkillsDir, { recursive: true });

        const scanContext = await resolveGhostScanContext({
            baseDir: tempDir,
            targets: [],
            scanMode: "targets-only"
        });

        expect(scanContext.activeBerths).toEqual([]);
        expect(scanContext.stowageBerths).toEqual([]);
    });

    it("limits targets-only scans to the selected manifest targets", async () => {
        const codexSkillsDir = path.join(tempDir, ".codex", "skills");
        const claudeSkillsDir = path.join(tempDir, ".claude", "skills");
        await fs.mkdir(codexSkillsDir, { recursive: true });
        await fs.mkdir(claudeSkillsDir, { recursive: true });

        const profiler = {
            findSkills: vi.fn().mockImplementation(async (dirPath: string) => {
                if (dirPath === codexSkillsDir) {
                    return [path.join(codexSkillsDir, "codex-ghost")];
                }

                if (dirPath === claudeSkillsDir) {
                    return [path.join(claudeSkillsDir, "claude-ghost")];
                }

                return [];
            })
        };

        const scanContext = await resolveGhostScanContext({
            baseDir: tempDir,
            targets: ["claude"],
            scanMode: "targets-only"
        });
        const ghosts = await discoverGhosts({
            baseDir: tempDir,
            manifestManager: {
                materializeSkills: () => []
            } as any,
            manifest: {
                skills: {},
                targets: ["claude"]
            } as any,
            scanContext,
            profiler: profiler as any
        });

        expect(scanContext.activeBerths.map(berth => berth.label)).toEqual(["Claude"]);
        expect(profiler.findSkills).toHaveBeenCalledWith(claudeSkillsDir);
        expect(profiler.findSkills).not.toHaveBeenCalledWith(codexSkillsDir);
        expect(ghosts).toEqual([
            expect.objectContaining({
                name: "claude-ghost",
                berthLabel: "Claude",
                location: "berth"
            })
        ]);
    });

    it("includes both .codex and legacy .agents Codex berths in autodetect scans", async () => {
        const codexSkillsDir = path.join(tempDir, ".codex", "skills");
        const legacyCodexSkillsDir = path.join(tempDir, ".agents", "skills");
        await fs.mkdir(codexSkillsDir, { recursive: true });
        await fs.mkdir(legacyCodexSkillsDir, { recursive: true });

        const profiler = {
            findSkills: vi.fn().mockImplementation(async (dirPath: string) => {
                if (dirPath === codexSkillsDir) {
                    return [path.join(codexSkillsDir, "modern-codex-ghost")];
                }

                if (dirPath === legacyCodexSkillsDir) {
                    return [path.join(legacyCodexSkillsDir, "legacy-codex-ghost")];
                }

                return [];
            })
        };

        const scanContext = await resolveGhostScanContext({
            baseDir: tempDir,
            scanMode: "autodetect"
        });
        const ghosts = await discoverGhosts({
            baseDir: tempDir,
            manifestManager: {
                materializeSkills: () => []
            } as any,
            manifest: {
                skills: {}
            } as any,
            scanContext,
            profiler: profiler as any
        });

        expect(scanContext.activeBerths.filter(berth => berth.key === "codex").map(berth => berth.path)).toEqual([
            codexSkillsDir,
            legacyCodexSkillsDir
        ]);
        expect(scanContext.activeBerths.filter(berth => berth.key === "codex").map(berth => berth.label)).toEqual([
            "Codex",
            "Codex"
        ]);
        expect(ghosts).toEqual([
            expect.objectContaining({
                name: "legacy-codex-ghost",
                berthLabel: "Codex",
                berthLocation: ".agents"
            }),
            expect.objectContaining({
                name: "modern-codex-ghost",
                berthLabel: "Codex",
                berthLocation: ".codex"
            })
        ]);
    });

    it("does not widen an empty targets-only context back into autodetect", async () => {
        const codexSkillsDir = path.join(tempDir, ".codex", "skills");
        await fs.mkdir(codexSkillsDir, { recursive: true });

        const profiler = {
            findSkills: vi.fn().mockResolvedValue([path.join(codexSkillsDir, "ghost-skill")])
        };

        const ghosts = await discoverGhosts({
            baseDir: tempDir,
            manifestManager: {
                materializeSkills: () => []
            } as any,
            manifest: {
                skills: {},
                targets: []
            } as any,
            scanContext: {
                activeBerths: [],
                stowageBerths: [],
                scanMode: "targets-only"
            },
            profiler: profiler as any
        });

        expect(profiler.findSkills).not.toHaveBeenCalled();
        expect(ghosts).toEqual([]);
    });
});
