import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import glob from "fast-glob";
import { getEncoding } from "js-tiktoken";
import { FathomMetrics, ShipClass, WaterCondition, SkillType, HarborHealthReport, FathomThresholds } from "../types/profiler";

export class ProfilerService {
    private readonly encoding = getEncoding("cl100k_base");
    private readonly GPT4O_COST_PER_1M = 5.00;
    private readonly GPT4O_MINI_COST_PER_1M = 0.15;

    /**
     * Displacement: Calculates exact token weight and API cost.
     */
    async calculateDisplacement(skillPath: string): Promise<FathomMetrics["displacement"]> {
        let totalTokens = 0;
        try {
            const files = await this.getAllFiles(skillPath);
            for (const file of files) {
                const content = await fs.readFile(file, "utf-8");
                totalTokens += this.countTokens(content);
            }
        } catch {
            // If we can't read files, return default
        }

        const tokens = totalTokens;
        const { shipClass, icon } = this.getShipClass(tokens);
        const cost = this.calculateApiCost(tokens);

        return { tokens, shipClass, icon, cost };
    }

    /**
     * Draft: Calculates trigger likelihood (1-10) based on heuristics.
     */
    async calculateDraft(skillPath: string): Promise<FathomMetrics["draft"] & { heuristics: FathomMetrics["heuristics"], validation: FathomMetrics["validation"] }> {
        const { metadata, content } = await this.readSkillMetadata(skillPath);
        const validation = this.validateMetadata(metadata);
        const skillType = await this.detectSkillType(skillPath, metadata);

        let result: { 
            score: number; 
            heuristics: FathomMetrics["heuristics"] 
        };

        if (skillType === "API Tool") {
            result = this.evaluateApiToolWake(metadata);
        } else {
            result = this.evaluateAgenticSkillWake(metadata, content);
        }

        let score = result.score;
        
        // Clamp score between 1 and 10, then invert so 10 = best
        score = Math.max(1, Math.min(10, score));
        score = 11 - score;

        const { condition, wakeSize } = this.getWaterCondition(score);

        return {
            score,
            condition,
            wakeSize,
            skillType,
            validation,
            heuristics: result.heuristics
        };
    }

    /**
     * Finds all skill directories (those containing a SKILL.md file) recursively.
     */
    async findSkills(dirPath: string): Promise<string[]> {
        const skillsPaths = await glob("**/SKILL.md", { 
            cwd: dirPath, 
            absolute: true,
            ignore: ["**/node_modules/**", "**/.git/**", "**/stowage/**"]
        });
        
        // Return parent directories (the skill root)
        return skillsPaths.map(p => path.dirname(p));
    }

    /**
     * Generates a comprehensive health report by aggregating metrics from all discovered skills.
     */
    async generateHealthReport(skillPaths: string[], thresholds?: FathomThresholds): Promise<HarborHealthReport> {
        let totalTokens = 0;
        let totalScoreSum = 0;
        let scoreCount = 0;
        let agenticCount = 0;
        let toolCount = 0;
        
        const shipDistribution: Record<ShipClass, number> = {
            "Dinghy": 0,
            "Schooner": 0,
            "Brigantine": 0,
            "Frigate": 0,
            "Galleon": 0
        };

        for (const skillPath of skillPaths) {
            const disp = await this.calculateDisplacement(skillPath);
            const draft = await this.calculateDraft(skillPath);

            totalTokens += disp.tokens;
            totalScoreSum += draft.score;
            scoreCount++;

            if (draft.skillType === "Agentic Skill") agenticCount++;
            else toolCount++;

            shipDistribution[disp.shipClass]++;
        }

        const averageDraft = scoreCount > 0 ? totalScoreSum / scoreCount : 0;
        const totalCost = this.calculateApiCost(totalTokens);

        const contextBloat = [
            { model: "GPT-4o", limit: 128000, percentage: (totalTokens / 128000) * 100 },
            { model: "Claude 3.5 Sonnet", limit: 200000, percentage: (totalTokens / 200000) * 100 },
            { model: "GPT-4o-mini", limit: 128000, percentage: (totalTokens / 128000) * 100 }
        ];

        // --- Threshold Validation ---
        const violations: string[] = [];
        if (thresholds) {
            if (thresholds.maxTokens && totalTokens > thresholds.maxTokens) {
                violations.push(`Total tokens (${totalTokens.toLocaleString()}) exceed threshold of ${thresholds.maxTokens.toLocaleString()}.`);
            }
            const gpt4oBloat = contextBloat.find(b => b.model === "GPT-4o")?.percentage ?? 0;
            if (thresholds.maxBloat && gpt4oBloat > thresholds.maxBloat) {
                violations.push(`Context bloat (${gpt4oBloat.toFixed(1)}%) exceeds threshold of ${thresholds.maxBloat}%.`);
            }
            if (thresholds.minScore && averageDraft < thresholds.minScore) {
                violations.push(`Average fleet wake score (${averageDraft.toFixed(1)}) is below threshold of ${thresholds.minScore}.`);
            }
        }

        return {
            totalSkills: skillPaths.length,
            totalTokens,
            totalCost,
            averageDraft,
            composition: {
                agentic: agenticCount,
                tools: toolCount
            },
            shipDistribution,
            contextBloat,
            status: {
                isHealthy: violations.length === 0,
                violations
            }
        };
    }

    private countTokens(text: string): number {
        return this.encoding.encode(text).length;
    }

    private calculateApiCost(tokens: number): FathomMetrics["displacement"]["cost"] {
        return {
            gpt4o: (tokens / 1_000_000) * this.GPT4O_COST_PER_1M,
            gpt4oMini: (tokens / 1_000_000) * this.GPT4O_MINI_COST_PER_1M
        };
    }

    private validateMetadata(metadata: any): FathomMetrics["validation"] {
        const errors: string[] = [];
        const namePresent = !!metadata.name && typeof metadata.name === "string" && metadata.name.length > 0;
        const descriptionPresent = !!metadata.description && typeof metadata.description === "string" && metadata.description.length > 0;

        if (!namePresent) errors.push("Missing or empty 'name' in frontmatter.");
        if (!descriptionPresent) errors.push("Missing or empty 'description' in frontmatter.");
        
        if (descriptionPresent && metadata.description.length < 50) {
            errors.push("Description is too shallow (under 50 characters).");
        }

        return {
            namePresent,
            descriptionPresent,
            isProperlyFormatted: errors.length === 0,
            errors
        };
    }

    private async detectSkillType(skillPath: string, metadata: any): Promise<SkillType> {
        // 1. Metadata with agentic-specific fields is the strongest signal
        if (metadata.name && (metadata.triggers?.length > 0 || metadata.tags?.length > 0)) {
            return "Agentic Skill";
        }

        // 2. Pure Markdown with frontmatter name + description is likely an Agentic Skill
        if (metadata.name && metadata.description) {
            return "Agentic Skill";
        }

        // 3. Explicit schema/tool definition files indicate an API Tool
        const schemaExclusions = ["package.json", "tsconfig.json", ".skillfish.json", "package-lock.json"];
        try {
            const entries = await fs.readdir(skillPath, { withFileTypes: true });
            const hasSchemaFile = entries.some(e => 
                (e.name.endsWith('.json') && !schemaExclusions.includes(e.name)) || 
                e.name.includes('schema')
            );
            if (hasSchemaFile) {
                return "API Tool";
            }
        } catch {}

        return "API Tool"; // Default fallback
    }

    private evaluateApiToolWake(metadata: any): { score: number, heuristics: FathomMetrics["heuristics"] } {
        let score = 5;
        let semanticVagueness = 0;
        let negativeConstraints = 0;
        let schemaStrictness = 0;

        // 1. Semantic Vagueness
        const description = metadata.description || "";
        if (description.length < 50) {
            semanticVagueness += 2;
        }
        const genericVerbs = ["get", "find", "search", "do", "make", "create", "update", "delete"];
        const words = description.toLowerCase().split(/\W+/);
        const genericCount = words.filter((w: string) => genericVerbs.includes(w)).length;
        semanticVagueness += Math.min(genericCount, 3);
        score += semanticVagueness;

        // 2. Negative Constraints
        const boundaryPhrases = ["only use this when", "do not use", "requires exact", "must be", "if and only if"];
        const lowerMetadata = JSON.stringify(metadata).toLowerCase();
        for (const phrase of boundaryPhrases) {
            if (lowerMetadata.includes(phrase)) {
                negativeConstraints -= 1;
            }
        }
        score += negativeConstraints;

        // 3. Schema Strictness
        const triggers = metadata.triggers || [];
        if (triggers.length === 0) {
            schemaStrictness += 2;
        }
        
        if (lowerMetadata.includes("enum") || lowerMetadata.includes("regex") || lowerMetadata.includes("pattern")) {
            schemaStrictness -= 2;
        } else {
            schemaStrictness += 1;
        }
        score += schemaStrictness;

        return {
            score,
            heuristics: {
                semanticVagueness,
                negativeConstraints,
                schemaStrictness
            }
        };
    }

    private evaluateAgenticSkillWake(metadata: any, content: string): { score: number, heuristics: FathomMetrics["heuristics"] } {
        let score = 5;
        let semanticVagueness = 0;
        let negativeConstraints = 0;
        let tagDensity = 0;
        let triggerClarity = 0;

        // 1. Frontmatter Description (Base Wake)
        const description = metadata.description || "";
        if (description.length < 50) {
            semanticVagueness += 3; // Higher penalty for agentic skills if too short
        } else if (description.length > 200) {
            semanticVagueness -= 1; // Bonus for long specific descriptions
        }
        score += semanticVagueness;

        // 2. Tag Density Bonus
        const tags = metadata.tags || [];
        if (tags.length >= 3) {
            tagDensity = -2;
        } else if (tags.length > 0) {
            tagDensity = -1;
        }
        score += tagDensity;

        // 3. Explicit Trigger Sections (Massive Bonus)
        const triggerSections = ["## Trigger", "## Purpose", "## Exceptions", "## When to use", "## Usage"];
        let foundSections = 0;
        for (const section of triggerSections) {
            if (content.includes(section)) {
                foundSections++;
            }
        }
        
        if (foundSections >= 2) {
            triggerClarity = -3;
        } else if (foundSections === 1) {
            triggerClarity = -1;
        }
        score += triggerClarity;

        // 4. Negative Constraints (Still relevant for agentic prompts)
        const boundaryPhrases = ["only use this when", "do not use", "requires exact", "must be", "if and only if"];
        const lowerContent = content.toLowerCase();
        for (const phrase of boundaryPhrases) {
            if (lowerContent.includes(phrase)) {
                negativeConstraints -= 1;
            }
        }
        score += negativeConstraints;

        return {
            score,
            heuristics: {
                semanticVagueness,
                negativeConstraints,
                schemaStrictness: 0, // Not applicable for agentic skills
                tagDensity,
                triggerClarity
            }
        };
    }

    private getShipClass(tokens: number): { shipClass: ShipClass; icon: string } {
        if (tokens < 500) return { shipClass: "Dinghy", icon: "🛶" };
        if (tokens < 1500) return { shipClass: "Schooner", icon: "⛵" };
        if (tokens < 3500) return { shipClass: "Brigantine", icon: "🚤" };
        if (tokens < 7000) return { shipClass: "Frigate", icon: "🛳️" };
        return { shipClass: "Galleon", icon: "🚢" };
    }

    private getWaterCondition(score: number): { condition: WaterCondition; wakeSize: FathomMetrics["draft"]["wakeSize"] } {
        if (score >= 9) return { condition: "Glassy Water", wakeSize: "Minimal" };
        if (score >= 7) return { condition: "Calm Seas", wakeSize: "Small" };
        if (score >= 5) return { condition: "Choppy Water", wakeSize: "Moderate" };
        if (score >= 3) return { condition: "Rough Seas", wakeSize: "Large" };
        return { condition: "Storm Surge", wakeSize: "Massive" };
    }

    private async getAllFiles(dir: string): Promise<string[]> {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const files = await Promise.all(entries.map((res) => {
            const resPath = path.resolve(dir, res.name);
            return res.isDirectory() ? this.getAllFiles(resPath) : resPath;
        }));
        return Array.prototype.concat(...files);
    }

    private async readSkillMetadata(skillPath: string): Promise<{ metadata: any, content: string }> {
        const skillFile = path.join(skillPath, "SKILL.md");
        try {
            const rawContent = await fs.readFile(skillFile, "utf-8");
            const { data, content } = matter(rawContent);
            return { metadata: data, content };
        } catch {
            return { metadata: {}, content: "" };
        }
    }
}
