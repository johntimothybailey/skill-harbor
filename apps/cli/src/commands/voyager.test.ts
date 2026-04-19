import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import matter from "gray-matter";
import { voyagerAction } from "./voyager";
import { resolveCommandScope } from "../command-scope";
import { ask, getAgentBerths, getManifestManager } from "../utils";
import { ConfigManager } from "../services/config";
import { ProfilerService } from "../services/profiler";
import { discoverGhosts, resolveGhostScanContext, summarizeGhosts } from "../services/ghosts";
import { printSuccess } from "../ui";

vi.mock("node:fs/promises");
vi.mock("node:os");
vi.mock("../command-scope");
vi.mock("../utils");
vi.mock("../services/config");
vi.mock("../services/profiler");
vi.mock("../services/ghosts");
vi.mock("../ui");
vi.mock("spinnies", () => ({
    default: class MockSpinnies {
        add = vi.fn();
        update = vi.fn();
        succeed = vi.fn();
        fail = vi.fn();
        remove = vi.fn();
        hasActiveSpinners = vi.fn().mockReturnValue(false);
    }
}));
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
    let consoleSpy: any;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();

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
        (resolveGhostScanContext as any).mockResolvedValue({ activeBerths: [], stowageBerths: [], scanMode: "autodetect" });
        (discoverGhosts as any).mockResolvedValue([]);
        (summarizeGhosts as any).mockImplementation((ghosts: any[]) => ({
            active: ghosts.filter(ghost => !ghost.friendly),
            friendly: ghosts.filter(ghost => ghost.friendly)
        }));
        (ask as any).mockResolvedValue(false);
        Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
        Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
        (os.homedir as any).mockReturnValue("/home/user");
        (fs.readFile as any).mockResolvedValue("");
        (fs.mkdir as any).mockResolvedValue(undefined);
        (fs.writeFile as any).mockResolvedValue(undefined);
        (matter as any).mockReturnValue({ data: {} });
        consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(process, "exit").mockImplementation((() => {
            throw new Error("exit");
        }) as any);
    });

    afterEach(() => {
        consoleSpy.mockRestore();
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
        mockProfiler.findSkills.mockResolvedValue([]);
        (discoverGhosts as any).mockResolvedValue([
            { name: "manual-skill", path: "/home/user/manual-skill", friendly: false }
        ]);
        (ask as any).mockResolvedValue(true);

        await expect(voyagerAction("test query", options, mockCommand)).rejects.toThrow("exit");

        expect(mockManifestManager.addSkill).toHaveBeenCalledWith(
            expect.objectContaining({ name: "manual-skill", source: "/home/user/manual-skill" }),
            "global"
        );
        expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining("All ghosts berthed"));
    });

    it("does not prompt for ghost docking in non-interactive mode", async () => {
        const options = {};
        const mockCommand = { opts: vi.fn().mockReturnValue(options) };

        Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
        Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true });

        (getAgentBerths as any).mockResolvedValue([{ path: "/workspace/.agents/skills", label: "Codex", key: "codex" }]);
        mockProfiler.findSkills.mockResolvedValue([]);
        (discoverGhosts as any).mockResolvedValue([
            { name: "manual-skill", path: "/workspace/manual-skill", friendly: false }
        ]);

        await expect(voyagerAction("test query", options, mockCommand)).rejects.toThrow("exit");

        expect(ask).not.toHaveBeenCalled();
        expect(mockManifestManager.addSkill).not.toHaveBeenCalled();
    });

    it("runs compare mode, emits json, avoids ghost prompts for the no-skills branch, and saves traces", async () => {
        const options = { compare: true, format: "json", saveTrace: true };
        const mockCommand = { opts: vi.fn().mockReturnValue(options) };

        (getAgentBerths as any).mockResolvedValue([{ path: "/workspace/.agents/skills", label: "Codex", key: "codex" }]);
        mockProfiler.findSkills.mockResolvedValue(["/workspace/.agents/skills/tool-a"]);
        (fs.readFile as any).mockImplementation(async (filePath: string) => {
            if (filePath.endsWith("SKILL.md")) {
                return "---\nname: Tool A\ndescription: Helpful tool description that is definitely long enough.\n---";
            }
            return "";
        });
        (matter as any).mockReturnValue({
            data: {
                name: "Tool A",
                description: "Helpful tool description that is definitely long enough."
            }
        });

        const fetchMock = vi.fn()
            .mockResolvedValueOnce(makeFetchResponse({
                role: "assistant",
                content: "",
                tool_calls: [{ id: "call-1", function: { name: "ToolA", arguments: "{}" } }]
            }))
            .mockResolvedValueOnce(makeFetchResponse({
                role: "assistant",
                content: "completed with skills"
            }))
            .mockResolvedValueOnce(makeFetchResponse({
                role: "assistant",
                content: "completed without skills"
            }));
        vi.stubGlobal("fetch", fetchMock);

        await voyagerAction("test query", options, mockCommand);

        expect(ask).not.toHaveBeenCalled();
        expect(fs.mkdir).toHaveBeenCalledTimes(1);
        expect(fs.writeFile).toHaveBeenCalledWith(expect.stringContaining("with-skills.json"), expect.any(String), "utf-8");
        expect(fs.writeFile).toHaveBeenCalledWith(expect.stringContaining("without-skills.json"), expect.any(String), "utf-8");
        expect(fs.writeFile).toHaveBeenCalledWith(expect.stringContaining("summary.json"), expect.any(String), "utf-8");

        const jsonOutput = JSON.parse(consoleSpy.mock.calls.at(-1)[0]);
        expect(jsonOutput.with_skills.toolCallCount).toBe(1);
        expect(jsonOutput.without_skills.toolCallCount).toBe(0);
        expect(jsonOutput.delta.tool_count_delta).toBe(1);

        const withSkillsBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        const withoutSkillsBody = JSON.parse(fetchMock.mock.calls[2][1].body);
        expect(withSkillsBody.tools).toHaveLength(1);
        expect(withoutSkillsBody.tools).toBeUndefined();
        expect(withoutSkillsBody.tool_choice).toBeUndefined();
    });
});

function makeFetchResponse(message: any) {
    return {
        ok: true,
        json: vi.fn().mockResolvedValue({
            choices: [{ message }]
        })
    };
}
