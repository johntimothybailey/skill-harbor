import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getAgentBerthLocation, getAgentBerths, getManagedAgentTargets, getStowageBerths } from "./utils";

describe("utils target discovery", () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skill-harbor-utils-"));
    });

    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it("includes Codex in managed target configs", () => {
        const targets = getManagedAgentTargets(tempDir, false);

        expect(targets.map(target => target.key)).toContain("codex");
        expect(targets.find(target => target.key === "codex")?.path).toBe(path.join(tempDir, ".codex", "skills"));
    });

    it("detects a local Codex berth when .codex/skills exists", async () => {
        await fs.mkdir(path.join(tempDir, ".codex", "skills"), { recursive: true });

        const targets = await getAgentBerths(tempDir);

        expect(targets.map(target => target.key)).toContain("codex");
        expect(targets.find(target => target.key === "codex")?.path).toBe(path.join(tempDir, ".codex", "skills"));
    });

    it("falls back to the legacy .agents/skills Codex berth when needed", async () => {
        await fs.mkdir(path.join(tempDir, ".agents", "skills"), { recursive: true });

        const targets = await getAgentBerths(tempDir);

        expect(targets.map(target => target.key)).toContain("codex");
        expect(targets.find(target => target.key === "codex")?.path).toBe(path.join(tempDir, ".agents", "skills"));
    });

    it("detects Codex stowage when codex stowage exists", async () => {
        await fs.mkdir(path.join(tempDir, ".harbor", "stowage", "codex"), { recursive: true });

        const targets = await getStowageBerths(tempDir);

        expect(targets.map(target => target.key)).toContain("codex");
    });

    it("maps active Rulesync berths to the .rulesync short location", () => {
        expect(getAgentBerthLocation({
            path: path.join(os.homedir(), ".rulesync", "skills"),
            label: "Rulesync",
            key: "rulesync"
        })).toBe(".rulesync");
    });
});
