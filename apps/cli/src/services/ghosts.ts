import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { AgentBerth, exists, getAgentBerths, getAgentBerthLocation, getStowageBerths } from "../utils";
import { HarborManifest, ManifestManager } from "../manifest";
import { ProfilerService } from "./profiler";

export type GhostRecord = {
    name: string;
    path: string;
    location: "berth" | "stowage";
    berthLabel: string;
    berthLocation?: string;
    friendly: boolean;
};

export type GhostScanMode = "autodetect" | "targets-only";

export type GhostScanContext = {
    activeBerths: AgentBerth[];
    stowageBerths: AgentBerth[];
    scanMode: GhostScanMode;
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

async function collectLegacyCodexGhostBerths(baseDir: string, existingBerths: AgentBerth[]): Promise<AgentBerth[]> {
    const legacyCandidates = [
        path.join(baseDir, ".codex", "skills"),
        path.join(baseDir, ".agents", "skills")
    ];

    const knownPaths = new Set(existingBerths.map(berth => berth.path));
    const additionalBerths: AgentBerth[] = [];

    for (const candidate of legacyCandidates) {
        if (knownPaths.has(candidate)) {
            continue;
        }

        if (await exists(candidate) || await exists(path.dirname(candidate))) {
            additionalBerths.push({
                path: candidate,
                label: "Codex",
                key: "codex"
            });
        }
    }

    return additionalBerths;
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

export async function readGhostMetadata(ghostPath: string): Promise<Record<string, unknown>> {
    try {
        const rawContent = await fs.readFile(path.join(ghostPath, "SKILL.md"), "utf-8");
        const { data } = matter(rawContent);
        return data && typeof data === "object" ? data : {};
    } catch {
        return {};
    }
}

export function resolveGhostScanMode(rawMode?: string): GhostScanMode {
    if (!rawMode) {
        return "autodetect";
    }

    if (rawMode === "autodetect" || rawMode === "targets-only") {
        return rawMode;
    }

    throw new Error(`Invalid ghost scan mode '${rawMode}'. Use 'autodetect' or 'targets-only'.`);
}

export async function resolveGhostScanContext(params: {
    baseDir: string;
    targets?: string[];
    scanMode: GhostScanMode;
}): Promise<GhostScanContext> {
    const { baseDir, targets, scanMode } = params;

    if (scanMode === "targets-only" && (!Array.isArray(targets) || targets.length === 0)) {
        return {
            activeBerths: [],
            stowageBerths: [],
            scanMode
        };
    }

    const scopedTargets = scanMode === "targets-only" ? targets : undefined;

    const activeBerths = await getAgentBerths(baseDir, scopedTargets);
    const codexSelected = !Array.isArray(targets) || targets.includes("codex");
    const expandedActiveBerths = codexSelected
        ? [...activeBerths, ...await collectLegacyCodexGhostBerths(baseDir, activeBerths)]
        : activeBerths;

    return {
        activeBerths: expandedActiveBerths,
        stowageBerths: await getStowageBerths(baseDir, scopedTargets),
        scanMode
    };
}

export async function discoverGhosts(params: {
    baseDir: string;
    manifestManager: ManifestManager;
    manifest: HarborManifest;
    scanContext?: GhostScanContext;
    profiler?: ProfilerService;
}): Promise<GhostRecord[]> {
    const { baseDir, manifestManager, manifest } = params;
    const profiler = params.profiler ?? new ProfilerService();
    const skills = manifestManager.materializeSkills(manifest);
    const manifestSkillNames = new Set(skills.map(skill => skill.name));
    const state = await readFriendlyGhostState(baseDir);
    const ghosts: GhostRecord[] = [];
    const scanContext = params.scanContext
        ?? await resolveGhostScanContext({
            baseDir,
            targets: manifest.targets,
            scanMode: "autodetect"
        });
    const { activeBerths, stowageBerths } = scanContext;

    const registerGhost = (ghostPath: string, berth: AgentBerth, location: "berth" | "stowage") => {
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
            berthLabel: berth.label,
            berthLocation: getAgentBerthLocation(berth),
            location,
            friendly: Boolean(state.friendlyGhosts[ghostKey(ghostPath)])
        });
    };

    for (const berth of activeBerths) {
        const foundPaths = await profiler.findSkills(berth.path);
        for (const skillPath of foundPaths) {
            registerGhost(skillPath, berth, "berth");
        }
    }

    for (const berth of stowageBerths) {
        const foundPaths = await profiler.findSkills(berth.path);
        for (const skillPath of foundPaths) {
            registerGhost(skillPath, berth, "stowage");
        }
    }

    return ghosts.sort((left, right) => left.name.localeCompare(right.name));
}

export function summarizeGhosts(ghosts: GhostRecord[]) {
    const active = ghosts.filter(ghost => !ghost.friendly);
    const friendly = ghosts.filter(ghost => ghost.friendly);
    return { active, friendly };
}
