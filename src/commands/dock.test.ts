import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dockAction } from './dock';
import { getManifestManager } from '../utils';
import { printHeader, printSuccess, printError } from '../ui';

vi.mock('../utils');
vi.mock('../ui');
vi.mock('../manifest');

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
        });
        expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('Skill successfully manifested! Added my-skill.'));
    });

    it('should generate a skill name if the URL is empty or invalid', async () => {
        const url = '';
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };

        await dockAction(url, options, mockCommand);

        expect(mockManifestManager.addSkill).toHaveBeenCalledWith(expect.objectContaining({
            source: url,
            localPath: '',
        }));
        const callArgs = (mockManifestManager.addSkill as any).mock.calls[0][0];
        expect(callArgs.name).toMatch(/^skill-/);
    });

    it('should handle errors and exit processing', async () => {
        const url = 'some-url';
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        const errorMessage = 'Init failed';
        mockManifestManager.init.mockRejectedValue(new Error(errorMessage));

        const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });

        await expect(dockAction(url, options, mockCommand)).rejects.toThrow('exit');

        expect(printError).toHaveBeenCalledWith(expect.stringContaining(errorMessage));
        expect(exitSpy).toHaveBeenCalledWith(1);
    });
});
