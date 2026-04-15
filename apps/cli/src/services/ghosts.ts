import fs from "node:fs/promises";
import path from "node:path";
import { exists, getAgentBerths, getStowageBerths } from "../utils";
import { HarborManifest, ManifestManager } from "../manifest";
import { ProfilerService } from "./profiler";

export type GhostRecord = {
    name: string;
    path: string;
    location: "berth" | "stowage";
    berthLabel: string;
    friendly: boolean;
};

type FriendlyGhostState = {
    friendlyGhosts: Record<string, { name: string; path: string; notedAt: string }>;
};

function getGhostsStatePath(cwd: string): string {
    return path.join(cwd, ".harbor", "ghosts.json");
}

function ghostKey(ghostPath: string): string {
    return path.resolve(ghostPath);
}

export async function readFriendlyGhostState(cwd: string): Promise<FriendlyGhostState> {
    const statePath = getGhostsStatePath(cwd);
    if (!(await exists(statePath))) {
        return { friendlyGhosts: {} };
    }

    try {
        const raw = await fs.readFile(statePath, "utf-8");
        const parsed = JSON.parse(raw) as FriendlyGhostState;
        return {
            friendlyGhosts: parsed.friendlyGhosts || {}
        };
    } catch {
        return { friendlyGhosts: {} };
    }
}

export async function writeFriendlyGhostState(cwd: string, state: FriendlyGhostState): Promise<void> {
    const statePath = getGhostsStatePath(cwd);
    await fs.mkdir(path.dirname(statePath), { recursive: true });
    await fs.writeFile(statePath, JSON.stringify(state, null, 2) + "\n", "utf-8");
}

export async function markGhostsFriendly(cwd: string, ghosts: Array<{ name: string; path: string }>): Promise<void> {
    const state = await readFriendlyGhostState(cwd);
    const now = new Date().toISOString();

    for (const ghost of ghosts) {
        state.friendlyGhosts[ghostKey(ghost.path)] = {
            name: ghost.name,
            path: ghost.path,
            notedAt: now
        };
    }

    await writeFriendlyGhostState(cwd, state);
}

export async function discoverGhosts(params: {
    baseDir: string;
    manifestManager: ManifestManager;
    manifest: HarborManifest;
    profiler?: ProfilerService;
}): Promise<GhostRecord[]> {
    const { baseDir, manifestManager, manifest } = params;
    const profiler = params.profiler ?? new ProfilerService();
    const skills = manifestManager.materializeSkills(manifest);
    const manifestSkillNames = new Set(skills.map(skill => skill.name));
    const state = await readFriendlyGhostState(baseDir);
    const ghosts: GhostRecord[] = [];

    const activeBerths = await getAgentBerths(baseDir, manifest.targets);
    const stowageBerths = await getStowageBerths(baseDir, manifest.targets);

    const registerGhost = (ghostPath: string, berthLabel: string, location: "berth" | "stowage") => {
        const name = path.basename(ghostPath);
        if (manifestSkillNames.has(name)) {
            return;
        }
        if (ghosts.some(existing => existing.path === ghostPath)) {
            return;
        }

        ghosts.push({
            name,
            path: ghostPath,
            berthLabel,
            location,
            friendly: Boolean(state.friendlyGhosts[ghostKey(ghostPath)])
        });
    };

    for (const berth of activeBerths) {
        const foundPaths = await profiler.findSkills(berth.path);
        for (const skillPath of foundPaths) {
            registerGhost(skillPath, berth.label, "berth");
        }
    }

    for (const berth of stowageBerths) {
        const foundPaths = await profiler.findSkills(berth.path);
        for (const skillPath of foundPaths) {
            registerGhost(skillPath, berth.label, "stowage");
        }
    }

    return ghosts.sort((left, right) => left.name.localeCompare(right.name));
}

export function summarizeGhosts(ghosts: GhostRecord[]) {
    const active = ghosts.filter(ghost => !ghost.friendly);
    const friendly = ghosts.filter(ghost => ghost.friendly);
    return { active, friendly };
}
