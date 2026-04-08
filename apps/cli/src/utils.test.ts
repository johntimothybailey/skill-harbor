import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getAgentBerths, getManagedAgentTargets, getStowageBerths } from "./utils";

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
        expect(targets.find(target => target.key === "codex")?.path).toBe(path.join(tempDir, ".agents", "skills"));
    });

    it("detects a local Codex berth when .agents/skills exists", async () => {
        await fs.mkdir(path.join(tempDir, ".agents", "skills"), { recursive: true });

        const targets = await getAgentBerths(tempDir);

        expect(targets.map(target => target.key)).toContain("codex");
    });

    it("detects Codex stowage when codex stowage exists", async () => {
        await fs.mkdir(path.join(tempDir, ".harbor", "stowage", "codex"), { recursive: true });

        const targets = await getStowageBerths(tempDir);

        expect(targets.map(target => target.key)).toContain("codex");
    });
});
