import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import kleur from "kleur";
import Spinnies from "spinnies";
import yaml from "js-yaml";
import matter from "gray-matter";
import { resolveCommandScope } from "../command-scope";
import { ask, getAgentBerths, getManifestManager } from "../utils";
import { ConfigManager } from "../services/config";
import { ProfilerService } from "../services/profiler";
import {
    VoyagerAssertionSummary,
    VoyagerCompareResult,
    VoyagerRunResult,
    VoyagerTestDefinition,
    VoyagerTraceEvent
} from "../types/voyager";
import { printError, printHeader, printSuccess } from "../ui";

const DEFAULT_MOCK_RESPONSE = "Simulated success. Context payload acknowledged.";
const MAX_ITERATIONS = 10;

type VoyagerTool = {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: {
            type: "object";
            properties: Record<string, unknown>;
            required: string[];
        };
    };
};

type VoyagerConfig = {
    apiKey: string;
    model: string;
    baseUrl: string;
};

export async function voyagerAction(queryArg: string | undefined, options: any, command: any) {
    const opts = command.opts();
    const format = opts.format ?? "pretty";
    const pretty = format !== "json";
    const compareMode = Boolean(opts.compare);
    const spinnies = new Spinnies();

    try {
        if (pretty) {
            printHeader("Voyager: Fleet Integration Testing");
        }

        const testDef = await loadVoyagerTestDefinition(queryArg, opts);
        const manifestManager = getManifestManager({ global: false });
        const { useGlobalScope, shouldStop } = await resolveCommandScope({ global: false }, manifestManager, "skill-harbor voyager");
        if (shouldStop) return;

        const configManager = ConfigManager.getInstance();
        const config = await configManager.loadConfig({
            model: opts.model,
            baseUrl: opts.baseUrl
        });

        if (!config.sonar.apiKey) {
            printError("Voyager simulation requires an API key in HARBOR_PROFILER_API_KEY, OPENAI_API_KEY, or profiler.yaml");
            process.exit(1);
        }

        if (pretty) {
            spinnies.add("voyager-init", { text: "Discovering active berths and preparing fleet cargo..." });
        }

        let manifest: any;
        try {
            manifest = useGlobalScope
                ? await manifestManager.read("global")
                : await manifestManager.readMerged();
        } catch {
            manifest = { targets: [] };
        }

        const profiler = new ProfilerService();
        const baseDir = useGlobalScope ? os.homedir() : process.cwd();
        const activeBerths = await getAgentBerths(baseDir, manifest.targets && manifest.targets.length > 0 ? manifest.targets : undefined);

        if (activeBerths.length === 0) {
            if (pretty) {
                spinnies.fail("voyager-init", { text: "No active agent berths found to voyager with." });
            }
            process.exit(1);
        }

        const tools = await discoverVoyagerTools(activeBerths, profiler);

        if (tools.length === 0) {
            if (pretty) {
                spinnies.fail("voyager-init", { text: "No properly formatted skills found in active berths." });
            }
            await maybeOfferGhostDocking({
                baseDir,
                useGlobalScope,
                manifestManager,
                profiler,
                allowPrompt: true
            });
            process.exit(1);
        }

        if (pretty) {
            spinnies.succeed("voyager-init", { text: `Fleet ready. Discovered ${tools.length} actionable skills.` });
            console.log(`\n${kleur.blue("▶")} ${kleur.bold("Query:")} ${kleur.gray(testDef.query)}\n`);
        }

        const sonarConfig: VoyagerConfig = {
            apiKey: config.sonar.apiKey,
            model: config.sonar.model,
            baseUrl: config.sonar.baseUrl
        };

        if (compareMode) {
            const withSkills = await runVoyagerScenario({
                label: "with-skills",
                testDef,
                tools,
                config: sonarConfig,
                pretty,
                spinnies
            });
            const withoutSkills = await runVoyagerScenario({
                label: "without-skills",
                testDef,
                tools: [],
                config: sonarConfig,
                pretty,
                spinnies
            });

            const result = buildVoyagerCompareResult(testDef, withSkills, withoutSkills);

            const traceDir = resolveTraceDirectory(opts.saveTrace);
            if (traceDir) {
                await saveVoyagerArtifacts(traceDir, result);
            }

            if (format === "json") {
                console.log(JSON.stringify(result, null, 2));
            } else {
                printVoyagerCompareResult(result, traceDir);
            }
            return;
        }

        const run = await runVoyagerScenario({
            label: "voyager",
            testDef,
            tools,
            config: sonarConfig,
            pretty,
            spinnies
        });

        const singlePayload = {
            scenario: {
                query: testDef.query,
                name: testDef.metadata?.name,
                expectedTools: testDef.expected_tools ?? []
            },
            run
        };

        const traceDir = resolveTraceDirectory(opts.saveTrace);
        if (traceDir) {
            await saveVoyagerArtifacts(traceDir, singlePayload);
        }

        if (format === "json") {
            console.log(JSON.stringify(singlePayload, null, 2));
        } else {
            printVoyagerSingleResult(run, traceDir);
        }

        if (run.status === "api_error") {
            printError(`LLM API Error: ${run.error ?? "Unknown error"}`);
            process.exit(1);
        }
        if (run.status === "max_iterations") {
            printError(`Voyager automatically terminated after ${MAX_ITERATIONS} loops to prevent infinite drifting.`);
            process.exit(1);
        }
        if (!run.assertions.allPassed) {
            process.exit(1);
        }
    } catch (error: any) {
        if (spinnies.hasActiveSpinners()) {
            try {
                spinnies.fail("voyager-init");
            } catch {
                // noop
            }
        }
        printError(`Voyager critical failure: ${error.message}`);
        process.exit(1);
    }
}

async function loadVoyagerTestDefinition(queryArg: string | undefined, opts: any): Promise<VoyagerTestDefinition> {
    let testDef: VoyagerTestDefinition = { query: queryArg || "" };

    if (opts.file) {
        const filePath = path.resolve(process.cwd(), opts.file);
        try {
            const fileContent = await fs.readFile(filePath, "utf-8");
            testDef = yaml.load(fileContent) as VoyagerTestDefinition;
        } catch (err: any) {
            printError(`Failed to read test definition from ${opts.file}: ${err.message}`);
            process.exit(1);
        }
    }

    if (!testDef.query) {
        printError("You must provide either an inline [query] or a -f/--file definition with a 'query' field.");
        process.exit(1);
    }

    return testDef;
}

async function discoverVoyagerTools(activeBerths: Array<{ path: string }>, profiler: ProfilerService): Promise<VoyagerTool[]> {
    const tools: VoyagerTool[] = [];
    const loadedSkillNames = new Set<string>();

    for (const berth of activeBerths) {
        const skillPaths = await profiler.findSkills(berth.path);
        for (const skillPath of skillPaths) {
            try {
                const skillFile = path.join(skillPath, "SKILL.md");
                const rawContent = await fs.readFile(skillFile, "utf-8");
                const { data } = matter(rawContent);

                if (!data.name || !data.description) continue;

                const sanitizedName = String(data.name).replace(/[^a-zA-Z0-9_-]/g, "");
                if (!sanitizedName || loadedSkillNames.has(sanitizedName)) continue;

                tools.push({
                    type: "function",
                    function: {
                        name: sanitizedName,
                        description: String(data.description),
                        parameters: {
                            type: "object",
                            properties: {},
                            required: []
                        }
                    }
                });
                loadedSkillNames.add(sanitizedName);
            } catch {
                // Skip unreadable skills
            }
        }
    }

    return tools;
}

async function maybeOfferGhostDocking({
    baseDir,
    useGlobalScope,
    manifestManager,
    profiler,
    allowPrompt
}: {
    baseDir: string;
    useGlobalScope: boolean;
    manifestManager: any;
    profiler: ProfilerService;
    allowPrompt: boolean;
}) {
    if (!allowPrompt) return;

    const ghosts = await profiler.findSkills(baseDir);
    const unmanagedGhosts = ghosts.filter(p => !p.includes(".harbor/skills"));

    if (unmanagedGhosts.length === 0) return;

    const scopeLabel = useGlobalScope ? "global" : "local";
    console.log(kleur.magenta(`\n👻  Ghost Alert: I found ${unmanagedGhosts.length} ${scopeLabel} skill(s) that aren't manifested.`));
    if (!(await ask(`Would you like to dock these to your ${scopeLabel} manifest now?`, kleur))) {
        return;
    }

    for (const ghostPath of unmanagedGhosts) {
        const name = path.basename(ghostPath);
        await manifestManager.addSkill({
            name,
            source: ghostPath,
            localPath: ""
        }, useGlobalScope ? "global" : "local");
        console.log(kleur.green(`   ✓ Docked: ${name} (${useGlobalScope ? "Global" : "Local"})`));
    }
    printSuccess("All ghosts berthed. Run 'voyager' again to deploy them.");
}

async function runVoyagerScenario({
    label,
    testDef,
    tools,
    config,
    pretty,
    spinnies
}: {
    label: string;
    testDef: VoyagerTestDefinition;
    tools: VoyagerTool[];
    config: VoyagerConfig;
    pretty: boolean;
    spinnies: Spinnies;
}): Promise<VoyagerRunResult> {
    const spinnerId = `voyager-${label}`;
    const messages: any[] = [
        {
            role: "system",
            content: "You are an autonomous orchestrator agent traversing the Skill Harbor. Your goal is to satisfy the user's request by calling the appropriate sequence of skills (tools). When you have completed the request, return your final answer summarizing what was done."
        },
        {
            role: "user",
            content: testDef.query
        }
    ];
    const trace: VoyagerTraceEvent[] = [
        createTraceEvent("system", messages[0].content),
        createTraceEvent("user", testDef.query)
    ];
    const traceSequence: string[] = [];

    let iteration = 0;
    let finalAnswer = "";
    let status: VoyagerRunResult["status"] = "max_iterations";
    let error: string | undefined;
    const startedAt = Date.now();

    if (pretty) {
        spinnies.add(spinnerId, { text: `${label}: Agent thinking...` });
    }

    while (iteration < MAX_ITERATIONS) {
        iteration++;

        const body: Record<string, unknown> = {
            model: config.model,
            messages
        };
        if (tools.length > 0) {
            body.tools = tools;
            body.tool_choice = "auto";
        }

        const response = await fetch(`${config.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.apiKey}`
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            status = "api_error";
            error = `(${response.status}) ${await response.text()}`;
            break;
        }

        const data: any = await response.json();
        const choice = data.choices[0];
        const message = choice.message;

        messages.push(message);

        const assistantContent = typeof message.content === "string" ? message.content : "";
        trace.push(createTraceEvent("assistant", assistantContent, undefined, undefined));

        if (message.tool_calls && message.tool_calls.length > 0) {
            if (pretty) {
                spinnies.update(spinnerId, { text: `${label}: Agent orchestrating...` });
            }

            for (const toolCall of message.tool_calls) {
                const toolName = toolCall.function.name;
                traceSequence.push(toolName);

                if (pretty) {
                    console.log(`  ${kleur.cyan("⚓")} ${kleur.bold(label)} deployed ${kleur.bold(toolName)}`);
                }

                const mockResponse = testDef.mocks?.[toolName] || DEFAULT_MOCK_RESPONSE;

                messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    name: toolName,
                    content: mockResponse
                });
                trace.push(createTraceEvent("tool", mockResponse, toolName, toolCall.id));

                if (pretty) {
                    console.log(`    ${kleur.gray("↳ Mocked Response:")} ${kleur.dim(mockResponse)}`);
                }
            }

            if (pretty) {
                spinnies.update(spinnerId, { text: `${label}: Agent evaluating results...` });
            }
            continue;
        }

        finalAnswer = assistantContent;
        status = "completed";
        break;
    }

    const assertions = evaluateVoyagerAssertions(
        {
            label,
            status,
            finalAnswer,
            iterations: iteration,
            elapsedMs: Date.now() - startedAt,
            availableToolCount: tools.length,
            toolCallCount: traceSequence.length,
            traceSequence,
            trace,
            assertions: {
                allPassed: true,
                missingExpectedTools: [],
                missingFinalContains: []
            },
            error
        },
        testDef
    );

    if (status === "completed" && !assertions.allPassed) {
        status = "assertion_failed";
    }

    if (pretty) {
        if (status === "completed" || status === "assertion_failed") {
            spinnies.succeed(spinnerId, { text: `${kleur.green(label)} run complete.` });
        } else {
            spinnies.fail(spinnerId, { text: `${kleur.red(label)} run failed.` });
        }
    }

    return {
        label,
        status,
        finalAnswer,
        iterations: iteration,
        elapsedMs: Date.now() - startedAt,
        availableToolCount: tools.length,
        toolCallCount: traceSequence.length,
        traceSequence,
        trace,
        assertions,
        error
    };
}

function evaluateVoyagerAssertions(run: VoyagerRunResult, testDef: VoyagerTestDefinition): VoyagerAssertionSummary {
    const missingExpectedTools: string[] = [];
    const missingFinalContains: string[] = [];

    let expectedToolsPassed: boolean | undefined;
    if (testDef.expected_tools && testDef.expected_tools.length > 0) {
        expectedToolsPassed = true;
        let traceIdx = 0;
        for (const expected of testDef.expected_tools) {
            const foundIdx = run.traceSequence.indexOf(expected, traceIdx);
            if (foundIdx === -1) {
                expectedToolsPassed = false;
                missingExpectedTools.push(expected);
            } else {
                traceIdx = foundIdx + 1;
            }
        }
    }

    let finalContainsPassed: boolean | undefined;
    if (testDef.assert_final_contains && testDef.assert_final_contains.length > 0) {
        finalContainsPassed = true;
        for (const fragment of testDef.assert_final_contains) {
            if (!run.finalAnswer.includes(fragment)) {
                finalContainsPassed = false;
                missingFinalContains.push(fragment);
            }
        }
    }

    let statusPassed: boolean | undefined;
    if (testDef.assert_status) {
        const normalizedStatus = run.status === "completed" ? "completed" : "failed";
        statusPassed = normalizedStatus === testDef.assert_status;
    }

    const allPassed = [expectedToolsPassed, finalContainsPassed, statusPassed].every(value => value !== false);

    return {
        allPassed,
        expectedToolsPassed,
        finalContainsPassed,
        statusPassed,
        missingExpectedTools,
        missingFinalContains
    };
}

function buildVoyagerCompareResult(
    testDef: VoyagerTestDefinition,
    withSkills: VoyagerRunResult,
    withoutSkills: VoyagerRunResult
): VoyagerCompareResult {
    return {
        scenario: {
            query: testDef.query,
            name: testDef.metadata?.name,
            expectedTools: testDef.expected_tools ?? []
        },
        with_skills: withSkills,
        without_skills: withoutSkills,
        delta: {
            status_changed: withSkills.status !== withoutSkills.status,
            status_summary: `${withoutSkills.status} -> ${withSkills.status}`,
            assertion_improved: Number(withSkills.assertions.allPassed) > Number(withoutSkills.assertions.allPassed),
            iteration_delta: withSkills.iterations - withoutSkills.iterations,
            elapsed_ms_delta: withSkills.elapsedMs - withoutSkills.elapsedMs,
            tool_count_delta: withSkills.toolCallCount - withoutSkills.toolCallCount,
            skills_used_delta: withSkills.availableToolCount - withoutSkills.availableToolCount
        }
    };
}

function printVoyagerSingleResult(run: VoyagerRunResult, traceDir?: string) {
    console.log(`${kleur.bold("Run Summary:")} ${kleur.white(run.status)}`);
    console.log(`${kleur.gray("Iterations:")} ${run.iterations} | ${kleur.gray("Tool calls:")} ${run.toolCallCount} | ${kleur.gray("Elapsed:")} ${run.elapsedMs}ms`);

    if (run.finalAnswer) {
        console.log(`\n${kleur.magenta("■ Final Output:")}\n${kleur.white(run.finalAnswer)}`);
    }

    printAssertionSummary(run.assertions);

    if (traceDir) {
        console.log(`\n${kleur.gray("Saved trace artifacts:")} ${kleur.cyan(traceDir)}`);
    }
}

function printVoyagerCompareResult(result: VoyagerCompareResult, traceDir?: string) {
    console.log(kleur.bold("Compare Summary"));
    console.log(`${kleur.gray("Scenario:")} ${kleur.white(result.scenario.name || result.scenario.query)}`);

    for (const run of [result.with_skills, result.without_skills]) {
        console.log(`\n${kleur.bold(run.label)}`);
        console.log(`  ${kleur.gray("Status:")} ${run.status}`);
        console.log(`  ${kleur.gray("Iterations:")} ${run.iterations}`);
        console.log(`  ${kleur.gray("Tool calls:")} ${run.toolCallCount}`);
        console.log(`  ${kleur.gray("Elapsed:")} ${run.elapsedMs}ms`);
        if (run.finalAnswer) {
            console.log(`  ${kleur.gray("Final:")} ${run.finalAnswer}`);
        }
        printAssertionSummary(run.assertions, "  ");
    }

    console.log(`\n${kleur.bold("Delta")}`);
    console.log(`  ${kleur.gray("Status:")} ${result.delta.status_summary}`);
    console.log(`  ${kleur.gray("Assertions improved:")} ${result.delta.assertion_improved ? "yes" : "no"}`);
    console.log(`  ${kleur.gray("Iteration delta:")} ${result.delta.iteration_delta}`);
    console.log(`  ${kleur.gray("Elapsed delta:")} ${result.delta.elapsed_ms_delta}ms`);
    console.log(`  ${kleur.gray("Tool-call delta:")} ${result.delta.tool_count_delta}`);

    if (traceDir) {
        console.log(`\n${kleur.gray("Saved trace artifacts:")} ${kleur.cyan(traceDir)}`);
    }
}

function printAssertionSummary(assertions: VoyagerAssertionSummary, indent = "") {
    if (assertions.expectedToolsPassed !== undefined) {
        if (assertions.expectedToolsPassed) {
            console.log(`${indent}${kleur.green("✓")} Expected tool assertions passed.`);
        } else {
            console.log(`${indent}${kleur.red("✗")} Missing expected tools: ${assertions.missingExpectedTools.join(", ")}`);
        }
    }

    if (assertions.finalContainsPassed !== undefined) {
        if (assertions.finalContainsPassed) {
            console.log(`${indent}${kleur.green("✓")} Final-output assertions passed.`);
        } else {
            console.log(`${indent}${kleur.red("✗")} Missing output fragments: ${assertions.missingFinalContains.join(", ")}`);
        }
    }

    if (assertions.statusPassed !== undefined) {
        console.log(`${indent}${assertions.statusPassed ? kleur.green("✓") : kleur.red("✗")} Status assertion ${assertions.statusPassed ? "passed" : "failed"}.`);
    }
}

function resolveTraceDirectory(saveTrace?: string | boolean): string | undefined {
    if (!saveTrace) return undefined;

    if (typeof saveTrace === "string") {
        return path.resolve(process.cwd(), saveTrace);
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return path.join(process.cwd(), ".harbor", "voyager-runs", stamp);
}

async function saveVoyagerArtifacts(traceDir: string, payload: unknown) {
    await fs.mkdir(traceDir, { recursive: true });

    if (isComparePayload(payload)) {
        await fs.writeFile(path.join(traceDir, "with-skills.json"), JSON.stringify(payload.with_skills, null, 2), "utf-8");
        await fs.writeFile(path.join(traceDir, "without-skills.json"), JSON.stringify(payload.without_skills, null, 2), "utf-8");
        await fs.writeFile(path.join(traceDir, "summary.json"), JSON.stringify(payload, null, 2), "utf-8");
        return;
    }

    const singlePayload = payload as { run: VoyagerRunResult };
    await fs.writeFile(path.join(traceDir, "run.json"), JSON.stringify(singlePayload.run, null, 2), "utf-8");
    await fs.writeFile(path.join(traceDir, "summary.json"), JSON.stringify(payload, null, 2), "utf-8");
}

function isComparePayload(payload: unknown): payload is VoyagerCompareResult {
    return Boolean(payload && typeof payload === "object" && "with_skills" in payload && "without_skills" in payload);
}

function createTraceEvent(
    role: VoyagerTraceEvent["role"],
    content: string,
    toolName?: string,
    toolCallId?: string
): VoyagerTraceEvent {
    return {
        role,
        content,
        toolName,
        toolCallId,
        timestamp: new Date().toISOString()
    };
}
