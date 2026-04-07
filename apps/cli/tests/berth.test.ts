import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Orchestrator } from '../src/orchestrator';
import Spinnies from 'spinnies';

describe('Orchestrator.berth', () => {
    let tempBase: string;
    let cargoDir: string;
    let targetBase: string;
    let orchestrator: Orchestrator;
    const spinnies = new Spinnies();

    beforeEach(async () => {
        tempBase = path.join(os.tmpdir(), `berth-test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);
        await fs.mkdir(tempBase, { recursive: true });
        
        cargoDir = path.join(tempBase, 'cargo');
        await fs.mkdir(cargoDir);
        await fs.writeFile(path.join(cargoDir, 'test.txt'), 'cargo content');

        targetBase = path.join(tempBase, 'target-base');
        await fs.mkdir(targetBase);

        orchestrator = new Orchestrator({
            skillName: 'TestSkill',
            spinnies,
            debug: false
        });
        
        // Ensure spinner is added so update() works
        spinnies.add(`sync-TestSkill`, { text: 'Testing...' });
    });

    afterEach(async () => {
        await fs.rm(tempBase, { recursive: true, force: true });
    });

    it('should berth successfully to a new directory', async () => {
        const targetPath = path.join(targetBase, 'new-skill');
        const result = await orchestrator.berth(cargoDir, targetPath, 'Test');
        
        expect(result).toBe(true);
        const content = await fs.readFile(path.join(targetPath, 'test.txt'), 'utf-8');
        expect(content).toBe('cargo content');
    });

    it('should berth successfully even if target is a broken symlink', async () => {
        const targetPath = path.join(targetBase, 'broken-link');
        const nonExistent = path.join(tempBase, 'non-existent');
        await fs.symlink(nonExistent, targetPath);

        // Verify it was a broken symlink first
        await expect(fs.access(targetPath)).rejects.toThrow();

        const result = await orchestrator.berth(cargoDir, targetPath, 'Test');
        
        expect(result).toBe(true);
        const content = await fs.readFile(path.join(targetPath, 'test.txt'), 'utf-8');
        expect(content).toBe('cargo content');
        
        const stats = await fs.lstat(targetPath);
        expect(stats.isDirectory()).toBe(true);
        expect(stats.isSymbolicLink()).toBe(false);
    });

    it('should berth successfully even if target is a plain file', async () => {
        const targetPath = path.join(targetBase, 'plain-file');
        await fs.writeFile(targetPath, 'im a file');

        const result = await orchestrator.berth(cargoDir, targetPath, 'Test');
        
        expect(result).toBe(true);
        const content = await fs.readFile(path.join(targetPath, 'test.txt'), 'utf-8');
        expect(content).toBe('cargo content');
        
        const stats = await fs.lstat(targetPath);
        expect(stats.isDirectory()).toBe(true);
    });

    it('should berth successfully through a healthy symlink to a directory', async () => {
        const realDir = path.join(tempBase, 'real-dir');
        await fs.mkdir(realDir);
        const targetPath = path.join(targetBase, 'healthy-link');
        await fs.symlink(realDir, targetPath);

        const result = await orchestrator.berth(cargoDir, targetPath, 'Test');
        
        expect(result).toBe(true);
        const content = await fs.readFile(path.join(targetPath, 'test.txt'), 'utf-8');
        expect(content).toBe('cargo content');
        
        // Should STILL be a symlink
        const stats = await fs.lstat(targetPath);
        expect(stats.isSymbolicLink()).toBe(true);
        
        // Content should be in the real dir
        const realContent = await fs.readFile(path.join(realDir, 'test.txt'), 'utf-8');
        expect(realContent).toBe('cargo content');
    });

    it('should berth successfully even if target is a symlink to a file', async () => {
        const someFile = path.join(tempBase, 'some-file');
        await fs.writeFile(someFile, 'hello');
        const targetPath = path.join(targetBase, 'file-link');
        await fs.symlink(someFile, targetPath);

        const result = await orchestrator.berth(cargoDir, targetPath, 'Test');
        
        expect(result).toBe(true);
        const content = await fs.readFile(path.join(targetPath, 'test.txt'), 'utf-8');
        expect(content).toBe('cargo content');
        
        const stats = await fs.lstat(targetPath);
        expect(stats.isDirectory()).toBe(true);
        expect(stats.isSymbolicLink()).toBe(false);
    });
});
