import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export type ManifestLayer = "global" | "shared" | "local";
export type SkillSourceType = "single" | "folder";

export const SHARED_MANIFEST_FILENAME = "harbor-manifest.json";
export const OVERRIDES_MANIFEST_FILENAME = "harbor-manifest.overrides.json";
export const LEGACY_LOCAL_MANIFEST_FILENAME = "harbor-manifest.local.json";
export const OVERRIDES_RENAME_EXPLANATION = "Skill Harbor now uses 'overrides' terminology so this file is easier to distinguish from local filesystem skill sources.";

export interface GeneratedSkillEntry {
    name: string;
    source: string;
    localPath: string;
    lastSyncHash?: string;
    lastSyncTargets?: string[];
}

export interface SkillEntry {
    name: string;
    version?: string;
    description?: string;
    source: string; // URL, git, or local path
    sourceType?: SkillSourceType;
    localPath: string; // Path within .harbor
    lastSyncHash?: string; // Cache the source string to detect changes
    lastSyncTargets?: string[]; // Cache the successful berthing targets
    generatedChildren?: GeneratedSkillEntry[];
    layer?: ManifestLayer; // Tracks which manifest file this was defined in
    generated?: boolean; // Expanded runtime-only child marker
    managedBy?: string; // Expanded runtime-only parent collection name
    collectionRoot?: string; // Expanded runtime-only folder root
    resolvedSource?: string; // Runtime-only absolute source used for sync without rewriting manifests
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
            this.localManifestPath = path.join(this.cwd, OVERRIDES_MANIFEST_FILENAME); // Default fallback
        } else {
            // Defaults, paths will be refined in init()
            this.manifestPath = path.join(this.cwd, SHARED_MANIFEST_FILENAME);
            this.localManifestPath = path.join(this.cwd, OVERRIDES_MANIFEST_FILENAME);
        }
    }

    public static getGlobalPath(): string {
        return path.join(os.homedir(), ".harbor", SHARED_MANIFEST_FILENAME);
    }

    public static getGlobalHarborDir(): string {
        return path.join(os.homedir(), ".harbor");
    }

    public static getProjectSharedPath(cwd: string): string {
        return path.join(cwd, ".harbor", SHARED_MANIFEST_FILENAME);
    }

    public static getProjectLegacySharedPath(cwd: string): string {
        return path.join(cwd, SHARED_MANIFEST_FILENAME);
    }

    public static getProjectOverridesPath(cwd: string): string {
        return path.join(cwd, ".harbor", OVERRIDES_MANIFEST_FILENAME);
    }

    public static getProjectLegacyOverridesPath(cwd: string): string {
        return path.join(cwd, LEGACY_LOCAL_MANIFEST_FILENAME);
    }

    public static getProjectLegacyHarborLocalPath(cwd: string): string {
        return path.join(cwd, ".harbor", LEGACY_LOCAL_MANIFEST_FILENAME);
    }

    public static getGlobalSkillsCacheDir(): string {
        return path.join(ManifestManager.getGlobalHarborDir(), "skills");
    }

    public static async globalManifestExists(): Promise<boolean> {
        try {
            await fs.access(ManifestManager.getGlobalPath());
            return true;
        } catch {
            return false;
        }
    }

    public getLocalPath(): string {
        return this.localManifestPath;
    }

    public getOverridesPath(): string {
        return path.join(this.harborDir, OVERRIDES_MANIFEST_FILENAME);
    }

    public get isMigrationRecommended(): boolean {
        return this.migrationRecommended;
    }

    public get isLocalMigrationRecommended(): boolean {
        return this.localMigrationRecommended;
    }

    public async init(): Promise<void> {
        if (this.initialized) return;

        // Resolve shared manifest location
        const preferredPath = ManifestManager.getProjectSharedPath(this.cwd);
        const legacyPath = ManifestManager.getProjectLegacySharedPath(this.cwd);

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

        // Resolve overrides manifest location
        const localPreferredPath = ManifestManager.getProjectOverridesPath(this.cwd);
        const localLegacyHarborPath = ManifestManager.getProjectLegacyHarborLocalPath(this.cwd);
        const localLegacyPath = ManifestManager.getProjectLegacyOverridesPath(this.cwd);

        const hasLocalPreferred = await this.pathExists(localPreferredPath);
        const hasLocalLegacyHarbor = await this.pathExists(localLegacyHarborPath);
        const hasLocalLegacy = await this.pathExists(localLegacyPath);

        if (hasLocalPreferred) {
            this.localManifestPath = localPreferredPath;
        } else if (hasLocalLegacyHarbor) {
            this.localManifestPath = localLegacyHarborPath;
            this.localMigrationRecommended = true;
        } else if (hasLocalLegacy) {
            this.localManifestPath = localLegacyPath;
            this.localMigrationRecommended = true;
        } else {
            this.localManifestPath = localPreferredPath;
        }

        this.initialized = true;
    }

    public async migrateLegacyOverrides(notify?: (message: string) => void): Promise<boolean> {
        await this.init();

        const preferredPath = ManifestManager.getProjectOverridesPath(this.cwd);
        const legacyCandidates = [
            ManifestManager.getProjectLegacyHarborLocalPath(this.cwd),
            ManifestManager.getProjectLegacyOverridesPath(this.cwd)
        ];

        if (await this.pathExists(preferredPath)) {
            this.localManifestPath = preferredPath;
            this.localMigrationRecommended = false;
            return false;
        }

        for (const legacyPath of legacyCandidates) {
            if (!(await this.pathExists(legacyPath))) {
                continue;
            }

            await fs.mkdir(path.dirname(preferredPath), { recursive: true });
            await fs.rename(legacyPath, preferredPath);
            this.localManifestPath = preferredPath;
            this.localMigrationRecommended = false;
            notify?.(
                `Renamed ${path.basename(legacyPath)} to ${OVERRIDES_MANIFEST_FILENAME} so override-layer config is easier to distinguish from local filesystem skill sources.`
            );
            return true;
        }

        return false;
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

    public async hasProjectManifestStack(): Promise<boolean> {
        await this.init();

        return (await this.pathExists(this.manifestPath)) || (await this.pathExists(this.localManifestPath));
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

        // Resolve local paths relative to manifest location for runtime use without
        // mutating the manifest source that should be written back to disk.
        for (const skill of Object.values(mergedSkills)) {
            if (skill.source.startsWith('.') || skill.source.startsWith('file://.')) {
                let manifestDir = this.cwd;
                if (skill.layer === "global") manifestDir = path.dirname(ManifestManager.getGlobalPath());

                const rawPath = skill.source.replace('file://', '');
                const absolutePath = path.resolve(manifestDir, rawPath);
                // Maintain file:// protocol if it was present.
                skill.resolvedSource = skill.source.startsWith('file://') ? `file://${absolutePath}` : absolutePath;
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

    public materializeSkills(manifest: HarborManifest, options?: { includeFolderSources?: boolean }): SkillEntry[] {
        const includeFolderSources = options?.includeFolderSources ?? false;
        const materialized: SkillEntry[] = [];

        for (const skill of Object.values(manifest.skills || {})) {
            if (skill.sourceType === "folder") {
                if (includeFolderSources) {
                    materialized.push(skill);
                }

                for (const child of skill.generatedChildren || []) {
                    materialized.push({
                        ...child,
                        sourceType: "single",
                        layer: skill.layer,
                        generated: true,
                        managedBy: skill.name,
                        collectionRoot: skill.source
                    });
                }
                continue;
            }

            materialized.push(skill);
        }

        return materialized;
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
                delete skill.resolvedSource;
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

    public getSkillsCacheDir(type: ManifestLayer = "shared"): string {
        if (type === "global") {
            return ManifestManager.getGlobalSkillsCacheDir();
        }

        return this.skillsDir;
    }

    /** @deprecated Use getSkillsCacheDir() instead */
    public getHarborDir(type: ManifestLayer = "shared"): string {
        return this.getSkillsCacheDir(type);
    }
}
