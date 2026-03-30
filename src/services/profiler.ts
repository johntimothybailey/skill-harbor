import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import glob from "fast-glob";
import { getEncoding } from "js-tiktoken";
import { FathomMetrics, ShipClass, WaterCondition, SkillType, HarborHealthReport, FathomThresholds } from "../types/profiler";
import { ConfigManager, SonarConfig } from "./config";

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
     * Confidence (Heuristic): Calculates trigger likelihood (1-10) based on local heuristics.
     */
    async calculateHeuristicConfidence(skillPath: string): Promise<FathomMetrics["heuristicConfidence"] & { heuristics: FathomMetrics["heuristics"], validation: FathomMetrics["validation"] }> {
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
     * Confidence (Sonar): Conducts a probabilistic LLM audit via logprobs.
     */
    async conductSonarAudit(name: string, skillPath: string, query: string, sonarConfig: SonarConfig): Promise<FathomMetrics["sonarConfidence"]> {
        const { metadata } = await this.readSkillMetadata(skillPath);
        
        // Construct the tools definition for the LLM
        const tools = [
            {
                type: "function",
                function: {
                    name: name,
                    description: metadata.description || "A specialized AI skill.",
                    parameters: {
                        type: "object",
                        properties: {}, // We don't need params for trigger testing
                        required: []
                    }
                }
            }
        ];

        try {
            const response = await fetch(`${sonarConfig.baseUrl}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${sonarConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: sonarConfig.model,
                    messages: [
                        { role: "system", content: "You are a routing agent. Your ONLY job is to determine if the user query should trigger the provided tool. If yes, call the tool. If no, say 'NO_TRIGGER'." },
                        { role: "user", content: query }
                    ],
                    tools: tools,
                    tool_choice: "auto",
                    logprobs: true,
                    top_logprobs: 5,
                    max_tokens: 1
                })
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`Sonar API failure (${response.status}): ${err}`);
            }

            const data: any = await response.json();
            const choice = data.choices[0];
            
            // Logprobs parsing logic
            let confidence = 0;
            const logprobs = choice.logprobs?.content?.[0]?.top_logprobs || [];
            
            const toolCallIndicators = ["call", "tool", name];
            const matchingLogprob = logprobs.find((lp: any) => 
                toolCallIndicators.some(indicator => lp.token.toLowerCase().includes(indicator.toLowerCase()))
            );

            if (matchingLogprob) {
                confidence = Math.exp(matchingLogprob.logprob) * 100;
            } else if (choice.message?.tool_calls?.length > 0) {
                confidence = 95;
            }

            return {
                score: Math.round(confidence),
                model: sonarConfig.model,
                query: query,
                timestamp: new Date().toISOString()
            };
        } catch (error: any) {
            throw new Error(`Sonar audit failed: ${error.message}`);
        }
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
        
        return skillsPaths.map(p => path.dirname(p));
    }

    /**
     * Generates a comprehensive health report by aggregating metrics from all discovered skills.
     */
    async generateHealthReport(skillPaths: string[], thresholds?: FathomThresholds, query?: string, sonarConfig?: SonarConfig): Promise<HarborHealthReport> {
        let totalTokens = 0;
        let totalScoreSum = 0;
        let totalSonarSum = 0;
        let sonarCount = 0;
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
            const skillName = path.basename(skillPath);
            const disp = await this.calculateDisplacement(skillPath);
            const heuristic = await this.calculateHeuristicConfidence(skillPath);

            totalTokens += disp.tokens;
            totalScoreSum += heuristic.score;
            scoreCount++;

            if (query && sonarConfig) {
                try {
                    const sonar = await this.conductSonarAudit(skillName, skillPath, query, sonarConfig);
                    if (sonar) {
                        totalSonarSum += sonar.score;
                        sonarCount++;
                    }
                } catch {
                    // Fail silently, sonar just won't be included in average
                }
            }

            if (heuristic.skillType === "Agentic Skill") agenticCount++;
            else toolCount++;

            shipDistribution[disp.shipClass]++;
        }

        const averageHeuristicConfidence = scoreCount > 0 ? totalScoreSum / scoreCount : 0;
        const averageSonarConfidence = sonarCount > 0 ? totalSonarSum / sonarCount : undefined;
        const totalCost = this.calculateApiCost(totalTokens);

        const contextBloat = [
            { model: "GPT-4o", limit: 128000, percentage: (totalTokens / 128000) * 100 },
            { model: "Claude 3.5 Sonnet", limit: 200000, percentage: (totalTokens / 200000) * 100 },
            { model: "GPT-4o-mini", limit: 128000, percentage: (totalTokens / 128000) * 100 }
        ];

        const violations: string[] = [];
        if (thresholds) {
            if (thresholds.maxTokens && totalTokens > thresholds.maxTokens) {
                violations.push(`Total tokens (${totalTokens.toLocaleString()}) exceed threshold of ${thresholds.maxTokens.toLocaleString()}.`);
            }
            const gpt4oBloat = contextBloat.find(b => b.model === "GPT-4o")?.percentage ?? 0;
            if (thresholds.maxBloat && gpt4oBloat > thresholds.maxBloat) {
                violations.push(`Context bloat (${gpt4oBloat.toFixed(1)}%) exceeds threshold of ${thresholds.maxBloat}%.`);
            }
            if (thresholds.minScore && averageHeuristicConfidence < thresholds.minScore) {
                violations.push(`Average fleet wake score (${averageHeuristicConfidence.toFixed(1)}) is below threshold of ${thresholds.minScore}.`);
            }
        }

        return {
            totalSkills: skillPaths.length,
            totalTokens,
            totalCost,
            averageHeuristicConfidence,
            averageSonarConfidence,
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
        if (metadata.name && (metadata.triggers?.length > 0 || metadata.tags?.length > 0)) {
            return "Agentic Skill";
        }

        if (metadata.name && metadata.description) {
            return "Agentic Skill";
        }

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

        return "API Tool";
    }

    private evaluateApiToolWake(metadata: any): { score: number, heuristics: FathomMetrics["heuristics"] } {
        let score = 5;
        let semanticVagueness = 0;
        let negativeConstraints = 0;
        let schemaStrictness = 0;

        const description = metadata.description || "";
        if (description.length < 50) {
            semanticVagueness += 2;
        }
        const genericVerbs = ["get", "find", "search", "do", "make", "create", "update", "delete"];
        const words = description.toLowerCase().split(/\W+/);
        const genericCount = words.filter((w: string) => genericVerbs.includes(w)).length;
        semanticVagueness += Math.min(genericCount, 3);
        score += semanticVagueness;

        const boundaryPhrases = ["only use this when", "do not use", "requires exact", "must be", "if and only if"];
        const lowerMetadata = JSON.stringify(metadata).toLowerCase();
        for (const phrase of boundaryPhrases) {
            if (lowerMetadata.includes(phrase)) {
                negativeConstraints -= 1;
            }
        }
        score += negativeConstraints;

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

        const description = metadata.description || "";
        if (description.length < 50) {
            semanticVagueness += 3;
        } else if (description.length > 200) {
            semanticVagueness -= 1;
        }
        score += semanticVagueness;

        const tags = metadata.tags || [];
        if (tags.length >= 3) {
            tagDensity = -2;
        } else if (tags.length > 0) {
            tagDensity = -1;
        }
        score += tagDensity;

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
                schemaStrictness: 0,
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

    private getWaterCondition(score: number): { condition: WaterCondition; wakeSize: FathomMetrics["heuristicConfidence"]["wakeSize"] } {
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
