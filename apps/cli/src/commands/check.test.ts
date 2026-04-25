import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkAction } from './check';
import { resolveCommandScope } from '../command-scope';
import { Orchestrator } from '../orchestrator';
import { getAgentBerths, getManifestManager, exists } from '../utils';
import { printHeader, printInfo } from '../ui';
import os from 'node:os';
import { ProfilerService } from '../services/profiler';

vi.mock('../command-scope');
vi.mock('../orchestrator');
vi.mock('../utils');
vi.mock('../ui');
vi.mock('spinnies');
vi.mock('node:os');
vi.mock('../services/profiler');

describe('checkAction', () => {
    let mockOrchestrator: any;
    let mockManifestManager: any;
    let mockProfiler: any;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(process, 'exit').mockImplementation((() => {
            throw new Error('exit');
        }) as any);
        mockOrchestrator = {
            getMetadata: vi.fn().mockResolvedValue({ name: 'skill1', description: 'desc', triggers: [] }),
        };
        mockManifestManager = {
            read: vi.fn().mockResolvedValue({
                skills: {
                    'skill1': { name: 'skill1', source: 'source1', layer: 'shared' }
                }
            }),
            readMerged: vi.fn().mockResolvedValue({
                skills: {
                    'skill1': { name: 'skill1', source: 'source1', layer: 'shared' }
                }
            }),
            materializeSkills: vi.fn().mockImplementation((manifest: any) => Object.values(manifest.skills || {})),
            getSkillsCacheDir: vi.fn().mockReturnValue('/harbor'),
            getHarborDir: vi.fn().mockReturnValue('/harbor'),
        };
        mockProfiler = {
            getContractValidation: vi.fn().mockResolvedValue({
                missingStandard: false,
                requires: { input_text: 'string' },
                produces: { summary: 'json' },
                isValid: true,
                status: 'valid',
                errors: [],
                warnings: []
            })
        };
        (resolveCommandScope as any).mockResolvedValue({ useGlobalScope: false, shouldStop: false });
        (Orchestrator as any).mockImplementation(function() { return mockOrchestrator; });
        (ProfilerService as any).mockImplementation(function() { return mockProfiler; });
        (getManifestManager as any).mockReturnValue(mockManifestManager);
        (getAgentBerths as any).mockResolvedValue([
            { path: '/app/.claude/skills', label: 'Claude', key: 'claude' },
            { path: '/app/.agents/skills', label: 'Codex', key: 'codex' }
        ]);
        (os.homedir as any).mockReturnValue('/home/user');
        (exists as any).mockImplementation(() => Promise.resolve(true));
    });

    it('should perform health check on docked skills', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };

        await checkAction(options, mockCommand);

        expect(printHeader).toHaveBeenCalledWith('Lighthouse Health Check');
        expect(mockOrchestrator.getMetadata).toHaveBeenCalled();
        expect(mockProfiler.getContractValidation).toHaveBeenCalled();
    });

    it('should handle empty harbor', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        mockManifestManager.readMerged.mockResolvedValue({
            skills: {}
        });

        await checkAction(options, mockCommand);

        expect(printInfo).toHaveBeenCalledWith('Empty Harbor', expect.any(String));
    });

    it('should stop without checking when scope resolution says to stop', async () => {
        const options = {};
        const mockCommand = {
            opts: vi.fn().mockReturnValue(options),
        };
        (resolveCommandScope as any).mockResolvedValue({ useGlobalScope: false, shouldStop: true });

        await checkAction(options, mockCommand);

        expect(mockManifestManager.readMerged).not.toHaveBeenCalled();
        expect(mockOrchestrator.getMetadata).not.toHaveBeenCalled();
    });

    it('fails when contracts are invalid', async () => {
        const options = {};
        const mockCommand = { opts: vi.fn().mockReturnValue(options) };
        mockProfiler.getContractValidation.mockResolvedValue({
            missingStandard: false,
            requires: {},
            produces: {},
            isValid: false,
            status: 'invalid',
            errors: ["contracts.produces.summary has unknown type 'structured-json-ish'"],
            warnings: []
        });

        await expect(checkAction(options, mockCommand)).rejects.toThrow('exit');
    });

    it('warns but does not fail on missing contracts by default', async () => {
        const options = {};
        const mockCommand = { opts: vi.fn().mockReturnValue(options) };
        mockProfiler.getContractValidation.mockResolvedValue({
            missingStandard: true,
            requires: {},
            produces: {},
            isValid: true,
            status: 'missing',
            errors: [],
            warnings: []
        });

        await checkAction(options, mockCommand);
    });

    it('fails missing contracts in strict mode', async () => {
        const options = { strict: true };
        const mockCommand = { opts: vi.fn().mockReturnValue(options) };
        mockProfiler.getContractValidation.mockResolvedValue({
            missingStandard: true,
            requires: {},
            produces: {},
            isValid: true,
            status: 'missing',
            errors: [],
            warnings: []
        });

        await expect(checkAction(options, mockCommand)).rejects.toThrow('exit');
    });

    it('warns on underspecified contracts by default but fails them in strict mode', async () => {
        const warningContracts = {
            missingStandard: false,
            requires: { input_text: 'any' },
            produces: {},
            isValid: true,
            status: 'valid',
            errors: [],
            warnings: ['contracts.requires.input_text is underspecified.']
        };

        const defaultOptions = {};
        const defaultCommand = { opts: vi.fn().mockReturnValue(defaultOptions) };
        mockProfiler.getContractValidation.mockResolvedValueOnce(warningContracts);
        await checkAction(defaultOptions, defaultCommand);

        const strictOptions = { strict: true };
        const strictCommand = { opts: vi.fn().mockReturnValue(strictOptions) };
        mockProfiler.getContractValidation.mockResolvedValueOnce(warningContracts);
        await expect(checkAction(strictOptions, strictCommand)).rejects.toThrow('exit');
    });
});
