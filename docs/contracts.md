# Semantic Contracts in Skill Harbor

The Skill Harbor **Fathom Profiler** relies on "Semantic Contracts" to determine whether two or more skills can interact safely in a chain. Since agents pass unstructured or semi-structured data between tools during reasoning, explicit input/output definitions are crucial for preventing hallucinations and execution failures.

By defining these contracts, you ensure:
1. **Type Safety**: The output of one skill explicitly fulfills the input requirements of another.
2. **Context Integrity**: The agent knows exactly what to expect from the tool without "guessing."
3. **CI/CD Gating**: Running `skill-harbor fathom --contracts` will catch undefined pipelines and throw an error natively, preventing bad skills from being merged.

## The Standard

A skill should declare its inputs and outputs. You can specify contracts in two valid ways within your `SKILL.md` file.

### Method 1: Configuration Frontmatter (Recommended)

Place a `contracts` block directly inside your skill's YAML frontmatter.

```yaml
---
name: fetch-logs
description: Fetches application logs from AWS Cloudwatch
contracts:
  requires:
    aws_region: string
    service_name: string
  produces:
    log_stream: json array
---

## Summary
Returns the last 100 log lines from Cloudwatch.
```

### Method 2: Markdown Sections

If you prefer to define contracts in the markdown body for documentation purposes, you can use the `## Requires` and `## Produces` markdown headers. They must take the form of an unordered list with code-ticked variable names.

```markdown
---
name: fetch-logs
description: Fetches application logs from AWS Cloudwatch
---

## Summary
Returns the last 100 log lines from Cloudwatch.

## Requires
- `aws_region`: string
- `service_name`: string

## Produces
- `log_stream`: json array
```

## Validation Rules

When `skill-harbor fathom --contracts` runs:

- **Missing Standards**: If no `contracts` frontmatter exists and no `## Requires`/`## Produces` sections are found, the skill will be gracefully marked with a warning (`⚠️ Not explicitly configured for chaining`).
- **Missing Inputs**: If a skill requires `user_id`, but no other skill in the fleet *produces* a `user_id`, it will trigger a **Warning**. (This is not an error because the input may be provided by the user directly in the prompt).
- **Type Mismatches**: If Skill A produces `user_id` as an `integer`, and Skill B requires `user_id` as a `string`, Fathom will throw a **Hard Validation Error (Exit Code 1)** and fail the CI/CD pipeline.

## Customization

You can change the terms `Requires` and `Produces` to fit your team's nomenclature by updating your project's `profiler.yaml`:

```yaml
# profiler.yaml
contracts:
  requiresHeader: "Inputs"
  producesHeader: "Outputs"
```
