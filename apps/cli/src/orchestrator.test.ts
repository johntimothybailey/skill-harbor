import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Orchestrator } from './orchestrator';
import Spinnies from 'spinnies';
import path from 'path';
import fs from 'node:fs/promises';
import { chmodSync } from 'node:fs';
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

    it('should extract metadata from a valid SKILL.md', async () => {
        const targetPath = path.join(tempDir, 'test-skill');
        await fs.mkdir(targetPath, { recursive: true });
        await fs.writeFile(path.join(targetPath, 'SKILL.md'),
            '---\n' +
            'name: test-skill\n' +
            'description: Internal skill for testing Skill Harbor orchestration and metadata capabilities.\n' +
            'triggers: [test-skill, internal-test, skill-harbor-validation]\n' +
            '---\n'
        );

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

    it('should explain missing local source paths before attempting to moor cargo', async () => {
        const missingSkillPath = path.join(tempDir, 'missing-local-skill');

        await expect(orchestrator.moor(missingSkillPath)).rejects.toThrow(
            `Local skill source not found: ${missingSkillPath}. Update this manifest entry or remove the stale docked skill.`
        );
    });

    it('should reject unqualified remote sources before invoking skillfish', async () => {
        await expect(orchestrator.moor('local')).rejects.toThrow(
            'Invalid remote skill source "local". Use "owner/repo" or "owner/repo/path/to/skill" for GitHub sources; use "./", "../", "/", or "file://" for local sources.'
        );
    });

    it('should resolve helper binaries by walking up to the workspace root', async () => {
        const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-harbor-workspace-'));
        const nestedPackageRoot = path.join(workspaceRoot, 'apps', 'cli');
        const binaryName = process.platform === 'win32' ? 'skillfish.cmd' : 'skillfish';
        const expectedPath = path.join(workspaceRoot, 'node_modules', '.bin', binaryName);

        await fs.mkdir(path.dirname(expectedPath), { recursive: true });
        await fs.writeFile(expectedPath, '');
        await fs.mkdir(nestedPackageRoot, { recursive: true });

        const nestedOrchestrator = new Orchestrator({
            skillName: 'test-skill',
            spinnies,
            packageRoot: nestedPackageRoot
        });

        await expect((nestedOrchestrator as any).resolveLocalBin('skillfish')).resolves.toBe(expectedPath);

        await nestedOrchestrator.cleanup();
        await fs.rm(workspaceRoot, { recursive: true, force: true });
    });

    it('should berth cached cargo even when no spinner has been initialized yet', async () => {
        const cargoPath = path.join(tempDir, 'cached-cargo');
        const targetPath = path.join(tempDir, 'target-skill');

        await fs.mkdir(cargoPath, { recursive: true });
        await fs.writeFile(path.join(cargoPath, 'SKILL.md'), '---\nname: cached-skill\ndescription: cached skill\n---\n');

        await expect(orchestrator.berth(cargoPath, targetPath, 'Codex')).resolves.toBe(true);
        await expect(fs.readFile(path.join(targetPath, 'SKILL.md'), 'utf-8')).resolves.toContain('cached-skill');

        expect(() => orchestrator.finalize('Successfully berthed to: Codex')).not.toThrow();
    });

    it('should process cached cargo without requiring a prior moor spinner', async () => {
        const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-harbor-workspace-'));
        const nestedPackageRoot = path.join(workspaceRoot, 'apps', 'cli');
        const binDir = path.join(workspaceRoot, 'node_modules', '.bin');
        const binaryName = process.platform === 'win32' ? 'skill-porter.cmd' : 'skill-porter';
        const scriptPath = path.join(binDir, binaryName);
        const cargoPath = path.join(tempDir, 'cargo-to-process');

        await fs.mkdir(binDir, { recursive: true });
        await fs.mkdir(nestedPackageRoot, { recursive: true });
        await fs.mkdir(cargoPath, { recursive: true });
        await fs.writeFile(path.join(cargoPath, 'SKILL.md'), '---\nname: cached-skill\ndescription: cached skill\n---\n');

        if (process.platform === 'win32') {
            await fs.writeFile(
                scriptPath,
                '@echo off\r\n' +
                'setlocal\r\n' +
                'set "input=%2"\r\n' +
                'set "output=%6"\r\n' +
                'mkdir "%output%" >nul 2>&1\r\n' +
                'xcopy "%input%\\*" "%output%\\" /E /I /Y >nul\r\n'
            );
        } else {
            await fs.writeFile(
                scriptPath,
                '#!/usr/bin/env sh\n' +
                'input="$2"\n' +
                'output="$6"\n' +
                'mkdir -p "$output"\n' +
                'cp -R "$input"/. "$output"/\n'
            );
            chmodSync(scriptPath, 0o755);
        }

        const nestedOrchestrator = new Orchestrator({
            skillName: 'cached-skill',
            spinnies,
            packageRoot: nestedPackageRoot
        });

        const processedPath = await nestedOrchestrator.processCargo(cargoPath, 'claude');

        await expect(fs.readFile(path.join(processedPath, 'SKILL.md'), 'utf-8')).resolves.toContain('cached-skill');

        await nestedOrchestrator.cleanup();
        await fs.rm(workspaceRoot, { recursive: true, force: true });
    }, 15000);

    // We can also test the private exists method by calling getMetadata on a path
    // which delegates to exists internally, allowing us to hit that branch.
});
