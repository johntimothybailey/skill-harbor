import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkAction } from './check';
import { Orchestrator } from '../orchestrator';
import { getManifestManager, exists } from '../utils';
import { printHeader, printError, printInfo } from '../ui';
import os from 'node:os';

vi.mock('../orchestrator');
vi.mock('../utils');
vi.mock('../ui');
vi.mock('node:os');
vi.mock('spinnies');

describe('checkAction', () => {
    let mockOrchestrator: any;
    let mockManifestManager: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockOrchestrator = {
            getMetadata: vi.fn().mockResolvedValue({ name: 'skill1', description: 'desc' }),
        };
        mockManifestManager = {
            read: vi.fn().mockResolvedValue({
                skills: {
                    'skill1': { name: 'skill1', source: 'source1' }
                }
            }),
            getHarborDir: vi.fn().mockReturnValue('/harbor'),
        };
        (Orchestrator as any).mockImplementation(function() { return mockOrchestrator; });
        (getManifestManager as any).mockReturnValue(mockManifestManager);
        (os.homedir as any).mockReturnValue('/home/user');
        (exists as any).mockResolvedValue(true);
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
        mockManifestManager.read.mockResolvedValue({ skills: {} });

        await checkAction(options, mockCommand);

        expect(printInfo).toHaveBeenCalledWith('Empty Harbor', expect.any(String));
    });
});
