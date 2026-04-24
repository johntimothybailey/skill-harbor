import { describe, expect, it } from "vitest";
import { calculateContractCompatibility, parseAndValidateContracts } from "./contracts";

describe("contracts helpers", () => {
    it("parses valid frontmatter contracts", () => {
        const result = parseAndValidateContracts({
            contracts: {
                requires: { input_text: "string" },
                produces: { summary: "json" }
            }
        }, "");

        expect(result.status).toBe("valid");
        expect(result.requires.input_text).toBe("string");
        expect(result.produces.summary).toBe("json");
    });

    it("parses valid markdown contracts", () => {
        const result = parseAndValidateContracts({}, `## Requires\n- input_text: string\n\n## Produces\n- summary: json`);

        expect(result.status).toBe("valid");
        expect(result.requires.input_text).toBe("string");
        expect(result.produces.summary).toBe("json");
    });

    it("marks contracts missing when no declarations exist", () => {
        const result = parseAndValidateContracts({}, "# No contracts here");
        expect(result.status).toBe("missing");
        expect(result.missingStandard).toBe(true);
    });

    it("fails malformed markdown contracts", () => {
        const result = parseAndValidateContracts({}, `## Requires\nthis is malformed`);
        expect(result.status).toBe("invalid");
        expect(result.errors[0]).toContain("Malformed contract entry");
    });

    it("fails unknown contract types", () => {
        const result = parseAndValidateContracts({
            contracts: {
                produces: { summary: "structured-json-ish" }
            }
        }, "");
        expect(result.status).toBe("invalid");
        expect(result.errors[0]).toContain("unknown type");
    });

    it("treats underspecified types as warnings instead of invalid contracts", () => {
        const result = parseAndValidateContracts({
            contracts: {
                requires: { input_text: "any" }
            }
        }, "");

        expect(result.status).toBe("valid");
        expect(result.warnings[0]).toContain("underspecified");
    });

    it("fails duplicate markdown entries", () => {
        const result = parseAndValidateContracts({}, `## Produces\n- summary: json\n- summary: markdown`);
        expect(result.status).toBe("invalid");
        expect(result.errors[0]).toContain("Duplicate contract entry");
    });

    it("calculates compatibility warnings and mismatches", () => {
        const compatibility = calculateContractCompatibility([
            {
                skillName: "producer",
                contracts: parseAndValidateContracts({ contracts: { produces: { summary: "json" } } }, "")
            },
            {
                skillName: "consumer",
                contracts: parseAndValidateContracts({ contracts: { requires: { summary: "markdown" } } }, "")
            },
            {
                skillName: "missing-contract",
                contracts: parseAndValidateContracts({}, "")
            }
        ]);

        expect(compatibility.warnings.some(warning => warning.includes("Not explicitly configured for chaining"))).toBe(true);
        expect(compatibility.mismatches.some(mismatch => mismatch.includes("Type mismatch"))).toBe(true);
    });
});
