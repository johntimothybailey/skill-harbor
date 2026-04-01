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
    targets?: string[]; // e.g. ["claude", "cursor", "antigravity", "rulesync"]
    dependencies: Record<string, string>; // "skill-name": "version/source"
    skills: Record<string, SkillEntry>;
    overrides?: string[]; // Optional names of skills being overridden in the current stack
}

export class ManifestManager {
    private manifestPath: string;
    private localManifestPath: string;
    private harborDir: string;
    private skillsDir: string;
    private cwd: string;
    private migrationRecommended: boolean = false;
    private localMigrationRecommended: boolean = false;
    private initialized: boolean = false;

    constructor(options?: { cwd?: string; customPath?: string }) {
        this.cwd = options?.cwd || process.cwd();
        this.harborDir = path.join(this.cwd, ".harbor");
        this.skillsDir = path.join(this.harborDir, "skills");

        if (options?.customPath) {
            this.manifestPath = options.customPath;
            this.localManifestPath = path.join(this.cwd, "harbor-manifest.local.json"); // Default fallback
        } else {
            // Defaults, paths will be refined in init()
            this.manifestPath = path.join(this.cwd, "harbor-manifest.json");
            this.localManifestPath = path.join(this.cwd, "harbor-manifest.local.json");
        }
    }

    public static getGlobalPath(): string {
        return path.join(os.homedir(), ".harbor", "harbor-manifest.json");
    }

    public getLocalPath(): string {
        return this.localManifestPath;
    }

    public get isMigrationRecommended(): boolean {
        return this.migrationRecommended;
    }

    public get isLocalMigrationRecommended(): boolean {
        return this.localMigrationRecommended;
    }

    public async init(): Promise<void> {
        if (this.initialized) return;

        // Ensure .harbor/skills exists
        await fs.mkdir(this.skillsDir, { recursive: true });

        // Resolve shared manifest location
        const preferredPath = path.join(this.harborDir, "harbor-manifest.json");
        const legacyPath = path.join(this.cwd, "harbor-manifest.json");

        // If not using a custom path or haven't resolved yet
        if (this.manifestPath === legacyPath || this.manifestPath === preferredPath) {
            const hasPreferred = await this.pathExists(preferredPath);
            const hasLegacy = await this.pathExists(legacyPath);

            if (hasPreferred) {
                this.manifestPath = preferredPath;
            } else if (hasLegacy) {
                this.manifestPath = legacyPath;
                this.migrationRecommended = true;
            } else {
                this.manifestPath = preferredPath;
            }
        }

        // Resolve local manifest location
        const localPreferredPath = path.join(this.harborDir, "harbor-manifest.local.json");
        const localLegacyPath = path.join(this.cwd, "harbor-manifest.local.json");

        const hasLocalPreferred = await this.pathExists(localPreferredPath);
        const hasLocalLegacy = await this.pathExists(localLegacyPath);

        if (hasLocalPreferred) {
            this.localManifestPath = localPreferredPath;
        } else if (hasLocalLegacy) {
            this.localManifestPath = localLegacyPath;
            this.localMigrationRecommended = true;
        } else {
            this.localManifestPath = localPreferredPath;
        }

        try {
            await fs.access(this.manifestPath);
        } catch {
            // Only write a new manifest if we're not using a global or local-only layer
            // For the shared (preferred) layer, create it if it doesn't exist
            if (this.manifestPath.includes("harbor-manifest.json")) {
                const initialManifest: HarborManifest = {
                    version: "1.0",
                    dependencies: {},
                    skills: {}
                };
                await this.write(initialManifest);
            }
        }
        this.initialized = true;
    }

    private async pathExists(p: string): Promise<boolean> {
        try {
            await fs.access(p);
            return true;
        } catch {
            return false;
        }
    }

    public async read(type: ManifestLayer = "shared"): Promise<HarborManifest> {
        await this.init();
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
        await this.init();
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
        return this.skillsDir;
    }
}
