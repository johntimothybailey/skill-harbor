import fs from "node:fs/promises";
import path from "node:path";
import { FathomMetrics, ShipClass, WaterCondition, SkillType } from "../types/profiler";

export class ProfilerService {
    private readonly CHAR_TO_TOKEN_RATIO = 4;

    /**
     * Displacement: Calculates token weight based on char-to-token ratio.
     */
    async calculateDisplacement(skillPath: string): Promise<FathomMetrics["displacement"]> {
        let totalChars = 0;
        try {
            const files = await this.getAllFiles(skillPath);
            for (const file of files) {
                const content = await fs.readFile(file, "utf-8");
                totalChars += content.length;
            }
        } catch {
            // If we can't read files, return default
        }

        const tokens = Math.ceil(totalChars / this.CHAR_TO_TOKEN_RATIO);
        const { shipClass, icon } = this.getShipClass(tokens);

        return { tokens, shipClass, icon };
    }

    /**
     * Draft: Calculates trigger likelihood (1-10) based on heuristics.
     */
    async calculateDraft(skillPath: string): Promise<FathomMetrics["draft"] & { heuristics: FathomMetrics["heuristics"] }> {
        const { metadata, content } = await this.readSkillMetadata(skillPath);
        const skillType = await this.detectSkillType(skillPath, metadata);

        let score = 5; // Base score
        let result: { 
            score: number; 
            heuristics: FathomMetrics["heuristics"] 
        };

        if (skillType === "API Tool") {
            result = this.evaluateApiToolWake(metadata);
        } else {
            result = this.evaluateAgenticSkillWake(metadata, content);
        }

        score = result.score;
        
        // Clamp score between 1 and 10, then invert so 10 = best
        score = Math.max(1, Math.min(10, score));
        score = 11 - score;

        const { condition, wakeSize } = this.getWaterCondition(score);

        return {
            score,
            condition,
            wakeSize,
            skillType,
            heuristics: result.heuristics
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
            const content = await fs.readFile(skillFile, "utf-8");
            const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/m);
            if (!frontmatterMatch) return { metadata: {}, content };

            const yaml = frontmatterMatch[1];
            const metadata: any = { triggers: [], tags: [] };
            
            const nameMatch = yaml.match(/^name:\s*(.*)$/m);
            if (nameMatch) metadata.name = nameMatch[1].trim();

            const descMatch = yaml.match(/^description:\s*(.*)$/m);
            if (descMatch) metadata.description = descMatch[1].trim();

            const triggersMatch = yaml.match(/^triggers:\s*(?:\[)?(.*?)(?:\])?\s*$/m);
            if (triggersMatch) {
                metadata.triggers = triggersMatch[1].split(",").map(t => t.trim().replace(/^['"](.*)['"]$/, "$1")).filter(Boolean);
            }

            const tagsMatch = yaml.match(/^tags:\s*(?:\[)?(.*?)(?:\])?\s*$/m);
            if (tagsMatch) {
                metadata.tags = tagsMatch[1].split(",").map(t => t.trim().replace(/^['"](.*)['"]$/, "$1")).filter(Boolean);
            }

            return { metadata, content };
        } catch {
            return { metadata: {}, content: "" };
        }
    }
}
