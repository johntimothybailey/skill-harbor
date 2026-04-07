import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lighthouseAction } from './lighthouse';
import { getManifestManager, exists } from '../utils';
import { printHeader, printLighthouseSnippet } from '../ui';
import { Orchestrator } from '../orchestrator';
import os from 'node:os';

vi.mock('../utils');
vi.mock('../ui');
vi.mock('../orchestrator');
vi.mock('node:os');
vi.mock('spinnies');

describe('lighthouseAction', () => {
    let mockOrchestrator: any;
    let mockManifestManager: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockOrchestrator = {
            getMetadata: vi.fn().mockResolvedValue({ name: 'skill1', description: 'desc', triggers: [] }),
        };
        (Orchestrator as any).mockImplementation(function() { return mockOrchestrator; });

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
            getHarborDir: vi.fn().mockReturnValue('/harbor'),
        };
        (getManifestManager as any).mockReturnValue(mockManifestManager);
        (os.homedir as any).mockReturnValue('/home/user');
        (exists as any).mockResolvedValue(true);
    });

    it('should generate lighthouse snippet', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };

        await lighthouseAction(options, mockCommand);

        expect(printHeader).toHaveBeenCalledWith('Lighthouse Intelligence Snippet');
        expect(printLighthouseSnippet).toHaveBeenCalledWith(expect.stringContaining('skill1'));
    });
});
