import { describe, it, expect, vi, beforeEach } from 'vitest';
import { upAction } from './up';
import { Orchestrator } from '../orchestrator';
import { getManifestManager, exists } from '../utils';
import { printHeader, printSuccess, printError } from '../ui';
import fs from 'node:fs/promises';
import os from 'node:os';

vi.mock('../orchestrator');
vi.mock('../utils');
vi.mock('../ui');
vi.mock('node:fs/promises');
vi.mock('node:fs');
vi.mock('node:os');
vi.mock('spinnies');
vi.mock('fast-glob');
vi.mock('node:child_process', () => ({
    exec: vi.fn()
}));

import { lstatSync } from 'node:fs';
import glob from 'fast-glob';
import { exec } from 'node:child_process';

describe('upAction', () => {
    let mockOrchestrator: any;
    let mockManifestManager: any;

    beforeEach(() => {
        vi.clearAllMocks();
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
            getHarborDir: vi.fn().mockReturnValue('/harbor'),
            addSkill: vi.fn().mockResolvedValue(undefined),
        };
        (Orchestrator as any).mockImplementation(function() { return mockOrchestrator; });
        (getManifestManager as any).mockReturnValue(mockManifestManager);
        (os.homedir as any).mockReturnValue('/home/user');
        (exists as any).mockResolvedValue(true);
        (fs.mkdir as any).mockResolvedValue(undefined);
        (fs.writeFile as any).mockResolvedValue(undefined);
        (lstatSync as any).mockReturnValue({ size: 100, mtimeMs: 123456789 });
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

    it('should skip sync if no changes are detected', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        mockManifestManager.read.mockResolvedValue({
            skills: {
                'skill1': { 
                    name: 'skill1', 
                    source: 'source1', 
                    lastSyncHash: 'source1',
                    lastSyncTargets: ['claude', 'cursor', 'antigravity', 'rulesync']
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
        mockManifestManager.read.mockResolvedValue({
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
        mockManifestManager.read.mockResolvedValue({
            skills: {
                'skill1': { 
                    name: 'skill1', 
                    source: 'source1', 
                    lastSyncHash: 'source1',
                    lastSyncTargets: ['claude']
                }
            }
        });
        
        // Mock exists to return true for agent folders but false for the specific skill in one of them
        (exists as any).mockImplementation((p: string) => {
            if (p.includes('.claude/skills/skill1')) return Promise.resolve(false);
            return Promise.resolve(true);
        });

        await upAction(options, mockCommand);

        expect(mockOrchestrator.berth).toHaveBeenCalled();
        expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('Workspace Sync complete.'));
    });

    it('should handle lockdown mode', async () => {
        const options = { lockdown: true };
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };

        await upAction(options, mockCommand);

        expect(mockOrchestrator.stowTarget).toHaveBeenCalled();
    });

    it('should detect changes in local skills using hashing', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        mockManifestManager.read.mockResolvedValue({
            skills: {
                'local-skill': { 
                    name: 'local-skill', 
                    source: './local-skill', 
                    lastSyncHash: 'old-hash' 
                }
            }
        });
        
        (glob as any).mockResolvedValue(['/absolute/path/to/local-skill/file.txt']);
        // stats are handled by lstatSync which we can mock if needed, 
        // but by default currentSourceHash will be different from 'old-hash'
        
        await upAction(options, mockCommand);

        expect(mockOrchestrator.moor).toHaveBeenCalledWith('./local-skill');
    });

    it('should detect changes in remote skills using git ls-remote', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        mockManifestManager.read.mockResolvedValue({
            skills: {
                'remote-skill': { 
                    name: 'remote-skill', 
                    source: 'owner/repo', 
                    lastSyncHash: 'owner/repo:old-hash' 
                }
            }
        });
        
        const mockExec = exec as any;
        mockExec.mockImplementation((cmd: string, opts: any, cb: any) => {
            cb(null, { stdout: 'new-hash\tHEAD' });
        });
        
        await upAction(options, mockCommand);

        expect(mockOrchestrator.moor).toHaveBeenCalledWith('owner/repo');
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
        expect(exitSpy).toHaveBeenCalledWith(1);
    });
});
