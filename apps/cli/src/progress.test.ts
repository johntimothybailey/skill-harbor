import { describe, expect, it, vi } from "vitest";
import { dedupeRawProgressReporter, ProgressReporter } from "./progress";

function makeBaseReporter(): ProgressReporter {
    return {
        add: vi.fn(),
        update: vi.fn(),
        succeed: vi.fn(),
        fail: vi.fn(),
        pick: vi.fn(),
        remove: vi.fn()
    } as any;
}

describe("dedupeRawProgressReporter", () => {
    it("emits only the changed spinner line instead of replaying all prior spinners", () => {
        const chunks: string[] = [];
        const reporter = dedupeRawProgressReporter(makeBaseReporter(), {
            write(chunk: string) {
                chunks.push(chunk);
                return true;
            }
        } as any);

        reporter.add("test-skill", { text: "[test-skill] Mooring skill from local..." });
        reporter.add("quartermaster", { text: "[quartermaster] Mooring skill from ./skills/quartermaster..." });
        reporter.update("quartermaster", { text: "[quartermaster] Local skill cargo successfully moored." });

        expect(chunks).toEqual([
            "- [test-skill] Mooring skill from local...\n",
            "- [quartermaster] Mooring skill from ./skills/quartermaster...\n",
            "- [quartermaster] Local skill cargo successfully moored.\n"
        ]);
    });

    it("does not emit duplicate terminal status lines that only differ by ANSI styling", () => {
        const chunks: string[] = [];
        const reporter = dedupeRawProgressReporter(makeBaseReporter(), {
            write(chunk: string) {
                chunks.push(chunk);
                return true;
            }
        } as any);

        reporter.update("quartermaster", { text: "\x1b[32m[quartermaster] Successfully berthed.\x1b[39m" });
        reporter.succeed("quartermaster", { text: "\x1b[1m\x1b[32m[quartermaster] Successfully berthed.\x1b[39m\x1b[22m" });

        expect(chunks).toEqual([
            "- \x1b[32m[quartermaster] Successfully berthed.\x1b[39m\n"
        ]);
    });
});
