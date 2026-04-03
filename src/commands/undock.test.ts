import { describe, it, expect, vi, beforeEach } from 'vitest';
import { undockAction } from './undock';
import { Orchestrator } from '../orchestrator';
import { exists, getManagedAgentTargets } from '../utils';
import { printHeader, printSuccess, printError } from '../ui';
import os from 'node:os';

vi.mock('../orchestrator');
vi.mock('../utils');
vi.mock('../ui');
vi.mock('node:os');
vi.mock('spinnies');

describe('undockAction', () => {
    let mockOrchestrator: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockOrchestrator = {
            purgeTarget: vi.fn().mockResolvedValue(undefined),
            finalize: vi.fn(),
        };
        (Orchestrator as any).mockImplementation(function() { return mockOrchestrator; });
        (os.homedir as any).mockReturnValue('/home/user');
        (getManagedAgentTargets as any).mockImplementation((baseDir: string, includeRulesync: boolean) => {
            const targets = [
                { path: `${baseDir}/.claude/skills`, label: 'Claude', key: 'claude' },
                { path: `${baseDir}/.cursor/skills`, label: 'Cursor', key: 'cursor' },
                { path: `${baseDir}/.antigravity/skills`, label: 'Antigravity', key: 'antigravity' },
                { path: `${baseDir}/.agents/skills`, label: 'Codex', key: 'codex' }
            ];

            if (includeRulesync) {
                targets.push({ path: '/home/user/.rulesync/skills', label: 'Rulesync', key: 'rulesync' });
            }

            return targets;
        });
        (exists as any).mockResolvedValue(true);
    });

    it('should purge all local targets by default', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        process.cwd = vi.fn().mockReturnValue('/app');

        await undockAction(options, mockCommand);

        expect(printHeader).toHaveBeenCalledWith('Undocking Operations Initiated');
        expect(mockOrchestrator.purgeTarget).toHaveBeenCalledTimes(4);
        expect(mockOrchestrator.finalize).toHaveBeenCalled();
        expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('Local workspace is clean.'));
    });

    it('should purge global targets when global option is provided', async () => {
        const options = { global: true };
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };

        await undockAction(options, mockCommand);

        expect(mockOrchestrator.purgeTarget).toHaveBeenCalledTimes(5); // 4 standard + Rulesync
        expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('Global workspace is clean.'));
    });

    it('should skip non-existent targets', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        (exists as any).mockResolvedValue(false);

        await undockAction(options, mockCommand);

        expect(mockOrchestrator.purgeTarget).not.toHaveBeenCalled();
    });

    it('should handle errors and exit', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        mockOrchestrator.purgeTarget.mockRejectedValue(new Error('Purge failed'));
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });

        await expect(undockAction(options, mockCommand)).rejects.toThrow('exit');

        expect(printError).toHaveBeenCalledWith(expect.stringContaining('Purge failed'));
        expect(exitSpy).toHaveBeenCalledWith(1);
    });
});
