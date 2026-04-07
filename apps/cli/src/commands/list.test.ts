import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listAction } from './list';
import { getManifestManager } from '../utils';
import { printHeader, printError } from '../ui';
import kleur from 'kleur';

vi.mock('../utils');
vi.mock('../ui');
vi.mock('../manifest');

describe('listAction', () => {
    let mockManifestManager: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockManifestManager = {
            read: vi.fn(),
        };
        (getManifestManager as any).mockReturnValue(mockManifestManager);
    });

    it('should list skills when manifest has skills', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        const manifest = {
            skills: {
                'skill1': { name: 'skill1', source: 'source1' },
                'skill2': { name: 'skill2', source: 'source2' },
            }
        };
        mockManifestManager.read.mockResolvedValue(manifest);

        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        await listAction(options, mockCommand);

        expect(printHeader).toHaveBeenCalledWith('Local Fleet Manifest');
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('skill1'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('skill2'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('source1'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('source2'));
    });

    it('should show global header when global option is provided', async () => {
        const options = { global: true };
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        mockManifestManager.read.mockResolvedValue({ skills: {} });
        vi.spyOn(console, 'log').mockImplementation(() => {});

        await listAction(options, mockCommand);

        expect(printHeader).toHaveBeenCalledWith('Global Fleet Manifest');
    });

    it('should show empty message when no skills are docked', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        mockManifestManager.read.mockResolvedValue({ skills: {} });
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        await listAction(options, mockCommand);

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No skills are currently docked in this workspace.'));
    });

    it('should print error when manifest read fails', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        mockManifestManager.read.mockRejectedValue(new Error('Read failed'));

        await listAction(options, mockCommand);

        expect(printError).toHaveBeenCalledWith(expect.stringContaining('Cannot read manifest. Run \'dock\' first to initialize.'));
    });
});
