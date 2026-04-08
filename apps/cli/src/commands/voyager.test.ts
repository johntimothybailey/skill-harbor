import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import { voyagerAction } from "./voyager";
import { resolveCommandScope } from "../command-scope";
import { getAgentBerths, getManifestManager, ask } from "../utils";
import { ConfigManager } from "../services/config";
import { ProfilerService } from "../services/profiler";
import { printSuccess } from "../ui";

vi.mock("node:fs/promises");
vi.mock("node:os");
vi.mock("../command-scope");
vi.mock("../utils");
vi.mock("../services/config");
vi.mock("../services/profiler");
vi.mock("../ui");
vi.mock("spinnies");
vi.mock("js-yaml", () => ({
    default: {
        load: vi.fn()
    }
}));
vi.mock("gray-matter", () => ({
    default: vi.fn()
}));

describe("voyagerAction", () => {
    let mockManifestManager: any;
    let mockProfiler: any;
    let mockConfigManager: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockManifestManager = {
            read: vi.fn().mockResolvedValue({ targets: [], skills: {} }),
            readMerged: vi.fn().mockResolvedValue({ targets: [], skills: {} }),
            addSkill: vi.fn().mockResolvedValue(undefined)
        };

        mockProfiler = {
            findSkills: vi.fn().mockResolvedValue([])
        };

        mockConfigManager = {
            loadConfig: vi.fn().mockResolvedValue({
                sonar: { apiKey: "key", model: "gpt-test", baseUrl: "https://example.test" }
            })
        };

        (resolveCommandScope as any).mockResolvedValue({ useGlobalScope: false, shouldStop: false });
        (getManifestManager as any).mockReturnValue(mockManifestManager);
        (getAgentBerths as any).mockResolvedValue([]);
        (ConfigManager.getInstance as any).mockReturnValue(mockConfigManager);
        (ProfilerService as any).mockImplementation(function() {
            return mockProfiler;
        });
        (ask as any).mockResolvedValue(false);
        (os.homedir as any).mockReturnValue("/home/user");
        vi.spyOn(process, "exit").mockImplementation(() => {
            throw new Error("exit");
        });
    });

    it("uses the global manifest when scope resolution selects global", async () => {
        const options = {};
        const mockCommand = { opts: vi.fn().mockReturnValue(options) };
        (resolveCommandScope as any).mockResolvedValue({ useGlobalScope: true, shouldStop: false });

        await expect(voyagerAction("test query", options, mockCommand)).rejects.toThrow("exit");

        expect(mockManifestManager.read).toHaveBeenCalledWith("global");
        expect(getAgentBerths).toHaveBeenCalledWith("/home/user", undefined);
    });

    it("stops immediately when scope resolution says to stop", async () => {
        const options = {};
        const mockCommand = { opts: vi.fn().mockReturnValue(options) };
        (resolveCommandScope as any).mockResolvedValue({ useGlobalScope: false, shouldStop: true });

        await voyagerAction("test query", options, mockCommand);

        expect(mockConfigManager.loadConfig).not.toHaveBeenCalled();
        expect(mockManifestManager.readMerged).not.toHaveBeenCalled();
        expect(getAgentBerths).not.toHaveBeenCalled();
    });

    it("docks discovered ghosts into the global manifest when using global scope", async () => {
        const options = {};
        const mockCommand = { opts: vi.fn().mockReturnValue(options) };
        (resolveCommandScope as any).mockResolvedValue({ useGlobalScope: true, shouldStop: false });
        mockManifestManager.read.mockResolvedValue({ targets: ["codex"], skills: {} });
        (getAgentBerths as any).mockResolvedValue([{ path: "/home/user/.agents/skills", label: "Codex", key: "codex" }]);
        mockProfiler.findSkills
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce(["/home/user/manual-skill"]);
        (ask as any).mockResolvedValue(true);

        await expect(voyagerAction("test query", options, mockCommand)).rejects.toThrow("exit");

        expect(mockManifestManager.addSkill).toHaveBeenCalledWith(
            expect.objectContaining({ name: "manual-skill", source: "/home/user/manual-skill" }),
            "global"
        );
        expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining("All ghosts berthed"));
    });
});
