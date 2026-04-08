import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkAction } from './check';
import { resolveCommandScope } from '../command-scope';
import { Orchestrator } from '../orchestrator';
import { getAgentBerths, getManifestManager, exists } from '../utils';
import { printHeader, printInfo } from '../ui';
import os from 'node:os';

vi.mock('../command-scope');
vi.mock('../orchestrator');
vi.mock('../utils');
vi.mock('../ui');
vi.mock('spinnies');
vi.mock('node:os');

describe('checkAction', () => {
    let mockOrchestrator: any;
    let mockManifestManager: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockOrchestrator = {
            getMetadata: vi.fn().mockResolvedValue({ name: 'skill1', description: 'desc', triggers: [] }),
        };
        mockManifestManager = {
            read: vi.fn().mockResolvedValue({
                skills: {
                    'skill1': { name: 'skill1', source: 'source1', layer: 'shared' }
                }
            }),
            readMerged: vi.fn().mockResolvedValue({
                skills: {
                    'skill1': { name: 'skill1', source: 'source1', layer: 'shared' }
                }
            }),
            getSkillsCacheDir: vi.fn().mockReturnValue('/harbor'),
            getHarborDir: vi.fn().mockReturnValue('/harbor'),
        };
        (resolveCommandScope as any).mockResolvedValue({ useGlobalScope: false, shouldStop: false });
        (Orchestrator as any).mockImplementation(function() { return mockOrchestrator; });
        (getManifestManager as any).mockReturnValue(mockManifestManager);
        (getAgentBerths as any).mockResolvedValue([
            { path: '/app/.claude/skills', label: 'Claude', key: 'claude' },
            { path: '/app/.agents/skills', label: 'Codex', key: 'codex' }
        ]);
        (os.homedir as any).mockReturnValue('/home/user');
        (exists as any).mockImplementation(() => Promise.resolve(true));
    });

    it('should perform health check on docked skills', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };

        await checkAction(options, mockCommand);

        expect(printHeader).toHaveBeenCalledWith('Lighthouse Health Check');
        expect(mockOrchestrator.getMetadata).toHaveBeenCalled();
    });

    it('should handle empty harbor', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        mockManifestManager.readMerged.mockResolvedValue({
            skills: {}
        });

        await checkAction(options, mockCommand);

        expect(printInfo).toHaveBeenCalledWith('Empty Harbor', expect.any(String));
    });

    it('should stop without checking when scope resolution says to stop', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        (resolveCommandScope as any).mockResolvedValue({ useGlobalScope: false, shouldStop: true });

        await checkAction(options, mockCommand);

        expect(mockManifestManager.readMerged).not.toHaveBeenCalled();
        expect(mockOrchestrator.getMetadata).not.toHaveBeenCalled();
    });
});
