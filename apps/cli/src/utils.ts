import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ManifestManager } from "./manifest";

export type AgentBerth = { path: string; label: string; key: string };
export type BerthDetail = { label: string; location?: string };

export async function exists(path: string): Promise<boolean> {
    try {
        await fs.access(path);
        return true;
    } catch {
        return false;
    }
}

export function getAgentBerthLocation(berth: AgentBerth): string | undefined {
    const normalizedPath = berth.path.split(path.sep).join("/");

    if (normalizedPath.includes("/.harbor/stowage/")) {
        return `.stowage/${berth.key}`;
    }

    if (normalizedPath.includes("/.gemini/antigravity/")) {
        return ".gemini/antigravity";
    }

    const knownRoots = [
        ".agents",
        ".codex",
        ".claude",
        ".cursor",
        ".gemini",
        ".rulesync",
        ".windsurf",
        ".continue",
        ".github"
    ];

    for (const root of knownRoots) {
        if (normalizedPath.includes(`/${root}/`)) {
            return root;
        }
    }

    return undefined;
}

export function formatBerthDetail(detail: BerthDetail): string {
    return detail.location ? `${detail.label} | ${detail.location}` : detail.label;
}

export function getManifestManager(options: any) {
    if (options.global) {
        return new ManifestManager({
            cwd: os.homedir(),
            customPath: ManifestManager.getGlobalPath()
        });
    }
    return new ManifestManager();
}

export function getManagedAgentTargets(baseDir: string, includeRulesync = true): AgentBerth[] {
    const targets: AgentBerth[] = [
        { path: path.join(baseDir, ".claude", "skills"), label: "Claude", key: "claude" },
        { path: path.join(baseDir, ".cursor", "skills"), label: "Cursor", key: "cursor" },
        { path: path.join(baseDir, ".gemini", "antigravity", "skills"), label: "Antigravity", key: "antigravity" },
        { path: path.join(baseDir, ".gemini", "skills"), label: "Gemini", key: "gemini" },
        { path: path.join(baseDir, ".windsurf", "rules"), label: "Windsurf", key: "windsurf" },
        { path: path.join(baseDir, ".continue", "rules"), label: "Continue", key: "continue" },
        { path: path.join(baseDir, ".github", "instructions"), label: "Copilot", key: "copilot" },
        { path: path.join(baseDir, ".codex", "skills"), label: "Codex", key: "codex" }
    ];

    if (includeRulesync) {
        targets.push({ path: path.join(os.homedir(), ".rulesync", "skills"), label: "Rulesync", key: "rulesync" });
    }

    return targets;
}

export function getSupportedTargetKeys(includeRulesync = true): string[] {
    return getManagedAgentTargets("", includeRulesync).map(target => target.key);
}

function getCodexSkillDirCandidates(baseDir: string): string[] {
    return [
        path.join(baseDir, ".codex", "skills"),
        path.join(baseDir, ".agents", "skills")
    ];
}

async function resolveCodexSkillDir(baseDir: string): Promise<string> {
    const candidates = getCodexSkillDirCandidates(baseDir);

    for (const candidate of candidates) {
        if (await exists(candidate)) {
            return candidate;
        }
    }

    for (const candidate of candidates) {
        if (await exists(path.dirname(candidate))) {
            return candidate;
        }
    }

    return candidates[0];
}

async function hasActiveCodexBerth(baseDir: string): Promise<boolean> {
    const candidates = getCodexSkillDirCandidates(baseDir);

    for (const candidate of candidates) {
        if (await exists(path.dirname(candidate)) || await exists(candidate)) {
            return true;
        }
    }

    return false;
}

/**
 * Returns a list of active agent skill directories.
 */
export async function getAgentBerths(baseDir: string, targets?: string[]): Promise<AgentBerth[]> {
    const hasExplicitTargets = Array.isArray(targets) && targets.length > 0;
    const rulesyncBase = path.join(os.homedir(), ".rulesync", "skills");
    const targetConfigs = getManagedAgentTargets(baseDir);

    const activeTargets: AgentBerth[] = [];
    for (const target of targetConfigs) {
        let isActive = false;
        let targetPath = target.path;

        if (target.key === "codex") {
            targetPath = await resolveCodexSkillDir(baseDir);
        }
        
        if (hasExplicitTargets) {
            isActive = targets!.includes(target.key);
        } else {
            if (target.key === "rulesync") {
                isActive = await exists(rulesyncBase);
            } else if (target.key === "codex") {
                isActive = await hasActiveCodexBerth(baseDir);
            } else {
                // If baseDir is home, we check parent of path
                const parentDir = path.dirname(target.path);
                isActive = await exists(parentDir) || await exists(target.path);
            }
        }
        
        if (isActive) {
            activeTargets.push({
                ...target,
                path: targetPath
            });
        }
    }
    
    return activeTargets;
}

/**
 * Returns a list of agent stowage directories.
 */
export async function getStowageBerths(baseDir: string, targets?: string[]): Promise<AgentBerth[]> {
    const hasExplicitTargets = Array.isArray(targets) && targets.length > 0;
    const stowageBase = path.join(baseDir, ".harbor", "stowage");
    
    const targetConfigs = [
        { path: path.join(stowageBase, "claude"), label: "Claude", key: "claude" },
        { path: path.join(stowageBase, "cursor"), label: "Cursor", key: "cursor" },
        { path: path.join(stowageBase, "antigravity"), label: "Antigravity", key: "antigravity" },
        { path: path.join(stowageBase, "gemini"), label: "Gemini", key: "gemini" },
        { path: path.join(stowageBase, "windsurf"), label: "Windsurf", key: "windsurf" },
        { path: path.join(stowageBase, "continue"), label: "Continue", key: "continue" },
        { path: path.join(stowageBase, "copilot"), label: "Copilot", key: "copilot" },
        { path: path.join(stowageBase, "codex"), label: "Codex", key: "codex" },
        { path: path.join(stowageBase, "rulesync"), label: "Rulesync", key: "rulesync" }
    ];
    
    const activeStowage: AgentBerth[] = [];
    for (const target of targetConfigs) {
        let isActive = false;
        
        if (hasExplicitTargets) {
            isActive = targets!.includes(target.key);
        } else {
            isActive = await exists(target.path);
        }
        
        if (isActive) {
            activeStowage.push(target);
        }
    }
    
    return activeStowage;
}

/**
 * Interactive CLI prompt for Yes/No questions.
 */
export async function ask(query: string, kleur: any): Promise<boolean> {
    const readline = await import("node:readline");
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(`${kleur.bold().yellow("🤔 " + query) + " "} ${kleur.gray("(y/N)")} `, (answer: string) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y');
        });
    });
}
