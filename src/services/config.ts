import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import "dotenv/config";

export interface SonarConfig {
    provider: string;
    model: string;
    baseUrl: string;
    apiKey?: string;
}

export interface ProfilerConfig {
    sonar: SonarConfig;
}

export class ConfigManager {
    private static instance: ConfigManager;
    private config: ProfilerConfig | null = null;

    private constructor() {}

    public static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }

    public async loadConfig(overrides?: Partial<SonarConfig>): Promise<ProfilerConfig> {
        const configPath = path.resolve(process.cwd(), "profiler.yaml");
        let fileConfig: any = {};

        try {
            const fileContent = await fs.readFile(configPath, "utf-8");
            fileConfig = yaml.load(fileContent) || {};
        } catch (error) {
            // No profiler.yaml found, using defaults
        }

        const sonarDefaults: SonarConfig = {
            provider: "openai",
            model: "gpt-4o",
            baseUrl: "https://api.openai.com/v1"
        };

        const mergedSonar: SonarConfig = {
            ...sonarDefaults,
            ...(fileConfig.sonar || {}),
            ...(overrides || {})
        };

        // API Key Priority: 1. ENV, 2. profiler.yaml (not recommended), 3. SONAR_API_KEY
        mergedSonar.apiKey = process.env.HARBOR_PROFILER_API_KEY || process.env.OPENAI_API_KEY;

        this.config = {
            sonar: mergedSonar
        };

        return this.config;
    }

    public getConfig(): ProfilerConfig {
        if (!this.config) {
            throw new Error("Config not loaded. Call loadConfig() first.");
        }
        return this.config;
    }
}
