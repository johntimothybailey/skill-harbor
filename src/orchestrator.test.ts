import { describe, it, expect, beforeEach } from 'vitest';
import { Orchestrator } from './orchestrator';
import Spinnies from 'spinnies';
import path from 'path';

describe('Orchestrator Unit Tests', () => {
    let orchestrator: Orchestrator;
    let spinnies: Spinnies;

    beforeEach(() => {
        // Mock standard output so spinnies doesn't pollute test logs
        spinnies = new Spinnies({ disableSpins: true });
        orchestrator = new Orchestrator({ skillName: 'test-skill', spinnies });
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

    // We can also test the private exists method by calling getMetadata on a path
    // which delegates to exists internally, allowing us to hit that branch.
});
