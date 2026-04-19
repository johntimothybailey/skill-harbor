import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import { dockAction } from './dock';
import { getManifestManager } from '../utils';
import { printHeader, printSuccess, printError, printInfo } from '../ui';
import { ProfilerService } from '../services/profiler';

vi.mock('../utils');
vi.mock('../ui');
vi.mock('spinnies');
vi.mock('node:fs/promises');
vi.mock('../services/profiler');

describe('dockAction', () => {
    let mockManifestManager: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockManifestManager = {
            init: vi.fn().mockResolvedValue(undefined),
            migrateLegacyOverrides: vi.fn().mockResolvedValue(false),
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
            sourceType: 'single',
            localPath: '',
        }, "shared");
        expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('Skill successfully manifested!'));
    });

    it('should detect a local collection folder and mark it as a folder source', async () => {
        const source = './rulesync-skills';
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
        vi.mocked(fs.access)
            .mockRejectedValueOnce(new Error('missing root skill'))
            .mockResolvedValue(undefined);
        (ProfilerService as any).mockImplementation(function() {
            return {
            findSkills: vi.fn().mockResolvedValue(['/workspace/rulesync-skills/a', '/workspace/rulesync-skills/b'])
            };
        });

        await dockAction(source, options, mockCommand);

        expect(mockManifestManager.addSkill).toHaveBeenCalledWith(expect.objectContaining({
            source,
            sourceType: 'folder',
        }), 'shared');
        expect(printInfo).toHaveBeenCalledWith(
            'Folder Source Detected',
            expect.stringContaining("rescan it during 'up' and 'freshen'")
        );
    });

    it('should register override docks in the overrides manifest layer', async () => {
        const url = '';
        const options = { override: true };
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };

        await dockAction(url, options, mockCommand);

        expect(mockManifestManager.migrateLegacyOverrides).toHaveBeenCalled();
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
