import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ManifestManager } from "./manifest";

export type AgentBerth = { path: string; label: string; key: string };

export async function exists(path: string): Promise<boolean> {
    try {
        await fs.access(path);
        return true;
    } catch {
        return false;
    }
}

export function getManifestManager(options: any) {
    if (options.global) {
        return new ManifestManager({ customPath: ManifestManager.getGlobalPath() });
    }
    return new ManifestManager();
}

    /**
 * Returns a list of active agent skill directories.
 */
export async function getAgentBerths(baseDir: string, targets?: string[]): Promise<AgentBerth[]> {
    const hasExplicitTargets = Array.isArray(targets) && targets.length > 0;
    const targetConfigs = [
        { path: path.join(baseDir, ".claude", "skills"), label: "Claude", key: "claude" },
        { path: path.join(baseDir, ".cursor", "skills"), label: "Cursor", key: "cursor" },
        { path: path.join(baseDir, ".antigravity", "skills"), label: "Antigravity", key: "antigravity" }
    ];
    
    const rulesyncBase = path.join(os.homedir(), ".rulesync", "skills");
    targetConfigs.push({ path: rulesyncBase, label: "Rulesync", key: "rulesync" });

    const activeTargets: AgentBerth[] = [];
    for (const target of targetConfigs) {
        let isActive = false;
        
        if (hasExplicitTargets) {
            isActive = targets!.includes(target.key);
        } else {
            if (target.key === "rulesync") {
                isActive = await exists(rulesyncBase);
            } else {
                // If baseDir is home, we check parent of path
                const parentDir = path.dirname(target.path);
                isActive = await exists(parentDir) || await exists(target.path);
            }
        }
        
        if (isActive) {
            activeTargets.push(target);
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
