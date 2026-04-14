import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { migrateAction } from './migrate';
import { printError, printHeader, printSuccess } from '../ui';

vi.mock('../ui');
vi.mock('node:readline', () => ({
    default: {
        createInterface: vi.fn(() => ({
            question: (_query: string, cb: (answer: string) => void) => cb('y'),
            close: vi.fn(),
        }))
    }
}));

describe('migrateAction', () => {
    let workspaceDir: string;

    beforeEach(async () => {
        vi.clearAllMocks();
        workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-harbor-migrate-'));
        vi.spyOn(process, 'cwd').mockReturnValue(workspaceDir);
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await fs.rm(workspaceDir, { recursive: true, force: true });
    });

    it('renames the legacy local manifest to the overrides manifest path', async () => {
        await fs.writeFile(
            path.join(workspaceDir, 'harbor-manifest.local.json'),
            JSON.stringify({ version: '1.0', dependencies: {}, skills: {} }),
            'utf-8'
        );

        await migrateAction({});

        await expect(fs.access(path.join(workspaceDir, 'harbor-manifest.local.json'))).rejects.toThrow();
        await fs.access(path.join(workspaceDir, '.harbor', 'harbor-manifest.overrides.json'));
        expect(printHeader).toHaveBeenCalledWith('Skill Harbor: Migration Engine', 'Converting project to consolidated .harbor/ layout.');
        expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('Migration Complete'));
        expect(printError).not.toHaveBeenCalled();
    });
});
