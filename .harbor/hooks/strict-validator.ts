/**
 * strict-validator.ts
 *
 * Custom Fathom hook that validates API contracts between chained skills.
 *
 * Both `upstreamSchema` and `downstreamSchema` are expected to be JSON-serialised
 * string arrays of key names, e.g. `'["userId", "locale", "prompt"]'`.
 *
 * The validator ensures every key required by the downstream skill is present
 * in the upstream skill's output schema.
 */

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export default async function strictValidator(
  upstreamSchema: string,
  downstreamSchema: string,
): Promise<ValidationResult> {
  const errors: string[] = [];

  // --- Parse upstream keys ---------------------------------------------------
  let upstreamKeys: string[];
  try {
    const parsed = JSON.parse(upstreamSchema);
    if (!Array.isArray(parsed)) {
      errors.push(
        `Upstream schema is not a JSON array. Received type: ${typeof parsed}`,
      );
      return { isValid: false, errors };
    }
    upstreamKeys = parsed.map(String);
  } catch {
    errors.push(
      `Failed to parse upstream schema as JSON: ${(upstreamSchema ?? "").slice(0, 120)}`,
    );
    return { isValid: false, errors };
  }

  // --- Parse downstream keys -------------------------------------------------
  let downstreamKeys: string[];
  try {
    const parsed = JSON.parse(downstreamSchema);
    if (!Array.isArray(parsed)) {
      errors.push(
        `Downstream schema is not a JSON array. Received type: ${typeof parsed}`,
      );
      return { isValid: false, errors };
    }
    downstreamKeys = parsed.map(String);
  } catch {
    errors.push(
      `Failed to parse downstream schema as JSON: ${(downstreamSchema ?? "").slice(0, 120)}`,
    );
    return { isValid: false, errors };
  }

  // --- Validate that every downstream key exists upstream --------------------
  const upstreamSet = new Set(upstreamKeys);

  for (const key of downstreamKeys) {
    if (!upstreamSet.has(key)) {
      errors.push(
        `Missing required key "${key}" — downstream expects it but upstream does not produce it.`,
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
