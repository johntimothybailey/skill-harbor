export interface ParsedContracts {
    requires: Record<string, string>;
    produces: Record<string, string>;
    missingStandard: boolean;
    isValid: boolean;
    status: "valid" | "missing" | "invalid";
    errors: string[];
    warnings: string[];
}

export interface ContractHeadersConfig {
    requiresHeader: string;
    producesHeader: string;
}

const DEFAULT_HEADERS: ContractHeadersConfig = {
    requiresHeader: "Requires",
    producesHeader: "Produces"
};

const VALID_TYPES = new Set([
    "string",
    "text",
    "markdown",
    "html",
    "json",
    "json array",
    "object",
    "array",
    "string array",
    "number",
    "integer",
    "boolean",
    "path",
    "file",
    "url",
    "id"
]);

const UNDERSPECIFIED_TYPES = new Set([
    "",
    "any",
    "unknown",
    "mixed",
    "value",
    "data",
    "output",
    "input"
]);

const FIELD_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function parseAndValidateContracts(
    metadata: any,
    content: string,
    headers?: Partial<ContractHeadersConfig>
): ParsedContracts {
    const config = {
        ...DEFAULT_HEADERS,
        ...headers
    };

    const errors: string[] = [];
    const warnings: string[] = [];
    let requires: Record<string, string> = {};
    let produces: Record<string, string> = {};
    let missingStandard = true;

    if (metadata?.contracts !== undefined) {
        missingStandard = false;
        const frontmatterResult = parseFrontmatterContracts(metadata.contracts);
        requires = frontmatterResult.requires;
        produces = frontmatterResult.produces;
        errors.push(...frontmatterResult.errors);
    } else {
        const requiresResult = parseMarkdownContractSection(content, config.requiresHeader);
        const producesResult = parseMarkdownContractSection(content, config.producesHeader);
        requires = requiresResult.entries;
        produces = producesResult.entries;
        errors.push(...requiresResult.errors, ...producesResult.errors);
        missingStandard = !(requiresResult.found || producesResult.found);
    }

    if (!missingStandard) {
        validateContractEntries(requires, "requires", errors, warnings);
        validateContractEntries(produces, "produces", errors, warnings);
    }

    let status: ParsedContracts["status"] = "valid";
    if (errors.length > 0) {
        status = "invalid";
    } else if (missingStandard) {
        status = "missing";
    }

    return {
        requires,
        produces,
        missingStandard,
        isValid: status !== "invalid",
        status,
        errors,
        warnings
    };
}

export function calculateContractCompatibility(
    contractsBySkill: Array<{ skillName: string; contracts: ParsedContracts }>
) {
    const globalProduces: Record<string, { type: string; skillName: string }[]> = {};
    const globalRequires: { skillName: string; variableName: string; requiredType: string }[] = [];
    const warnings: string[] = [];
    const mismatches: string[] = [];

    for (const item of contractsBySkill) {
        const { skillName, contracts } = item;

        if (contracts.status === "missing") {
            warnings.push(`[${skillName}] ⚠️  Not explicitly configured for chaining.`);
            continue;
        }

        if (contracts.status === "invalid") {
            warnings.push(`[${skillName}] ⚠️  Invalid contract declaration: ${contracts.errors.join("; ")}`);
            continue;
        }

        for (const [varName, type] of Object.entries(contracts.produces)) {
            if (!globalProduces[varName]) globalProduces[varName] = [];
            globalProduces[varName].push({ type, skillName });
        }

        for (const [varName, requiredType] of Object.entries(contracts.requires)) {
            globalRequires.push({ skillName, variableName: varName, requiredType });
        }
    }

    for (const req of globalRequires) {
        const producers = globalProduces[req.variableName];
        if (!producers || producers.length === 0) {
            warnings.push(`[${req.skillName}] Requires '${req.variableName}', but no skill in the harbor produces it. (May be provided by prompt).`);
            continue;
        }

        for (const producer of producers) {
            if (normalizeContractType(producer.type) !== normalizeContractType(req.requiredType)) {
                mismatches.push(`[${req.skillName}] Type mismatch for '${req.variableName}': ${req.skillName} requires '${req.requiredType}', but ${producer.skillName} produces '${producer.type}'.`);
            }
        }
    }

    return { warnings, mismatches };
}

function parseFrontmatterContracts(value: unknown) {
    const errors: string[] = [];
    const requires = parseContractObject(value, "requires", errors);
    const produces = parseContractObject(value, "produces", errors);
    return { requires, produces, errors };
}

function parseContractObject(value: unknown, key: "requires" | "produces", errors: string[]) {
    if (!isRecord(value)) {
        errors.push(`contracts.${key} must be declared on an object.`);
        return {};
    }

    const section = value[key];
    if (section === undefined) return {};
    if (!isRecord(section)) {
        errors.push(`contracts.${key} must be an object.`);
        return {};
    }

    const result: Record<string, string> = {};
    for (const [field, type] of Object.entries(section)) {
        if (typeof type !== "string") {
            errors.push(`contracts.${key}.${field} must be a string type.`);
            continue;
        }
        if (result[field] !== undefined) {
            errors.push(`contracts.${key}.${field} is declared more than once.`);
            continue;
        }
        result[field] = type.trim();
    }

    return result;
}

function parseMarkdownContractSection(content: string, headerName: string) {
    const result: Record<string, string> = {};
    const errors: string[] = [];
    const headerRegex = new RegExp(`##\\s+${headerName}\\s*\\n([\\s\\S]*?)(?:\\n##|$)`, "i");
    const match = content.match(headerRegex);

    if (!(match && match[1])) {
        return { entries: result, errors, found: false };
    }

    const sectionContent = match[1]
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean);

    for (const line of sectionContent) {
        const itemMatch = line.match(/^-+\s*`?([a-zA-Z0-9_-]+)`?:\s*(.+)$/);
        if (!itemMatch) {
            errors.push(`Malformed contract entry under '${headerName}': ${line}`);
            continue;
        }

        const [, field, type] = itemMatch;
        if (result[field] !== undefined) {
            errors.push(`Duplicate contract entry '${field}' under '${headerName}'.`);
            continue;
        }
        result[field] = type.trim();
    }

    return { entries: result, errors, found: true };
}

function validateContractEntries(
    entries: Record<string, string>,
    section: "requires" | "produces",
    errors: string[],
    warnings: string[]
) {
    for (const [field, type] of Object.entries(entries)) {
        if (!FIELD_NAME_PATTERN.test(field)) {
            errors.push(`contracts.${section}.${field} has an invalid field name.`);
        }

        const normalizedType = normalizeContractType(type);
        if (UNDERSPECIFIED_TYPES.has(normalizedType)) {
            warnings.push(`contracts.${section}.${field} is underspecified.`);
            continue;
        }

        if (!VALID_TYPES.has(normalizedType)) {
            errors.push(`contracts.${section}.${field} has unknown type '${type}'.`);
        }
    }
}

function normalizeContractType(value: string) {
    return value.trim().toLowerCase();
}

function isRecord(value: unknown): value is Record<string, any> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
