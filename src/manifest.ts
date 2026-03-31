import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export type ManifestLayer = "global" | "shared" | "local";

export interface SkillEntry {
    name: string;
    version?: string;
    description?: string;
    source: string; // URL, git, or local path
    localPath: string; // Path within .harbor
    lastSyncHash?: string; // Cache the source string to detect changes
    lastSyncTargets?: string[]; // Cache the successful berthing targets
    layer?: ManifestLayer; // Tracks which manifest file this was defined in
}

export interface HarborManifest {
    version: string;
    targets?: string[]; // e.g. ["claude", "cursor", "antigravity", "codex", "rulesync"]
    dependencies: Record<string, string>; // "skill-name": "version/source"
    skills: Record<string, SkillEntry>;
    overrides?: string[]; // Optional names of skills being overridden in the current stack
}

export class ManifestManager {
    private manifestPath: string;
    private harborDir: string;
    private cwd: string;

    constructor(options?: { cwd?: string; customPath?: string }) {
        this.cwd = options?.cwd || process.cwd();
        if (options?.customPath) {
            this.manifestPath = options.customPath;
            this.harborDir = path.dirname(options.customPath);
        } else {
            this.manifestPath = path.join(this.cwd, "harbor-manifest.json");
            this.harborDir = path.join(this.cwd, ".harbor");
        }
    }

    public static getGlobalPath(): string {
        return path.join(os.homedir(), ".harbor", "harbor-manifest.json");
    }

    public getLocalPath(): string {
        return path.join(this.cwd, "harbor-manifest.local.json");
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

    public async read(type: ManifestLayer = "shared"): Promise<HarborManifest> {
        let filePath = this.manifestPath;
        if (type === "global") filePath = ManifestManager.getGlobalPath();
        if (type === "local") filePath = this.getLocalPath();

        try {
            const data = await fs.readFile(filePath, "utf-8");
            const manifest = JSON.parse(data) as HarborManifest;
            // Mark layer on skills
            if (manifest.skills) {
                for (const skill of Object.values(manifest.skills)) {
                    skill.layer = type;
                }
            }
            return manifest;
        } catch {
            return { version: "1.0", dependencies: {}, skills: {} };
        }
    }

    /**
     * Reads all layers (Global, Shared, Local) and merges them.
     * Priority: Local > Shared > Global
     */
    public async readMerged(): Promise<HarborManifest> {
        const globalManifest = await this.read("global");
        const sharedManifest = await this.read("shared");
        const localManifest = await this.read("local");

        const mergedSkills: Record<string, SkillEntry> = {};
        const overrides: string[] = [];

        // Apply Global
        if (globalManifest.skills) {
            for (const [name, skill] of Object.entries(globalManifest.skills)) {
                mergedSkills[name] = { ...skill, layer: "global" };
            }
        }

        // Apply Shared (Overrides Global)
        if (sharedManifest.skills) {
            for (const [name, skill] of Object.entries(sharedManifest.skills)) {
                mergedSkills[name] = { ...skill, layer: "shared" };
            }
        }

        // Apply Local (Overrides Shared and Global)
        if (localManifest.skills) {
            for (const [name, skill] of Object.entries(localManifest.skills)) {
                if (mergedSkills[name]) {
                    overrides.push(name);
                }
                mergedSkills[name] = { ...skill, layer: "local" };
            }
        }

        // Merge targets (Unique set)
        const allTargets = new Set([
            ...(globalManifest.targets || []),
            ...(sharedManifest.targets || []),
            ...(localManifest.targets || [])
        ]);

        // Normalize local paths relative to manifest location
        for (const [name, skill] of Object.entries(mergedSkills)) {
            if (skill.source.startsWith('.') || skill.source.startsWith('file://.')) {
                let manifestDir = this.cwd;
                if (skill.layer === "global") manifestDir = path.dirname(ManifestManager.getGlobalPath());
                
                const rawPath = skill.source.replace('file://', '');
                const absolutePath = path.resolve(manifestDir, rawPath);
                // Maintain file:// protocol if it was present
                skill.source = skill.source.startsWith('file://') ? `file://${absolutePath}` : absolutePath;
            }
        }

        return {
            version: "1.0",
            targets: Array.from(allTargets),
            dependencies: {
                ...globalManifest.dependencies,
                ...sharedManifest.dependencies,
                ...localManifest.dependencies
            },
            skills: mergedSkills,
            overrides
        };
    }

    public async write(manifest: HarborManifest, type: ManifestLayer = "shared"): Promise<void> {
        let filePath = this.manifestPath;
        if (type === "global") filePath = ManifestManager.getGlobalPath();
        if (type === "local") filePath = this.getLocalPath();

        // Ensure directories exist
        await fs.mkdir(path.dirname(filePath), { recursive: true });

        // Strip layer before writing to keep manifest clean
        const cleanManifest = JSON.parse(JSON.stringify(manifest));
        if (cleanManifest.skills) {
            for (const skill of Object.values(cleanManifest.skills as Record<string, any>)) {
                delete skill.layer;
            }
        }

        await fs.writeFile(filePath, JSON.stringify(cleanManifest, null, 2), "utf-8");
    }

    public async addSkill(entry: SkillEntry, type: ManifestLayer = "shared"): Promise<void> {
        const manifest = await this.read(type);
        if (!manifest.dependencies) manifest.dependencies = {};
        if (!manifest.skills) manifest.skills = {};
        manifest.dependencies[entry.name] = entry.source;
        manifest.skills[entry.name] = entry;
        await this.write(manifest, type);
    }

    public getHarborDir(): string {
        return this.harborDir;
    }
}
