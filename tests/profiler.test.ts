import { describe, it, expect } from 'vitest';
import { ProfilerService } from '../src/services/profiler';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

describe('ProfilerService', () => {
    const profiler = new ProfilerService();

    it('should correctly classify displacement based on tokens', async () => {
        // We test the private getShipClass via public calculateDisplacement indirectly
        // or just test the logic if we make it public. For now, let's use a temp dir.
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-test-'));
        await fs.writeFile(path.join(tempDir, 'test.txt'), 'a'.repeat(400 * 4)); // 400 tokens
        
        const displacement = await profiler.calculateDisplacement(tempDir);
        expect(displacement.tokens).toBe(400);
        expect(displacement.shipClass).toBe('Dinghy');
        
        await fs.rm(tempDir, { recursive: true });
    });

    it('should penalize semantic vagueness in Draft score', async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-test-vague-'));
        const skillContent = `---
name: vague-skill
description: search and find things.
triggers: []
---
`;
        await fs.writeFile(path.join(tempDir, 'SKILL.md'), skillContent);
        
        const draft = await profiler.calculateDraft(tempDir);
        // Base 5 + 3 (short description) = 8
        // Inverted: 11 - 8 = 3
        expect(draft.score).toBe(3);
        expect(draft.condition).toBe('Rough Seas');
        
        await fs.rm(tempDir, { recursive: true });
    });

    it('should reward negative constraints and schema strictness', async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-test-strict-'));
        const skillContent = `---
name: strict-skill
description: "Only use this when you need an exact regex match. Do not use for general searches."
triggers: ["exactMatch"]
---
`;
        await fs.writeFile(path.join(tempDir, 'SKILL.md'), skillContent);
        
        const draft = await profiler.calculateDraft(tempDir);
        // Base 5 + 0 (long description) - 2 (negative constraints) = 3
        // Inverted: 11 - 3 = 8
        expect(draft.score).toBe(8);
        expect(draft.condition).toBe('Calm Seas');
        
        await fs.rm(tempDir, { recursive: true });
    });
});
