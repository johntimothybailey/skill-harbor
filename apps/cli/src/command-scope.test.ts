import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCommandScope } from "./command-scope";
import { ManifestManager } from "./manifest";
import { printSuccess, promptEmptyProjectHarborAction } from "./ui";

vi.mock("./ui");
vi.mock("./manifest");

describe("resolveCommandScope", () => {
    let manifestManager: any;

    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
        Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
        manifestManager = {
            hasProjectManifestStack: vi.fn().mockResolvedValue(true),
            write: vi.fn().mockResolvedValue(undefined)
        };
        (ManifestManager.globalManifestExists as any).mockResolvedValue(false);
        (promptEmptyProjectHarborAction as any).mockResolvedValue("cancel");
    });

    it("returns project scope when a project manifest stack exists", async () => {
        const result = await resolveCommandScope({}, manifestManager, "skill-harbor list");

        expect(result).toEqual({ useGlobalScope: false, shouldStop: false });
        expect(promptEmptyProjectHarborAction).not.toHaveBeenCalled();
    });

    it("switches to global scope when requested by the prompt", async () => {
        manifestManager.hasProjectManifestStack.mockResolvedValue(false);
        (ManifestManager.globalManifestExists as any).mockResolvedValue(true);
        (promptEmptyProjectHarborAction as any).mockResolvedValue("global");

        const result = await resolveCommandScope({}, manifestManager, "skill-harbor check");

        expect(result).toEqual({ useGlobalScope: true, shouldStop: false });
    });

    it("initializes a project harbor and stops when requested", async () => {
        manifestManager.hasProjectManifestStack.mockResolvedValue(false);
        (ManifestManager.globalManifestExists as any).mockResolvedValue(true);
        (promptEmptyProjectHarborAction as any).mockResolvedValue("initialize");

        const result = await resolveCommandScope({}, manifestManager, "skill-harbor lighthouse");

        expect(result).toEqual({ useGlobalScope: false, shouldStop: true });
        expect(manifestManager.write).toHaveBeenCalledWith(
            expect.objectContaining({ version: "1.0", dependencies: {}, skills: {} }),
            "shared"
        );
        expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining("skill-harbor lighthouse"));
    });

    it("falls back to global scope in non-interactive mode", async () => {
        Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
        Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true });
        manifestManager.hasProjectManifestStack.mockResolvedValue(false);
        (ManifestManager.globalManifestExists as any).mockResolvedValue(true);

        const result = await resolveCommandScope({}, manifestManager, "skill-harbor list");

        expect(result).toEqual({ useGlobalScope: true, shouldStop: false });
    });
});
