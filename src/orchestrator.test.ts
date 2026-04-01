import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Orchestrator } from './orchestrator';
import Spinnies from 'spinnies';
import path from 'path';
import fs from 'node:fs/promises';
import os from 'node:os';

describe('Orchestrator Unit Tests', () => {
    let orchestrator: Orchestrator;
    let spinnies: Spinnies;
    let tempDir: string;

    beforeEach(async () => {
        // Mock standard output so spinnies doesn't pollute test logs
        spinnies = new Spinnies({ disableSpins: true });
        orchestrator = new Orchestrator({ skillName: 'test-skill', spinnies });
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-harbor-orchestrator-'));
    });

    afterEach(async () => {
        await orchestrator.cleanup();
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should extract metadata from a valid SKILL.md in the test-skill directory', async () => {
        const targetPath = path.resolve(__dirname, '../.harbor/test-skill');
        const metadata = await orchestrator.getMetadata(targetPath);
        
        expect(metadata).not.toBeNull();
        expect(metadata?.name).toBe('test-skill');
        expect(metadata?.description).toBe('Internal skill for testing Skill Harbor orchestration and metadata capabilities.');
        expect(metadata?.triggers).toEqual(['test-skill', 'internal-test', 'skill-harbor-validation']);
    });

    it('should return null when getting metadata for a non-existent SKILL.md', async () => {
        const targetPath = path.resolve(__dirname, '../.harbor/non-existent');
        const metadata = await orchestrator.getMetadata(targetPath);
        
        expect(metadata).toBeNull();
    });

    it('should moor local cargo into an isolated directory without leaking helper folders', async () => {
        const localSkillPath = path.join(tempDir, 'local-skill');
        await fs.mkdir(localSkillPath, { recursive: true });
        await fs.writeFile(path.join(localSkillPath, 'SKILL.md'), '---\nname: local-skill\ndescription: local skill\n---\n');

        const cargoPath = await orchestrator.moor(localSkillPath);

        expect(cargoPath).toBe(path.join(path.dirname(cargoPath), 'local-skill'));
        // Standardize the access check for cross-environment stability
        await fs.access(path.join(cargoPath, 'SKILL.md')); 
        await expect(fs.access(path.join(cargoPath, '.claude'))).rejects.toThrow();
    });

    // We can also test the private exists method by calling getMetadata on a path
    // which delegates to exists internally, allowing us to hit that branch.
});
