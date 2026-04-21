import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import matter from "gray-matter";
import yaml from "js-yaml";
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
        vi.mocked(yaml.load as any).mockReset();
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

    it("loads a valid benchmark pack, skips live setup, and emits pack json", async () => {
        const options = { file: "pack.yaml", format: "json" };
        const mockCommand = { opts: vi.fn().mockReturnValue(options) };
        vi.mocked(yaml.load as any).mockReturnValue(buildValidPack());

        await voyagerAction(undefined, options, mockCommand);

        expect(resolveCommandScope).not.toHaveBeenCalled();
        expect(mockConfigManager.loadConfig).not.toHaveBeenCalled();
        expect(getAgentBerths).not.toHaveBeenCalled();
        expect(discoverGhosts).not.toHaveBeenCalled();

        const jsonOutput = JSON.parse(consoleSpy.mock.calls.at(-1)[0]);
        expect(jsonOutput.kind).toBe("harbor.voyager.benchmark-pack.result");
        expect(jsonOutput.pass).toBe(true);
        expect(jsonOutput.totals.scenarios_total).toBe(1);
    });

    it("saves benchmark pack artifacts with the expected layout", async () => {
        const options = { file: "pack.yaml", format: "json", saveTrace: true };
        const mockCommand = { opts: vi.fn().mockReturnValue(options) };
        vi.mocked(yaml.load as any).mockReturnValue(buildValidPack());

        await voyagerAction(undefined, options, mockCommand);

        expect(fs.writeFile).toHaveBeenCalledWith(expect.stringContaining("summary.json"), expect.any(String), "utf-8");
        expect(fs.writeFile).toHaveBeenCalledWith(expect.stringContaining("scenarios/basic-pack-scenario/with-skills.json"), expect.any(String), "utf-8");
        expect(fs.writeFile).toHaveBeenCalledWith(expect.stringContaining("scenarios/basic-pack-scenario/without-skills.json"), expect.any(String), "utf-8");
        expect(fs.writeFile).toHaveBeenCalledWith(expect.stringContaining("scenarios/basic-pack-scenario/summary.json"), expect.any(String), "utf-8");
    });

    it("fails a pack when a scenario fails", async () => {
        const options = { file: "pack.yaml", format: "json" };
        const mockCommand = { opts: vi.fn().mockReturnValue(options) };
        const pack = buildValidPack();
        pack.scenarios[0].assertions.with_skills.assert_status = "failed";
        vi.mocked(yaml.load as any).mockReturnValue(pack);

        await expect(voyagerAction(undefined, options, mockCommand)).rejects.toThrow("exit");
    });

    it.each([
        ["missing kind", (() => { const pack = buildValidPack(); delete pack.kind; return pack; })()],
        ["wrong kind", (() => { const pack = buildValidPack(); pack.kind = "wrong.kind"; return pack; })()],
        ["unsupported version", (() => { const pack = buildValidPack(); pack.version = 2; return pack; })()],
        ["missing pack id", (() => { const pack = buildValidPack(); delete pack.pack.id; return pack; })()],
        ["invalid scenario id", (() => { const pack = buildValidPack(); pack.scenarios[0].id = "Bad Id"; return pack; })()],
        ["duplicate scenario ids", (() => { const pack = buildValidPack(); pack.scenarios.push({ ...pack.scenarios[0] }); return pack; })()],
        ["missing with_skills fixture", (() => { const pack = buildValidPack(); delete pack.scenarios[0].fixtures.with_skills; return pack; })()],
        ["missing without_skills fixture", (() => { const pack = buildValidPack(); delete pack.scenarios[0].fixtures.without_skills; return pack; })()]
    ])("fails validation for %s", async (_label, invalidPack) => {
        const options = { file: "pack.yaml", format: "json" };
        const mockCommand = { opts: vi.fn().mockReturnValue(options) };
        vi.mocked(yaml.load as any).mockReturnValue(invalidPack);

        await expect(voyagerAction(undefined, options, mockCommand)).rejects.toThrow("exit");
        expect(resolveCommandScope).not.toHaveBeenCalled();
        expect(mockConfigManager.loadConfig).not.toHaveBeenCalled();
    });

    it("fails validation when minimum fixture fields are missing", async () => {
        const options = { file: "pack.yaml", format: "json" };
        const mockCommand = { opts: vi.fn().mockReturnValue(options) };
        const pack = buildValidPack();
        delete pack.scenarios[0].fixtures.with_skills.trace_sequence;
        vi.mocked(yaml.load as any).mockReturnValue(pack);

        await expect(voyagerAction(undefined, options, mockCommand)).rejects.toThrow("exit");
    });

    it("passes expect_assertion_improved delta assertion when with-skills improves", async () => {
        const options = { file: "pack.yaml", format: "json" };
        const mockCommand = { opts: vi.fn().mockReturnValue(options) };
        const pack = buildValidPack();
        pack.scenarios[0].assertions.delta = { expect_assertion_improved: true };
        vi.mocked(yaml.load as any).mockReturnValue(pack);

        await voyagerAction(undefined, options, mockCommand);

        const jsonOutput = JSON.parse(consoleSpy.mock.calls.at(-1)[0]);
        expect(jsonOutput.scenarios[0].delta.assertion_improved).toBe(true);
    });

    it("fails expect_assertion_improved delta assertion when there is no improvement", async () => {
        const options = { file: "pack.yaml", format: "json" };
        const mockCommand = { opts: vi.fn().mockReturnValue(options) };
        const pack = buildValidPack();
        pack.scenarios[0].fixtures.without_skills.status = "completed";
        pack.scenarios[0].assertions.delta = { expect_assertion_improved: true };
        vi.mocked(yaml.load as any).mockReturnValue(pack);

        await expect(voyagerAction(undefined, options, mockCommand)).rejects.toThrow("exit");
    });

    it("passes and fails expect_status_changed delta assertions appropriately", async () => {
        const passOptions = { file: "pack-pass.yaml", format: "json" };
        const passCommand = { opts: vi.fn().mockReturnValue(passOptions) };
        const passingPack = buildValidPack();
        passingPack.scenarios[0].assertions.delta = { expect_status_changed: true };
        vi.mocked(yaml.load as any).mockReturnValueOnce(passingPack);
        await voyagerAction(undefined, passOptions, passCommand);

        const failOptions = { file: "pack-fail.yaml", format: "json" };
        const failCommand = { opts: vi.fn().mockReturnValue(failOptions) };
        const failingPack = buildValidPack();
        failingPack.scenarios[0].fixtures.without_skills.status = "completed";
        failingPack.scenarios[0].assertions.delta = { expect_status_changed: true };
        vi.mocked(yaml.load as any).mockReturnValueOnce(failingPack);
        await expect(voyagerAction(undefined, failOptions, failCommand)).rejects.toThrow("exit");
    });

    it("passes and fails expect_status_summary delta assertions appropriately", async () => {
        const passOptions = { file: "pack-pass.yaml", format: "json" };
        const passCommand = { opts: vi.fn().mockReturnValue(passOptions) };
        const passingPack = buildValidPack();
        passingPack.scenarios[0].assertions.delta = { expect_status_summary: "failed -> completed" };
        vi.mocked(yaml.load as any).mockReturnValueOnce(passingPack);
        await voyagerAction(undefined, passOptions, passCommand);

        const failOptions = { file: "pack-fail.yaml", format: "json" };
        const failCommand = { opts: vi.fn().mockReturnValue(failOptions) };
        const failingPack = buildValidPack();
        failingPack.scenarios[0].assertions.delta = { expect_status_summary: "completed -> completed" };
        vi.mocked(yaml.load as any).mockReturnValueOnce(failingPack);
        await expect(voyagerAction(undefined, failOptions, failCommand)).rejects.toThrow("exit");
    });

    it("enforces eq/gte/lte comparator assertions for each delta metric", async () => {
        const comparatorCases = [
            { label: "tool", field: "expect_tool_count_delta", pass: { eq: 1 }, fail: { eq: 2 } },
            { label: "iteration", field: "expect_iteration_delta", pass: { gte: 1 }, fail: { lte: 0 } },
            { label: "elapsed", field: "expect_elapsed_ms_delta", pass: { lte: 80 }, fail: { gte: 100 } }
        ] as const;

        for (const comparatorCase of comparatorCases) {
            const passOptions = { file: `pack-pass-${comparatorCase.label}.yaml`, format: "json" };
            const passCommand = { opts: vi.fn().mockReturnValue(passOptions) };
            const passingPack = buildValidPack();
            passingPack.scenarios[0].assertions.delta = { [comparatorCase.field]: comparatorCase.pass };
            vi.mocked(yaml.load as any).mockReturnValueOnce(passingPack);
            await voyagerAction(undefined, passOptions, passCommand);

            const failOptions = { file: `pack-fail-${comparatorCase.label}.yaml`, format: "json" };
            const failCommand = { opts: vi.fn().mockReturnValue(failOptions) };
            const failingPack = buildValidPack();
            failingPack.scenarios[0].assertions.delta = { [comparatorCase.field]: comparatorCase.fail };
            vi.mocked(yaml.load as any).mockReturnValueOnce(failingPack);
            await expect(voyagerAction(undefined, failOptions, failCommand)).rejects.toThrow("exit");
        }
    });
});

function buildValidPack() {
    return {
        kind: "harbor.voyager.benchmark-pack",
        version: 1,
        pack: {
            id: "basic-pack",
            name: "Basic Pack"
        },
        scenarios: [
            {
                id: "basic-pack-scenario",
                name: "Basic Scenario",
                query: "Check a workflow with and without skills.",
                fixtures: {
                    with_skills: makeOfflineFixture({
                        status: "completed",
                        final_answer: "done with skills",
                        iterations: 2,
                        elapsed_ms: 120,
                        available_tool_count: 1,
                        trace_sequence: ["ToolA"],
                        trace: [
                            { role: "system", content: "system" },
                            { role: "user", content: "user" },
                            { role: "assistant", content: "" },
                            { role: "tool", toolName: "ToolA", content: "ok" },
                            { role: "assistant", content: "done with skills" }
                        ]
                    }),
                    without_skills: makeOfflineFixture({
                        status: "failed",
                        final_answer: "done without skills",
                        iterations: 1,
                        elapsed_ms: 40,
                        available_tool_count: 0,
                        trace_sequence: [],
                        trace: [
                            { role: "system", content: "system" },
                            { role: "user", content: "user" },
                            { role: "assistant", content: "done without skills" }
                        ]
                    })
                },
                assertions: {
                    with_skills: {
                        expected_tools: ["ToolA"],
                        assert_final_contains: ["done"],
                        assert_status: "completed"
                    },
                    without_skills: {
                        assert_status: "failed"
                    },
                    delta: {
                        expect_assertion_improved: true,
                        expect_status_changed: true,
                        expect_status_summary: "failed -> completed",
                        expect_tool_count_delta: { eq: 1 },
                        expect_iteration_delta: { eq: 1 },
                        expect_elapsed_ms_delta: { eq: 80 }
                    }
                }
            }
        ]
    } as any;
}

function makeOfflineFixture(overrides: any) {
    return {
        status: "completed",
        final_answer: "done",
        iterations: 1,
        elapsed_ms: 10,
        available_tool_count: 0,
        trace_sequence: [],
        trace: [
            { role: "system", content: "system" },
            { role: "user", content: "user" },
            { role: "assistant", content: "done" }
        ],
        ...overrides
    };
}

function makeFetchResponse(message: any) {
    return {
        ok: true,
        json: vi.fn().mockResolvedValue({
            choices: [{ message }]
        })
    };
}
