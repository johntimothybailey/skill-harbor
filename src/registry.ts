import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

export interface Berth {
    name: string;
    path: string;
}

export const DEFAULT_BERTHS: Record<string, string> = {
    claude: "~/.claude/skills/",
    antigravity: "~/.gemini/antigravity/skills/",
    gemini: "~/.gemini/commands/",
    codex: "~/.codex/skills/",
};

export class Registry {
    static resolvePath(rawPath: string): string {
        if (rawPath.startsWith("~")) {
            return path.join(os.homedir(), rawPath.slice(1));
        }
        return path.resolve(rawPath);
    }

    static async getBerthPath(agent: string): Promise<string> {
        const rawPath = DEFAULT_BERTHS[agent];
        if (!rawPath) {
            throw new Error(`Unknown berth: ${agent}. Admiral only recognizes: ${Object.keys(DEFAULT_BERTHS).join(", ")}`);
        }
        const resolvedPath = this.resolvePath(rawPath);

        // Ensure the berth exists
        await fs.mkdir(resolvedPath, { recursive: true });
        return resolvedPath;
    }

    static async detectWorkspaceBerth(): Promise<string | null> {
        const cwd = process.cwd();
        const nxConfig = path.join(cwd, "nx.json");
        const turboConfig = path.join(cwd, "turbo.json");

        try {
            const statsNx = await fs.stat(nxConfig).catch(() => null);
            const statsTurbo = await fs.stat(turboConfig).catch(() => null);

            if (statsNx || statsTurbo) {
                const localBerth = path.join(cwd, ".agent/skills/");
                await fs.mkdir(localBerth, { recursive: true });
                return localBerth;
            }
        } catch {
            // Ignored
        }

        return null;
    }
}
