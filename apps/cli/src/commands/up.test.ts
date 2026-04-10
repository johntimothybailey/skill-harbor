import { describe, it, expect, vi, beforeEach } from 'vitest';
import { upAction } from './up';
import { Orchestrator } from '../orchestrator';
import { getAgentBerths, getManagedAgentTargets, getManifestManager, exists, getSupportedTargetKeys } from '../utils';
import { printHeader, printSuccess, printError, promptEmptyProjectHarborAction, promptSelectTargets } from '../ui';
import fs from 'node:fs/promises';
import os from 'node:os';

const spinniesCtor = vi.fn();

vi.mock('../orchestrator');
vi.mock('../utils');
vi.mock('../ui');
vi.mock('node:fs/promises');
vi.mock('node:fs');
vi.mock('node:os');
vi.mock('spinnies', () => ({
    default: class MockSpinnies {
        constructor(...args: any[]) {
            spinniesCtor(...args);
        }
        add = vi.fn();
        update = vi.fn();
        succeed = vi.fn();
        fail = vi.fn();
        remove = vi.fn();
        pick = vi.fn();
    }
}));
vi.mock('fast-glob');
vi.mock('node:child_process', () => ({
    exec: vi.fn(),
    execAsync: vi.fn().mockResolvedValue({ stdout: '' })
}));

import { lstatSync } from 'node:fs';
import glob from 'fast-glob';

describe('upAction', () => {
    let mockOrchestrator: any;
    let mockManifestManager: any;

    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
        Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
        mockOrchestrator = {
            stowTarget: vi.fn().mockResolvedValue(undefined),
            moor: vi.fn().mockResolvedValue('/tmp/cargo'),
            processCargo: vi.fn().mockResolvedValue('/tmp/processed'),
            berth: vi.fn().mockResolvedValue(true),
            cleanup: vi.fn().mockResolvedValue(undefined),
            finalize: vi.fn(),
            getMetadata: vi.fn().mockResolvedValue({ name: 'skill1', description: 'desc', triggers: [] }),
        };
        mockManifestManager = {
            read: vi.fn().mockResolvedValue({
                skills: {
                    'skill1': { name: 'skill1', source: 'source1' }
                }
            }),
            readMerged: vi.fn().mockResolvedValue({
                skills: {
                    'skill1': { name: 'skill1', source: 'source1' }
                }
            }),
            hasProjectManifestStack: vi.fn().mockResolvedValue(true),
            getSkillsCacheDir: vi.fn().mockImplementation((layer?: string) => layer === 'global' ? '/home/user/.harbor/skills' : '/harbor'),
            getHarborDir: vi.fn().mockReturnValue('/harbor'),
            write: vi.fn().mockResolvedValue(undefined),
            addSkill: vi.fn().mockResolvedValue(undefined),
        };
        (Orchestrator as any).mockImplementation(function() { return mockOrchestrator; });
        (getManifestManager as any).mockReturnValue(mockManifestManager);
        (getManagedAgentTargets as any).mockReturnValue([
            { path: '/app/.claude/skills', label: 'Claude', key: 'claude' },
            { path: '/app/.cursor/skills', label: 'Cursor', key: 'cursor' },
            { path: '/app/.antigravity/skills', label: 'Antigravity', key: 'antigravity' },
            { path: '/app/.agents/skills', label: 'Codex', key: 'codex' },
            { path: '/home/user/.rulesync/skills', label: 'Rulesync', key: 'rulesync' }
        ]);
        (getSupportedTargetKeys as any).mockReturnValue(['claude', 'cursor', 'antigravity', 'codex', 'rulesync']);
        (getAgentBerths as any).mockResolvedValue([
            { path: '/app/.claude/skills', label: 'Claude', key: 'claude' },
            { path: '/app/.cursor/skills', label: 'Cursor', key: 'cursor' },
            { path: '/app/.antigravity/skills', label: 'Antigravity', key: 'antigravity' },
            { path: '/app/.agents/skills', label: 'Codex', key: 'codex' },
            { path: '/home/user/.rulesync/skills', label: 'Rulesync', key: 'rulesync' }
        ]);
        (os.homedir as any).mockReturnValue('/home/user');
        (exists as any).mockResolvedValue(true);
        (fs.mkdir as any).mockResolvedValue(undefined);
        (fs.writeFile as any).mockResolvedValue(undefined);
        (lstatSync as any).mockReturnValue({ size: 100, mtimeMs: 123456789 });
        (fs.stat as any).mockResolvedValue({ isFile: () => false, size: 100, mtimeMs: 123456789 });
        (promptSelectTargets as any).mockResolvedValue(['claude']);
        (promptEmptyProjectHarborAction as any).mockResolvedValue('global');
    });

    it('should perform a full sync when changes are detected', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };

        await upAction(options, mockCommand);

        expect(printHeader).toHaveBeenCalledWith('Workspace Synchronization Initiated');
        expect(mockOrchestrator.moor).toHaveBeenCalledWith('source1');
        expect(mockOrchestrator.processCargo).toHaveBeenCalled();
        expect(mockOrchestrator.berth).toHaveBeenCalled();
        expect(mockManifestManager.addSkill).toHaveBeenCalled();
        expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('Workspace Sync complete.'));
    });

    it('should disable spinner animation for concurrent sync output', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };

        await upAction(options, mockCommand);

        expect(spinniesCtor).toHaveBeenCalledWith({ disableSpins: true });
    });

    it('should skip sync if no changes are detected', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        mockManifestManager.readMerged.mockResolvedValue({
            skills: {
                'skill1': { 
                    name: 'skill1', 
                    source: 'source1', 
                    lastSyncHash: 'source1',
                    lastSyncTargets: ['claude', 'cursor', 'antigravity', 'codex', 'rulesync']
                }
            }
        });

        await upAction(options, mockCommand);

        expect(mockOrchestrator.moor).not.toHaveBeenCalled();
    });

    it('should perform sync when --force is provided even if no changes detected', async () => {
        const options = { force: true };
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        mockManifestManager.readMerged.mockResolvedValue({
            skills: {
                'skill1': { 
                    name: 'skill1', 
                    source: 'source1', 
                    lastSyncHash: 'source1',
                    lastSyncTargets: ['claude']
                }
            }
        });
        (exists as any).mockResolvedValue(true);

        await upAction(options, mockCommand);

        expect(mockOrchestrator.moor).toHaveBeenCalled();
        expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('Workspace Sync complete.'));
    });

    it('should perform sync if a skill is missing from an active target destination', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        mockManifestManager.readMerged.mockResolvedValue({
            skills: {
                'skill1': { 
                    name: 'skill1', 
                    source: 'source1', 
                    lastSyncHash: 'source1',
                    lastSyncTargets: ['claude']
                }
            }
        });
        
        (exists as any).mockImplementation((p: string) => {
            if (p.includes('.claude/skills/skill1')) return Promise.resolve(false);
            return Promise.resolve(true);
        });

        await upAction(options, mockCommand);

        expect(mockOrchestrator.berth).toHaveBeenCalled();
        expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('Workspace Sync complete.'));
    });

    it('should berth Codex skills into .agents/skills using raw cargo', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        process.cwd = vi.fn().mockReturnValue('/app');

        await upAction(options, mockCommand);

        expect(mockOrchestrator.berth).toHaveBeenCalledWith('/tmp/cargo', '/app/.agents/skills/skill1', 'Codex');
    });

    it('should cache global-layer skills in the home harbor during merged syncs', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        process.cwd = vi.fn().mockReturnValue('/app');
        mockManifestManager.readMerged.mockResolvedValue({
            skills: {
                'skill1': { name: 'skill1', source: 'source1', layer: 'global' }
            }
        });

        await upAction(options, mockCommand);

        expect(mockManifestManager.getSkillsCacheDir).toHaveBeenCalledWith('global');
        expect(mockOrchestrator.berth).toHaveBeenCalledWith('/tmp/cargo', '/home/user/.harbor/skills/skill1', 'Harbor Cache');
        expect(mockManifestManager.addSkill).toHaveBeenCalledWith(
            expect.objectContaining({ localPath: '/home/user/.harbor/skills/skill1' }),
            'global'
        );
    });

    it('should prompt to use the global harbor when no project manifest stack exists', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        mockManifestManager.hasProjectManifestStack.mockResolvedValue(false);

        const { ManifestManager } = await import('../manifest');
        vi.spyOn(ManifestManager, 'globalManifestExists').mockResolvedValue(true);

        await upAction(options, mockCommand);

        expect(promptEmptyProjectHarborAction).toHaveBeenCalled();
        expect(mockManifestManager.read).toHaveBeenCalledWith('global');
    });

    it('should initialize a project harbor and stop when the user chooses initialize', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        mockManifestManager.hasProjectManifestStack.mockResolvedValue(false);
        (promptEmptyProjectHarborAction as any).mockResolvedValue('initialize');

        const { ManifestManager } = await import('../manifest');
        vi.spyOn(ManifestManager, 'globalManifestExists').mockResolvedValue(true);

        await upAction(options, mockCommand);

        expect(mockManifestManager.write).toHaveBeenCalledWith(
            expect.objectContaining({ version: '1.0', dependencies: {}, skills: {} }),
            'shared'
        );
        expect(mockOrchestrator.moor).not.toHaveBeenCalled();
        expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('Project harbor initialized'));
    });

    it('should cancel without syncing when the user cancels the empty-project prompt', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        mockManifestManager.hasProjectManifestStack.mockResolvedValue(false);
        (promptEmptyProjectHarborAction as any).mockResolvedValue('cancel');

        const { ManifestManager } = await import('../manifest');
        vi.spyOn(ManifestManager, 'globalManifestExists').mockResolvedValue(true);

        await upAction(options, mockCommand);

        expect(mockOrchestrator.moor).not.toHaveBeenCalled();
        expect(mockOrchestrator.berth).not.toHaveBeenCalled();
        expect(printSuccess).not.toHaveBeenCalledWith(expect.stringContaining('Workspace Sync complete.'));
    });

    it('should skip Claude conversion when Codex is the only active target', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        process.cwd = vi.fn().mockReturnValue('/app');
        mockManifestManager.readMerged.mockResolvedValue({
            targets: ['codex'],
            skills: {
                'skill1': { name: 'skill1', source: 'source1' }
            }
        });
        (getAgentBerths as any).mockResolvedValue([
            { path: '/app/.agents/skills', label: 'Codex', key: 'codex' }
        ]);

        await upAction(options, mockCommand);

        expect(mockOrchestrator.processCargo).not.toHaveBeenCalled();
    });

    it('should reject an unknown target passed to --target', async () => {
        const options = { target: 'not-a-real-target' };
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });

        await expect(upAction(options, mockCommand)).rejects.toThrow('exit');

        expect(printError).toHaveBeenCalledWith(expect.stringContaining("Unknown target(s): not-a-real-target"));
        expect(exitSpy).toHaveBeenCalledWith(1);
        expect(mockOrchestrator.moor).not.toHaveBeenCalled();
    });

    it('should sync only the specified target when --target is a single valid key', async () => {
        const options = { target: 'codex' };
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        process.cwd = vi.fn().mockReturnValue('/app');
        (getAgentBerths as any).mockResolvedValue([
            { path: '/app/.agents/skills', label: 'Codex', key: 'codex' }
        ]);

        await upAction(options, mockCommand);

        expect(getAgentBerths).toHaveBeenCalledWith('/app', ['codex']);
        expect(mockOrchestrator.berth).toHaveBeenCalledWith('/tmp/cargo', '/app/.agents/skills/skill1', 'Codex');
    });

    it('should accept a comma-separated target list and sync only those targets', async () => {
        const options = { target: 'codex,cursor' };
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        process.cwd = vi.fn().mockReturnValue('/app');
        (getAgentBerths as any).mockResolvedValue([
            { path: '/app/.cursor/skills', label: 'Cursor', key: 'cursor' },
            { path: '/app/.agents/skills', label: 'Codex', key: 'codex' }
        ]);

        await upAction(options, mockCommand);

        expect(getAgentBerths).toHaveBeenCalledWith('/app', ['codex', 'cursor']);
        expect(mockOrchestrator.berth).toHaveBeenCalledWith('/tmp/processed', '/app/.cursor/skills/skill1', 'Cursor');
        expect(mockOrchestrator.berth).toHaveBeenCalledWith('/tmp/cargo', '/app/.agents/skills/skill1', 'Codex');
    });

    it('should accept repeated --target values parsed as an array', async () => {
        const options = { target: ['codex', 'cursor'] };
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        process.cwd = vi.fn().mockReturnValue('/app');
        (getAgentBerths as any).mockResolvedValue([
            { path: '/app/.cursor/skills', label: 'Cursor', key: 'cursor' },
            { path: '/app/.agents/skills', label: 'Codex', key: 'codex' }
        ]);

        await upAction(options, mockCommand);

        expect(getAgentBerths).toHaveBeenCalledWith('/app', ['codex', 'cursor']);
        expect(mockOrchestrator.berth).toHaveBeenCalledWith('/tmp/processed', '/app/.cursor/skills/skill1', 'Cursor');
        expect(mockOrchestrator.berth).toHaveBeenCalledWith('/tmp/cargo', '/app/.agents/skills/skill1', 'Codex');
    });

    it('should reject any invalid target inside a comma-separated target list', async () => {
        const options = { target: 'codex,not-a-real-target' };
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });

        await expect(upAction(options, mockCommand)).rejects.toThrow('exit');

        expect(printError).toHaveBeenCalledWith(expect.stringContaining('Unknown target(s): not-a-real-target'));
        expect(mockOrchestrator.moor).not.toHaveBeenCalled();
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should berth the Lighthouse manifest into the Codex target as a Codex skill', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        process.cwd = vi.fn().mockReturnValue('/app');
        mockManifestManager.readMerged.mockResolvedValue({
            targets: ['codex'],
            skills: {
                'skill1': { name: 'skill1', source: 'source1' }
            }
        });
        (getAgentBerths as any).mockResolvedValue([
            { path: '/app/.agents/skills', label: 'Codex', key: 'codex' }
        ]);

        await upAction(options, mockCommand);

        expect(fs.writeFile).toHaveBeenCalledWith(
            '/app/.agents/skills/000-fleet-intelligence/SKILL.md',
            expect.stringContaining('name: fleet-intelligence')
        );
    });

    it('should handle lockdown mode', async () => {
        const options = { lockdown: true };
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };

        await upAction(options, mockCommand);

        expect(mockOrchestrator.stowTarget).toHaveBeenCalled();
    });

    it('should prompt for targets when no active berths are detected', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        (getAgentBerths as any)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                { path: '/app/.claude/skills', label: 'Claude', key: 'claude' }
            ]);
        (promptSelectTargets as any).mockResolvedValue(['claude']);

        await upAction(options, mockCommand);

        expect(getManagedAgentTargets).toHaveBeenCalledWith(process.cwd());
        expect(promptSelectTargets).toHaveBeenCalledWith([
            { path: '/app/.claude/skills', label: 'Claude', key: 'claude' },
            { path: '/app/.cursor/skills', label: 'Cursor', key: 'cursor' },
            { path: '/app/.antigravity/skills', label: 'Antigravity', key: 'antigravity' },
            { path: '/app/.agents/skills', label: 'Codex', key: 'codex' },
            { path: '/home/user/.rulesync/skills', label: 'Rulesync', key: 'rulesync' }
        ]);
        expect(getAgentBerths).toHaveBeenNthCalledWith(2, process.cwd(), ['claude']);
        expect(mockOrchestrator.berth).toHaveBeenCalled();
    });

    it('should exit without syncing when target selection is cancelled', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        (getAgentBerths as any).mockResolvedValue([]);
        (promptSelectTargets as any).mockResolvedValue(null);

        await upAction(options, mockCommand);

        expect(promptSelectTargets).toHaveBeenCalled();
        expect(mockOrchestrator.moor).not.toHaveBeenCalled();
        expect(mockOrchestrator.berth).not.toHaveBeenCalled();
        expect(printSuccess).not.toHaveBeenCalled();
    });

    it('should detect changes in local skills using hashing', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        mockManifestManager.readMerged.mockResolvedValue({
            skills: {
                'local-skill': { 
                    name: 'local-skill', 
                    source: './local-skill', 
                    lastSyncHash: 'old-hash' 
                }
            }
        });
        
        (glob as any).mockResolvedValue(['/absolute/path/to/local-skill/file.txt']);
        
        await upAction(options, mockCommand);

        expect(mockOrchestrator.moor).toHaveBeenCalledWith('./local-skill');
    });

    it('should report failures and exit 1', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        mockOrchestrator.moor.mockRejectedValue(new Error('Moor failed'));
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });

        await expect(upAction(options, mockCommand)).rejects.toThrow('exit');

        expect(printError).toHaveBeenCalledWith(expect.stringContaining('incident(s)'));
        expect(printError).toHaveBeenCalledWith(expect.stringContaining('Moor failed'));
        expect(exitSpy).toHaveBeenCalledWith(1);
    });
});
