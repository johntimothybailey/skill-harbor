import { beforeEach, describe, expect, it, vi } from "vitest";
import os from "node:os";
import { fathomAction } from "./fathom";
import { resolveCommandScope } from "../command-scope";
import { ask, exists, formatBerthDetail, getAgentBerthLocation, getAgentBerths, getManifestManager, getStowageBerths } from "../utils";
import { ConfigManager } from "../services/config";
import { ProfilerService } from "../services/profiler";
import {
    discoverGhosts,
    resolveGhostScanContext,
    resolveGhostScanMode,
    summarizeGhosts
} from "../services/ghosts";
import { printHarborHealthReport, printHeader, printInfo } from "../ui";

vi.mock("../command-scope");
vi.mock("../utils");
vi.mock("../services/config");
vi.mock("../services/profiler");
vi.mock("../services/ghosts");
vi.mock("../ui");
vi.mock("node:os");
vi.mock("spinnies", () => ({
    default: class MockSpinnies {
        add = vi.fn();
        update = vi.fn();
        fail = vi.fn();
        succeed = vi.fn();
        remove = vi.fn();
    }
}));

describe("fathomAction", () => {
    let mockManifestManager: any;
    let mockProfiler: any;
    let mockConfigManager: any;
    const mockGhostScanContext = {
        activeBerths: [{ path: "/codex", label: "Codex", key: "codex" }],
        stowageBerths: [],
        scanMode: "autodetect"
    };

    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
        Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });

        mockManifestManager = {
            read: vi.fn().mockResolvedValue({ skills: {} }),
            readMerged: vi.fn().mockResolvedValue({
                skills: {
                    skill1: { name: "skill1", source: "source1", layer: "shared" }
                }
            }),
            materializeSkills: vi.fn().mockImplementation((manifest: any) => Object.values(manifest.skills || {})),
            getSkillsCacheDir: vi.fn().mockReturnValue("/harbor"),
            addSkill: vi.fn().mockResolvedValue(undefined)
        };

        mockProfiler = {
            findSkills: vi.fn().mockResolvedValue([]),
            calculateDisplacement: vi.fn(),
            calculateHeuristicConfidence: vi.fn(),
            conductSonarAudit: vi.fn(),
            generateHealthReport: vi.fn()
        };

        mockConfigManager = {
            loadConfig: vi.fn().mockResolvedValue({
                sonar: { model: "gpt-test", baseUrl: "http://example.test", apiKey: "key" }
            })
        };

        (resolveCommandScope as any).mockResolvedValue({ useGlobalScope: false, shouldStop: false });
        (getManifestManager as any).mockReturnValue(mockManifestManager);
        (getAgentBerths as any).mockResolvedValue([]);
        (getStowageBerths as any).mockResolvedValue([]);
        (formatBerthDetail as any).mockImplementation((detail: any) => detail.location ? `${detail.label} | ${detail.location}` : detail.label);
        (getAgentBerthLocation as any).mockImplementation((berth: any) => {
            if (berth.path === "/codex") return ".codex";
            if (berth.path === "/stowage/codex") return ".stowage/codex";
            return undefined;
        });
        (exists as any).mockResolvedValue(false);
        (ask as any).mockResolvedValue(false);
        (ConfigManager.getInstance as any).mockReturnValue(mockConfigManager);
        (ProfilerService as any).mockImplementation(function() {
            return mockProfiler;
        });
        (resolveGhostScanMode as any).mockImplementation((rawMode?: string) => rawMode ?? "autodetect");
        (resolveGhostScanContext as any).mockResolvedValue(mockGhostScanContext);
        (discoverGhosts as any).mockResolvedValue([]);
        (summarizeGhosts as any).mockImplementation((ghosts: any[]) => ({
            active: ghosts.filter(ghost => !ghost.friendly),
            friendly: ghosts.filter(ghost => ghost.friendly)
        }));
        (os.homedir as any).mockReturnValue("/home/user");
    });

    it("uses the global manifest when scope resolution selects global", async () => {
        const options = {};
        const mockCommand = { opts: vi.fn().mockReturnValue(options) };
        (resolveCommandScope as any).mockResolvedValue({ useGlobalScope: true, shouldStop: false });
        mockManifestManager.read.mockResolvedValue({ skills: {} });

        await fathomAction(options, mockCommand);

        expect(mockManifestManager.read).toHaveBeenCalledWith("global");
        expect(printInfo).toHaveBeenCalledWith("Empty Harbor", expect.any(String));
    });

    it("stops immediately when scope resolution says to stop", async () => {
        const options = {};
        const mockCommand = { opts: vi.fn().mockReturnValue(options) };
        (resolveCommandScope as any).mockResolvedValue({ useGlobalScope: false, shouldStop: true });

        await fathomAction(options, mockCommand);

        expect(mockConfigManager.loadConfig).not.toHaveBeenCalled();
        expect(mockManifestManager.readMerged).not.toHaveBeenCalled();
    });

    it("still prints the fathom header before scope resolution in pretty mode", async () => {
        const options = {};
        const mockCommand = { opts: vi.fn().mockReturnValue(options) };

        await fathomAction(options, mockCommand);

        expect(printHeader).toHaveBeenCalledWith("Fathom: Skill Profiler");
    });

    it("does not apply scan mode unless --ghosts is enabled", async () => {
        const options = { scanMode: "targets-only" };
        const mockCommand = { opts: vi.fn().mockReturnValue(options) };

        await fathomAction(options, mockCommand);

        expect(resolveGhostScanMode).not.toHaveBeenCalled();
        expect(resolveGhostScanContext).not.toHaveBeenCalled();
        expect(discoverGhosts).not.toHaveBeenCalled();
    });

    it("passes the selected scan mode into ghost discovery", async () => {
        const options = { ghosts: true, scanMode: "targets-only" };
        const mockCommand = { opts: vi.fn().mockReturnValue(options) };

        await fathomAction(options, mockCommand);

        expect(resolveGhostScanMode).toHaveBeenCalledWith("targets-only");
        expect(resolveGhostScanContext).toHaveBeenCalledWith(expect.objectContaining({
            scanMode: "targets-only"
        }));
        expect(discoverGhosts).toHaveBeenCalledWith(expect.objectContaining({
            scanContext: mockGhostScanContext
        }));
    });

    it("uses the resolved ghost context for ghost status labeling", async () => {
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        const options = { ghosts: true };
        const mockCommand = { opts: vi.fn().mockReturnValue(options) };

        mockManifestManager.readMerged.mockResolvedValue({ skills: {} });
        mockManifestManager.materializeSkills.mockReturnValue([]);
        (discoverGhosts as any).mockResolvedValue([
            { name: "ghost-skill", path: "/ghosts/ghost-skill", location: "berth", berthLabel: "Codex", friendly: false }
        ]);
        (getAgentBerths as any).mockResolvedValue([{ path: "/codex", label: "Codex", key: "codex" }]);
        (exists as any).mockImplementation(async (candidatePath: string) => (
            candidatePath === "/ghosts/ghost-skill" || candidatePath === "/codex/ghost-skill"
        ));
        mockProfiler.calculateDisplacement.mockResolvedValue({
            icon: "⛵",
            shipClass: "Schooner",
            tokens: 100,
            cost: { gpt4o: 0.001, gpt4oMini: 0.0001 }
        });
        mockProfiler.calculateHeuristicConfidence.mockResolvedValue({
            score: 7,
            condition: "Calm Seas",
            skillType: "Agent Skill",
            validation: { isProperlyFormatted: true, errors: [] },
            heuristics: {
                semanticVagueness: 0,
                negativeConstraints: 0,
                tagDensity: 0,
                triggerClarity: 1
            },
            contracts: null
        });

        await fathomAction(options, mockCommand);

        expect(resolveGhostScanContext).toHaveBeenCalledTimes(1);
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[Berthed: Codex | .codex]"));
        logSpy.mockRestore();
    });

    it("shows every berthed agent match available in the selected scope", async () => {
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        const options = { global: true };
        const mockCommand = { opts: vi.fn().mockReturnValue(options) };

        mockManifestManager.read.mockResolvedValue({
            skills: {
                catch22: { name: "catch-22", source: "source1", layer: "global" }
            }
        });
        mockManifestManager.materializeSkills.mockReturnValue([{ name: "catch-22", layer: "global" }]);
        (resolveCommandScope as any).mockResolvedValue({ useGlobalScope: true, shouldStop: false });
        (getAgentBerths as any).mockResolvedValue([
            { path: "/rulesync", label: "Rulesync", key: "rulesync" },
            { path: "/codex", label: "Codex", key: "codex" }
        ]);
        (exists as any).mockImplementation(async (candidatePath: string) => (
            candidatePath === "/harbor/catch-22" ||
            candidatePath === "/rulesync/catch-22" ||
            candidatePath === "/codex/catch-22"
        ));
        (getAgentBerthLocation as any).mockImplementation((berth: any) => {
            if (berth.path === "/rulesync") return ".rulesync";
            if (berth.path === "/codex") return ".codex";
            return undefined;
        });
        mockProfiler.calculateDisplacement.mockResolvedValue({
            icon: "🛳️",
            shipClass: "Frigate",
            tokens: 5001,
            cost: { gpt4o: 0.025, gpt4oMini: 0.00075 }
        });
        mockProfiler.calculateHeuristicConfidence.mockResolvedValue({
            score: 10,
            condition: "Glassy Water",
            skillType: "Agent Skill",
            validation: { isProperlyFormatted: true, errors: [] },
            heuristics: {
                semanticVagueness: -1,
                negativeConstraints: 0,
                tagDensity: -2,
                triggerClarity: -1
            },
            contracts: null
        });

        await fathomAction(options, mockCommand);

        expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining("[Berthed: Rulesync | .rulesync, Codex | .codex]")
        );
        logSpy.mockRestore();
    });

    it("adds structured vessel placement detail to report output", async () => {
        const options = { report: true, format: "json" };
        const mockCommand = { opts: vi.fn().mockReturnValue(options) };

        mockManifestManager.readMerged.mockResolvedValue({
            skills: {
                skill1: { name: "skill1", source: "source1", layer: "shared" }
            }
        });
        mockManifestManager.materializeSkills.mockReturnValue([{ name: "skill1", layer: "shared" }]);
        mockProfiler.findSkills.mockResolvedValue(["/harbor/skill1"]);
        (exists as any).mockImplementation(async (candidatePath: string) => candidatePath === "/codex/skill1");
        mockProfiler.generateHealthReport.mockResolvedValue({
            totalSkills: 1,
            totalTokens: 100,
            totalCost: { gpt4o: 0.001, gpt4oMini: 0.0001 },
            averageHeuristicConfidence: 7,
            composition: { agent: 1, tools: 0 },
            shipDistribution: { Dinghy: 1, Schooner: 0, Brigantine: 0, Frigate: 0, Galleon: 0 },
            contextBloat: [],
            status: { isHealthy: true, violations: [] }
        });
        (getAgentBerths as any).mockResolvedValue([{ path: "/codex", label: "Codex", key: "codex" }]);
        (getStowageBerths as any).mockResolvedValue([]);

        await fathomAction(options, mockCommand);

        expect(printHarborHealthReport).toHaveBeenCalledWith(expect.objectContaining({
            fleetStatus: { berthed: 1, stowed: 0, dryDock: 0 },
            vesselPlacements: [
                {
                    name: "skill1",
                    berthed: [{ label: "Codex", location: ".codex" }],
                    stowed: []
                }
            ]
        }), "json");
    });

    it("never prompts for ghost docking in non-interactive mode", async () => {
        Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
        Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true });

        const options = { ghosts: true };
        const mockCommand = { opts: vi.fn().mockReturnValue(options) };

        mockManifestManager.readMerged.mockResolvedValue({ skills: {} });
        mockManifestManager.materializeSkills.mockReturnValue([]);
        (discoverGhosts as any).mockResolvedValue([
            { name: "ghost-skill", path: "/ghosts/ghost-skill", location: "berth", berthLabel: "Codex", friendly: false }
        ]);
        (exists as any).mockResolvedValue(true);
        mockProfiler.calculateDisplacement.mockResolvedValue({
            icon: "⛵",
            shipClass: "Schooner",
            tokens: 100,
            cost: { gpt4o: 0.001, gpt4oMini: 0.0001 }
        });
        mockProfiler.calculateHeuristicConfidence.mockResolvedValue({
            score: 7,
            condition: "Calm Seas",
            skillType: "Agent Skill",
            validation: { isProperlyFormatted: true, errors: [] },
            heuristics: {
                semanticVagueness: 0,
                negativeConstraints: 0,
                tagDensity: 0,
                triggerClarity: 1
            },
            contracts: null
        });

        await fathomAction(options, mockCommand);

        expect(ask).not.toHaveBeenCalled();
    });

    it("docks ghost skills into the global manifest when global scope is selected", async () => {
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        const options = { ghosts: true, global: true };
        const mockCommand = { opts: vi.fn().mockReturnValue(options) };

        mockManifestManager.read.mockResolvedValue({ skills: {} });
        mockManifestManager.materializeSkills.mockReturnValue([]);
        (discoverGhosts as any).mockResolvedValue([
            { name: "ghost-skill", path: "/ghosts/ghost-skill", location: "berth", berthLabel: "Codex", friendly: false }
        ]);
        (exists as any).mockResolvedValue(true);
        (ask as any).mockResolvedValue(true);
        mockProfiler.calculateDisplacement.mockResolvedValue({
            icon: "⛵",
            shipClass: "Schooner",
            tokens: 100,
            cost: { gpt4o: 0.001, gpt4oMini: 0.0001 }
        });
        mockProfiler.calculateHeuristicConfidence.mockResolvedValue({
            score: 7,
            condition: "Calm Seas",
            skillType: "Agent Skill",
            validation: { isProperlyFormatted: true, errors: [] },
            heuristics: {
                semanticVagueness: 0,
                negativeConstraints: 0,
                tagDensity: 0,
                triggerClarity: 1
            },
            contracts: null
        });
        (resolveCommandScope as any).mockResolvedValue({ useGlobalScope: true, shouldStop: false });

        await fathomAction(options, mockCommand);

        expect(ask).toHaveBeenCalledWith(expect.stringContaining("global manifest"), expect.anything());
        expect(mockManifestManager.addSkill).toHaveBeenCalledWith(expect.objectContaining({
            name: "ghost-skill",
            source: "/ghosts/ghost-skill"
        }), "global");
        logSpy.mockRestore();
    });
});
