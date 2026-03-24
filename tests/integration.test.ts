import { describe, it, expect } from 'vitest';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';

const execAsync = util.promisify(exec);
const CLI_PATH = path.resolve(__dirname, '../src/index.ts');

const runCommand = async (args: string) => {
    return execAsync(`bun ${CLI_PATH} ${args}`);
};

describe('Skill Harbor CLI Integration Tests', () => {
    it('should display help information correctly', async () => {
        const { stdout } = await runCommand('--help');
        expect(stdout).toContain('Usage:');
        expect(stdout).toContain('The Workspace Sync Engine for AI Agents');
    });

    it('should run the "list" command successfully', async () => {
        const { stdout, stderr } = await runCommand('list');
        expect(stderr).not.toMatch(/error/i);
        expect(stdout).toContain('Fleet Manifest');
    });

    it('should run the "check" command without crashing and display health message', async () => {
        const { stdout, stderr } = await runCommand('check');
        expect(stderr).not.toMatch(/error/i);
        expect(stdout).toContain('Lighthouse Health Check');
    });

    it('should run the "lighthouse" command and generate intellect snippet', async () => {
        const { stdout, stderr } = await runCommand('lighthouse');
        expect(stderr).not.toMatch(/error/i);
        expect(stdout).toContain('Fleet Intelligence Snippet');
    });
});
