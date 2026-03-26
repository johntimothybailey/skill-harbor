import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stowAction } from './stow';
import { Orchestrator } from '../orchestrator';
import { printHeader, printSuccess, printError } from '../ui';
import os from 'node:os';

vi.mock('../orchestrator');
vi.mock('../ui');
vi.mock('node:os');
vi.mock('spinnies');

describe('stowAction', () => {
    let mockOrchestrator: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockOrchestrator = {
            stowTarget: vi.fn().mockResolvedValue(undefined),
            finalize: vi.fn(),
        };
        (Orchestrator as any).mockImplementation(function() { return mockOrchestrator; });
        (os.homedir as any).mockReturnValue('/home/user');
    });

    it('should stow local targets', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        process.cwd = vi.fn().mockReturnValue('/app');

        await stowAction(options, mockCommand);

        expect(printHeader).toHaveBeenCalledWith('Stowing Agent Context');
        expect(mockOrchestrator.stowTarget).toHaveBeenCalledTimes(3);
        expect(mockOrchestrator.finalize).toHaveBeenCalled();
        expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('Stow complete.'));
    });

    it('should stow global targets when global option is provided', async () => {
        const options = { global: true };
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };

        await stowAction(options, mockCommand);

        expect(mockOrchestrator.stowTarget).toHaveBeenCalledTimes(4);
    });

    it('should handle errors and exit', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        mockOrchestrator.stowTarget.mockRejectedValue(new Error('Stow failed'));
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });

        await expect(stowAction(options, mockCommand)).rejects.toThrow('exit');

        expect(printError).toHaveBeenCalledWith(expect.stringContaining('Stow failed'));
        expect(exitSpy).toHaveBeenCalledWith(1);
    });
});
