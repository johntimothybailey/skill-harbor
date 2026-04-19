import { beforeEach, describe, expect, it, vi } from 'vitest';
import prompts from 'prompts';
import { ghostsAction } from './ghosts';
import { resolveCommandScope } from '../command-scope';
import { formatBerthDetail, getManifestManager } from '../utils';
import {
    discoverGhosts,
    markGhostsFriendly,
    readGhostMetadata,
    resolveGhostScanContext,
    resolveGhostScanMode,
    summarizeGhosts
} from '../services/ghosts';
import { printHeader, printInfo, printSuccess } from '../ui';

vi.mock('prompts');
vi.mock('../command-scope');
vi.mock('../utils');
vi.mock('../services/ghosts');
vi.mock('../ui');
vi.mock('node:os');

describe('ghostsAction', () => {
  let mockManifestManager: any;
  const mockScanContext = {
    activeBerths: [],
    stowageBerths: [],
    scanMode: 'autodetect'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });

    mockManifestManager = {
      read: vi.fn().mockResolvedValue({ skills: {} }),
      readMerged: vi.fn().mockResolvedValue({ skills: {} }),
    };
    (resolveCommandScope as any).mockResolvedValue({ useGlobalScope: false, shouldStop: false });
    (getManifestManager as any).mockReturnValue(mockManifestManager);
    (formatBerthDetail as any).mockImplementation((detail: any) => detail.location ? `${detail.label} | ${detail.location}` : detail.label);
    (resolveGhostScanMode as any).mockImplementation((rawMode?: string) => rawMode ?? 'autodetect');
    (resolveGhostScanContext as any).mockResolvedValue(mockScanContext);
    (summarizeGhosts as any).mockImplementation((ghosts: any[]) => ({
      active: ghosts.filter(ghost => !ghost.friendly),
      friendly: ghosts.filter(ghost => ghost.friendly),
    }));
  });

  it('reports when no ghosts are found', async () => {
    (discoverGhosts as any).mockResolvedValue([]);

    await ghostsAction({}, { opts: () => ({}) });

    expect(resolveGhostScanMode).toHaveBeenCalledWith(undefined);
    expect(resolveGhostScanContext).toHaveBeenCalledWith(expect.objectContaining({
      scanMode: 'autodetect'
    }));
    expect(discoverGhosts).toHaveBeenCalledWith(expect.objectContaining({
      scanContext: mockScanContext
    }));
    expect(printInfo).toHaveBeenCalledWith('No Ghosts Found', expect.any(String));
  });

  it('passes the explicit scan mode through to ghost discovery', async () => {
    (discoverGhosts as any).mockResolvedValue([]);

    await ghostsAction({}, { opts: () => ({ scanMode: 'targets-only' }) });

    expect(resolveGhostScanMode).toHaveBeenCalledWith('targets-only');
    expect(resolveGhostScanContext).toHaveBeenCalledWith(expect.objectContaining({
      scanMode: 'targets-only'
    }));
  });

  it('shows a friendly ghost summary by default', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    (discoverGhosts as any).mockResolvedValue([
      { name: 'angry-skill', path: '/tmp/angry-skill', location: 'berth', berthLabel: 'Codex', berthLocation: '.codex', friendly: false },
      { name: 'calm-skill', path: '/tmp/calm-skill', location: 'stowage', berthLabel: 'Codex', friendly: true },
    ]);
    (prompts as any).mockResolvedValue({ action: 'skip' });

    await ghostsAction({}, { opts: () => ({}) });

    expect(printHeader).toHaveBeenCalledWith('Ghosts: Fleet Drift Inspection');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('(berth: Codex | .codex)'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('friendly ghost'));
    expect(markGhostsFriendly).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('marks selected ghosts as friendly during the interactive flow', async () => {
    (discoverGhosts as any).mockResolvedValue([
      { name: 'angry-skill', path: '/tmp/angry-skill', location: 'berth', berthLabel: 'Codex', friendly: false },
    ]);
    (prompts as any)
      .mockResolvedValueOnce({ action: 'friendly' })
      .mockResolvedValueOnce({ selected: ['/tmp/angry-skill'] });

    await ghostsAction({}, { opts: () => ({}) });

    expect(markGhostsFriendly).toHaveBeenCalledWith(process.cwd(), [
      expect.objectContaining({ name: 'angry-skill', path: '/tmp/angry-skill' })
    ]);
    expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('Marked 1 ghost'));
  });

  it('shows the separate friendly section when --friendly is provided', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    (discoverGhosts as any).mockResolvedValue([
      { name: 'calm-skill', path: '/tmp/calm-skill', location: 'stowage', berthLabel: 'Codex', friendly: true },
    ]);

    await ghostsAction({}, { opts: () => ({ friendly: true }) });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Friendly Ghosts'));
    expect(markGhostsFriendly).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('shows full path and metadata when --details is provided', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    (discoverGhosts as any).mockResolvedValue([
      { name: 'angry-skill', path: '/tmp/angry-skill', location: 'berth', berthLabel: 'Codex', berthLocation: '.codex', friendly: false },
    ]);
    (readGhostMetadata as any).mockResolvedValue({
      description: 'A detailed ghost skill',
      triggers: ['angry-skill'],
      tags: ['test']
    });
    (prompts as any).mockResolvedValue({ action: 'skip' });

    await ghostsAction({}, { opts: () => ({ details: true }) });

    expect(readGhostMetadata).toHaveBeenCalledWith('/tmp/angry-skill');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('path:'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('/tmp/angry-skill'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('metadata:'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('description:'));
    logSpy.mockRestore();
  });

  it('shows metadata none when no frontmatter is available', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    (discoverGhosts as any).mockResolvedValue([
      { name: 'angry-skill', path: '/tmp/angry-skill', location: 'berth', berthLabel: 'Codex', berthLocation: '.codex', friendly: false },
    ]);
    (readGhostMetadata as any).mockResolvedValue({});
    (prompts as any).mockResolvedValue({ action: 'skip' });

    await ghostsAction({}, { opts: () => ({ details: true }) });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('metadata:'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('none'));
    logSpy.mockRestore();
  });

  it('never prompts in non-interactive mode', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });
    (discoverGhosts as any).mockResolvedValue([
      { name: 'angry-skill', path: '/tmp/angry-skill', location: 'berth', berthLabel: 'Codex', friendly: false },
    ]);

    await ghostsAction({}, { opts: () => ({}) });

    expect(prompts).not.toHaveBeenCalled();
    expect(markGhostsFriendly).not.toHaveBeenCalled();
  });
});
