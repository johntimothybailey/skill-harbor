import type { BerthDetail } from "../utils";

export type SkillType = "API Tool" | "Agent Skill";

export type ShipClass = "Dinghy" | "Schooner" | "Brigantine" | "Frigate" | "Galleon";

export type WaterCondition = 
    | "Glassy Water" 
    | "Calm Seas" 
    | "Choppy Water" 
    | "Rough Seas" 
    | "Storm Surge";

export interface ContractValidation {
    missingStandard: boolean;
    requires: Record<string, string>;
    produces: Record<string, string>;
    isValid: boolean;
    status: "valid" | "missing" | "invalid";
    errors: string[];
    warnings: string[];
}

export interface FathomMetrics {
    displacement: {
        tokens: number;
        shipClass: ShipClass;
        icon: string;
        cost: {
            gpt4o: number;     // $/1M tokens baseline ($5.00/1M)
            gpt4oMini: number; // $/1M tokens baseline ($0.15/1M)
        };
    };
    heuristicConfidence: {
        score: number; // 1-10
        condition: WaterCondition;
        wakeSize: "Minimal" | "Small" | "Moderate" | "Large" | "Massive";
        skillType: SkillType;
    };
    sonarConfidence?: {
        score: number;       // 0-100%
        model: string;
        query: string;
        timestamp: string;
    };
    validation: {
        namePresent: boolean;
        descriptionPresent: boolean;
        isProperlyFormatted: boolean;
        errors: string[];
    };
    heuristics: {
        semanticVagueness: number;
        negativeConstraints: number;
        schemaStrictness: number;
        tagDensity?: number;
        triggerClarity?: number;
    };
    contracts?: ContractValidation;
}

export interface SkillProfile {
    name: string;
    metrics: FathomMetrics;
}

export interface HarborHealthReport {
    totalSkills: number;
    totalTokens: number;
    totalCost: {
        gpt4o: number;
        gpt4oMini: number;
    };
    averageHeuristicConfidence: number;
    averageSonarConfidence?: number; // Optional Sonar average if query provided
    composition: {
        agent: number;
        tools: number;
    };
    shipDistribution: Record<ShipClass, number>;
    contextBloat: {
        model: string;
        limit: number;
        percentage: number;
    }[];
    status: {
        isHealthy: boolean;
        violations: string[];
    };
    contractMismatches?: string[];
    contractWarnings?: string[];
    contractCoverage?: number;
    fleetStatus?: {
        berthed: number;
        stowed: number;
        dryDock: number;
    };
    vesselPlacements?: Array<{
        name: string;
        berthed: BerthDetail[];
        stowed: BerthDetail[];
    }>;
}

export interface FathomThresholds {
    maxTokens?: number;
    maxBloat?: number;
    minScore?: number;
}
