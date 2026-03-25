import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export interface SkillEntry {
    name: string;
    version?: string;
    description?: string;
    source: string; // URL, git, or local path
    localPath: string; // Path within .harbor
}

export interface HarborManifest {
    version: string;
    targets?: string[]; // e.g. ["claude", "cursor", "antigravity", "rulesync"]
    dependencies: Record<string, string>; // "skill-name": "version/source"
    skills: Record<string, SkillEntry>;
}

export class ManifestManager {
    private manifestPath: string;
    private harborDir: string;

    constructor(options?: { cwd?: string; customPath?: string }) {
        if (options?.customPath) {
            this.manifestPath = options.customPath;
            this.harborDir = path.dirname(options.customPath);
        } else {
            const cwd = options?.cwd || process.cwd();
            this.manifestPath = path.join(cwd, "harbor-manifest.json");
            this.harborDir = path.join(cwd, ".harbor");
        }
    }

    public static getGlobalPath(): string {
        return path.join(os.homedir(), ".harbor", "harbor-manifest.json");
    }

    public async init(): Promise<void> {
        await fs.mkdir(this.harborDir, { recursive: true });
        try {
            await fs.access(this.manifestPath);
        } catch {
            const initialManifest: HarborManifest = {
                version: "1.0",
                dependencies: {},
                skills: {}
            };
            await this.write(initialManifest);
        }
    }

    public async read(): Promise<HarborManifest> {
        await this.init();
        const data = await fs.readFile(this.manifestPath, "utf-8");
        return JSON.parse(data) as HarborManifest;
    }

    public async write(manifest: HarborManifest): Promise<void> {
        await fs.writeFile(this.manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
    }

    public async addSkill(entry: SkillEntry): Promise<void> {
        const manifest = await this.read();
        if (!manifest.dependencies) manifest.dependencies = {};
        if (!manifest.skills) manifest.skills = {};
        manifest.dependencies[entry.name] = entry.source;
        manifest.skills[entry.name] = entry;
        await this.write(manifest);
    }

    public getHarborDir(): string {
        return this.harborDir;
    }
}
