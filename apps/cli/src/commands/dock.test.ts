import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dockAction } from './dock';
import { getManifestManager } from '../utils';
import { printHeader, printSuccess, printError } from '../ui';

vi.mock('../utils');
vi.mock('../ui');
vi.mock('spinnies');

describe('dockAction', () => {
    let mockManifestManager: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockManifestManager = {
            init: vi.fn().mockResolvedValue(undefined),
            addSkill: vi.fn().mockResolvedValue(undefined),
        };
        (getManifestManager as any).mockReturnValue(mockManifestManager);
    });

    it('should successfully dock a skill with a URL', async () => {
        const url = 'https://github.com/user/my-skill.git';
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };

        await dockAction(url, options, mockCommand);

        expect(printHeader).toHaveBeenCalledWith('Docking Operations Initiated');
        expect(mockManifestManager.init).toHaveBeenCalled();
        expect(mockManifestManager.addSkill).toHaveBeenCalledWith({
            name: 'my-skill',
            source: url,
            localPath: '',
        }, "shared");
        expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('Skill successfully manifested!'));
    });

    it('should generate a skill name if the URL is empty or invalid', async () => {
        const url = '';
        const options = { local: true };
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };

        await dockAction(url, options, mockCommand);

        expect(mockManifestManager.addSkill).toHaveBeenCalledWith(expect.objectContaining({
            source: url,
            localPath: '',
        }), "local");
    });

    it('should handle docking failures', async () => {
        const url = 'https://github.com/user/my-skill.git';
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        mockManifestManager.addSkill.mockRejectedValue(new Error('Docking failed'));
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });

        await expect(dockAction(url, options, mockCommand)).rejects.toThrow('exit');

        expect(printError).toHaveBeenCalledWith(expect.stringContaining('Major malfunction'));
        expect(exitSpy).toHaveBeenCalledWith(1);
    });
});
