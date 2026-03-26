import { describe, it, expect, vi, beforeEach } from 'vitest';
import { unstowAction } from './unstow';
import { Orchestrator } from '../orchestrator';
import { printHeader, printSuccess, printError } from '../ui';
import os from 'node:os';

vi.mock('../orchestrator');
vi.mock('../ui');
vi.mock('node:os');
vi.mock('spinnies');

describe('unstowAction', () => {
    let mockOrchestrator: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockOrchestrator = {
            unstowTarget: vi.fn().mockResolvedValue(undefined),
            finalize: vi.fn(),
        };
        (Orchestrator as any).mockImplementation(function() { return mockOrchestrator; });
        (os.homedir as any).mockReturnValue('/home/user');
    });

    it('should unstow local targets', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        process.cwd = vi.fn().mockReturnValue('/app');

        await unstowAction(options, mockCommand);

        expect(printHeader).toHaveBeenCalledWith('Restoring Agent Context (Unlock)');
        expect(mockOrchestrator.unstowTarget).toHaveBeenCalledTimes(3);
        expect(mockOrchestrator.finalize).toHaveBeenCalled();
        expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('Unstow complete.'));
    });

    it('should handle errors and exit', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        mockOrchestrator.unstowTarget.mockRejectedValue(new Error('Unstow failed'));
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });

        await expect(unstowAction(options, mockCommand)).rejects.toThrow('exit');

        expect(printError).toHaveBeenCalledWith(expect.stringContaining('Unstow failed'));
        expect(exitSpy).toHaveBeenCalledWith(1);
    });
});
