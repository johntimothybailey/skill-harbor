import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProfilerService } from '../src/services/profiler';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

describe('ProfilerService', () => {
    let profiler: ProfilerService;
    let tempDir: string;

    beforeEach(async () => {
        profiler = new ProfilerService();
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fathom-test-'));
    });

    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should correctly classify displacement based on tokens', async () => {
        const skillContent = 'console.log("hello world");'.repeat(20); // ~200 tokens
        await fs.writeFile(path.join(tempDir, 'SKILL.md'), skillContent);

        const displacement = await profiler.calculateDisplacement(tempDir);
        expect(displacement.tokens).toBeGreaterThan(100);
        expect(displacement.shipClass).toBe('Dinghy');
        expect(displacement.icon).toBe('🛶');
    });

    it('should penalize semantic vagueness in Confidence score', async () => {
        const skillContent = `---
name: vague-skill
description: short desc
---`;
        await fs.writeFile(path.join(tempDir, 'SKILL.md'), skillContent);

        const result = await profiler.calculateHeuristicConfidence(tempDir);
        // Base score will be penalized by vagueness (+3)
        // Score = 5 + 3 = 8. Inverted: 11 - 8 = 3.
        expect(result.score).toBeLessThanOrEqual(5);
        expect(result.condition).toBe('Rough Seas');
    });

    it('should reward negative constraints and schema strictness', async () => {
        const skillContent = `---
name: clear-skill
description: A very deep and meaningful description that describes exactly what this tool does in great detail to ensure No semantic vagueness.
---
## Trigger
Only use this when the user specifically asks for maritime metaphors. Do not use for anything else.`;
        await fs.writeFile(path.join(tempDir, 'SKILL.md'), skillContent);

        const result = await profiler.calculateHeuristicConfidence(tempDir);
        // Vagueness: 0, Constraints: -1, Triggers: -1
        // Score = 5 - 1 - 1 = 3. Inverted: 11 - 3 = 8.
        expect(result.score).toBeGreaterThanOrEqual(9);
        expect(result.condition).toBe('Glassy Water');
    });
});
