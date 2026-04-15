import { beforeEach, describe, expect, it, vi } from 'vitest';
import prompts from 'prompts';
import { ghostsAction } from './ghosts';
import { resolveCommandScope } from '../command-scope';
import { getManifestManager } from '../utils';
import { discoverGhosts, markGhostsFriendly, summarizeGhosts } from '../services/ghosts';
import { printHeader, printInfo, printSuccess } from '../ui';

vi.mock('prompts');
vi.mock('../command-scope');
vi.mock('../utils');
vi.mock('../services/ghosts');
vi.mock('../ui');
vi.mock('node:os');

describe('ghostsAction', () => {
  let mockManifestManager: any;

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
    (summarizeGhosts as any).mockImplementation((ghosts: any[]) => ({
      active: ghosts.filter(ghost => !ghost.friendly),
      friendly: ghosts.filter(ghost => ghost.friendly),
    }));
  });

  it('reports when no ghosts are found', async () => {
    (discoverGhosts as any).mockResolvedValue([]);

    await ghostsAction({}, { opts: () => ({}) });

    expect(printInfo).toHaveBeenCalledWith('No Ghosts Found', expect.any(String));
  });

  it('shows a friendly ghost summary by default', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    (discoverGhosts as any).mockResolvedValue([
      { name: 'angry-skill', path: '/tmp/angry-skill', location: 'berth', berthLabel: 'Codex', friendly: false },
      { name: 'calm-skill', path: '/tmp/calm-skill', location: 'stowage', berthLabel: 'Codex', friendly: true },
    ]);
    (prompts as any).mockResolvedValue({ action: 'skip' });

    await ghostsAction({}, { opts: () => ({}) });

    expect(printHeader).toHaveBeenCalledWith('Ghosts: Fleet Drift Inspection');
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
});
