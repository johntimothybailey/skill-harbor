import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lighthouseAction } from './lighthouse';
import { Orchestrator } from '../orchestrator';
import { getManifestManager } from '../utils';
import { printLighthouseSnippet } from '../ui';

vi.mock('../orchestrator');
vi.mock('../utils');
vi.mock('../ui');
vi.mock('spinnies');

describe('lighthouseAction', () => {
    let mockOrchestrator: any;
    let mockManifestManager: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockOrchestrator = {
            getMetadata: vi.fn().mockResolvedValue({ name: 'skill1', description: 'desc', triggers: ['t1'] }),
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
    });

    it('should generate lighthouse snippet', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };

        await lighthouseAction(options, mockCommand);

        expect(printLighthouseSnippet).toHaveBeenCalledWith(expect.stringContaining('skill1'));
        expect(printLighthouseSnippet).toHaveBeenCalledWith(expect.stringContaining('desc'));
        expect(printLighthouseSnippet).toHaveBeenCalledWith(expect.stringContaining('t1'));
    });
});
