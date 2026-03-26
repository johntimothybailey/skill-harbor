export type SkillType = "API Tool" | "Agentic Skill";

export type ShipClass = "Dinghy" | "Schooner" | "Brigantine" | "Frigate" | "Galleon";

export type WaterCondition = 
    | "Glassy Water" 
    | "Calm Seas" 
    | "Choppy Water" 
    | "Rough Seas" 
    | "Storm Surge";

export interface FathomMetrics {
    displacement: {
        tokens: number;
        shipClass: ShipClass;
        icon: string;
    };
    draft: {
        score: number; // 1-10
        condition: WaterCondition;
        wakeSize: "Minimal" | "Small" | "Moderate" | "Large" | "Massive";
        skillType: SkillType;
    };
    heuristics: {
        semanticVagueness: number;
        negativeConstraints: number;
        schemaStrictness: number;
        tagDensity?: number;
        triggerClarity?: number;
    };
}

export interface SkillProfile {
    name: string;
    metrics: FathomMetrics;
}
