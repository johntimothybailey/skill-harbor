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
vi.mock('node:os');
vi.mock('spinnies');

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

    it('should perform sync if a skill is missing from an active target destination without self-copying cache', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };

        // Mock manifest with one skill already synced
        (getManifestManager as any).mockReturnValue({
            read: vi.fn().mockResolvedValue({
                skills: {
                    skill1: { name: 'skill1', source: 'src1', lastSyncHash: 'src1' }
                }
            }),
            getHarborDir: vi.fn().mockReturnValue('/harbor'),
            addSkill: vi.fn().mockResolvedValue(undefined),
        });

        // Mock exists: cache exists, but destination is missing
        (exists as any).mockImplementation((p: string) => {
            if (p.includes('.claude/skills/skill1')) return Promise.resolve(false); // missing
            if (p.includes('/harbor/skill1')) return Promise.resolve(true); // cache exists
            return Promise.resolve(true); // others exist
        });

        await upAction(options, mockCommand);

        const mockOrchestrator = (Orchestrator as any).mock.results[0].value;

        // Verify it reused the cache (didn't call moor)
        expect(mockOrchestrator.moor).not.toHaveBeenCalled();
        
        // Verify it berthed to the target
        expect(mockOrchestrator.berth).toHaveBeenCalledWith('/tmp/processed', expect.stringContaining('.claude/skills/skill1'), 'Claude');
        
        // Verify it DID NOT try to berth to "Harbor Cache" (since cargoPath === cachedPath)
        expect(mockOrchestrator.berth).not.toHaveBeenCalledWith(expect.any(String), expect.any(String), 'Harbor Cache');
        
        expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('Workspace Sync complete'));
    });
});
