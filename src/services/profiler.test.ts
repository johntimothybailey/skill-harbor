import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProfilerService } from "./profiler";
import fs from "node:fs/promises";
import path from "node:path";

vi.mock("node:fs/promises");

describe("ProfilerService", () => {
    let service: ProfilerService;

    beforeEach(() => {
        service = new ProfilerService();
        vi.clearAllMocks();
    });

    describe("calculateDraft", () => {
        it("should detect and evaluate an API Tool correctly", async () => {
            const skillPath = "/fake/api-tool";
            const skillMd = `---
description: A simple API tool to fetch data.
---`;

            vi.mocked(fs.readFile).mockResolvedValue(skillMd);
            vi.mocked(fs.readdir).mockResolvedValue([{ name: "schema.json", isDirectory: () => false } as any]);

            const result = await service.calculateDraft(skillPath);

            expect(result.skillType).toBe("API Tool");
            expect(result.heuristics.schemaStrictness).toBeDefined();
            expect(result.heuristics.tagDensity).toBeUndefined();
        });

        it("should detect and evaluate an Agentic Skill correctly", async () => {
            const skillPath = "/fake/agentic-skill";
            const skillMd = `---
name: hook-ascender
description: A specialized skill for refactoring React hooks into cleaner patterns.
tags: [react, refactor, hooks]
---
## Trigger
Use this when you see complex components.
## Purpose
To improve code quality.`;

            vi.mocked(fs.readFile).mockResolvedValue(skillMd);
            vi.mocked(fs.readdir).mockResolvedValue([]);

            const result = await service.calculateDraft(skillPath);

            expect(result.skillType).toBe("Agentic Skill");
            expect(result.score).toBeGreaterThan(5); // Should get bonuses (high = good)
            expect(result.heuristics.tagDensity).toBe(-2); // 3 tags
            expect(result.heuristics.triggerClarity).toBe(-3); // 2 sections
        });

        it("should penalize Agentic Skills with short descriptions", async () => {
            const skillPath = "/fake/vague-skill";
            const skillMd = `---
name: vague-skill
description: short desc
tags: []
---`;

            vi.mocked(fs.readFile).mockResolvedValue(skillMd);
            vi.mocked(fs.readdir).mockResolvedValue([]);

            const result = await service.calculateDraft(skillPath);

            expect(result.skillType).toBe("Agentic Skill");
            expect(result.heuristics.semanticVagueness).toBe(3);
        });

        it("should give massive bonus for multiple trigger sections", async () => {
            const skillPath = "/fake/clear-skill";
            const skillMd = `---
name: clear-skill
description: A very long and detailed description that should reduce the wake score significantly because it is very specific.
tags: [a, b, c]
---
## Trigger
## Purpose
## Exceptions`;

            vi.mocked(fs.readFile).mockResolvedValue(skillMd);
            vi.mocked(fs.readdir).mockResolvedValue([]);

            const result = await service.calculateDraft(skillPath);

            expect(result.heuristics.triggerClarity).toBe(-3);
            expect(result.score).toBeGreaterThanOrEqual(9); // Glassy Water territory (high = good)
        });
    });
});
