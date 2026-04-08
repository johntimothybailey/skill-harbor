import { beforeEach, describe, expect, it, vi } from "vitest";
import os from "node:os";
import { fathomAction } from "./fathom";
import { resolveCommandScope } from "../command-scope";
import { getAgentBerths, getManifestManager, getStowageBerths } from "../utils";
import { ConfigManager } from "../services/config";
import { ProfilerService } from "../services/profiler";
import { printHeader, printInfo } from "../ui";

vi.mock("../command-scope");
vi.mock("../utils");
vi.mock("../services/config");
vi.mock("../services/profiler");
vi.mock("../ui");
vi.mock("node:os");
vi.mock("spinnies");

describe("fathomAction", () => {
    let mockManifestManager: any;
    let mockProfiler: any;
    let mockConfigManager: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockManifestManager = {
            read: vi.fn().mockResolvedValue({ skills: {} }),
            readMerged: vi.fn().mockResolvedValue({
                skills: {
                    skill1: { name: "skill1", source: "source1", layer: "shared" }
                }
            }),
            getSkillsCacheDir: vi.fn().mockReturnValue("/harbor")
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
        (ConfigManager.getInstance as any).mockReturnValue(mockConfigManager);
        (ProfilerService as any).mockImplementation(function() {
            return mockProfiler;
        });
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
});
