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
    discoverGhosts,
    resolveGhostScanContext,
    summarizeGhosts,
    type GhostRecord
} from "../services/ghosts";
import {
    VoyagerAssertionSummary,
    VoyagerBenchmarkPackDefinition,
    VoyagerBenchmarkPackSummary,
    VoyagerBenchmarkScenarioDefinition,
    VoyagerBenchmarkScenarioSummary,
    VoyagerBranchAssertions,
    VoyagerCompareResult,
    VoyagerDeltaAssertions,
    VoyagerDeltaComparator,
    VoyagerOfflineFixtureResult,
    VoyagerRunResult,
    VoyagerTestDefinition,
    VoyagerTraceEvent
} from "../types/voyager";
import { printError, printHeader, printSuccess } from "../ui";

const DEFAULT_MOCK_RESPONSE = "Simulated success. Context payload acknowledged.";
const MAX_ITERATIONS = 10;
const BENCHMARK_PACK_KIND = "harbor.voyager.benchmark-pack";
const BENCHMARK_PACK_RESULT_KIND = "harbor.voyager.benchmark-pack.result";
const SCENARIO_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const OFFLINE_FIXTURE_STATUSES = new Set<VoyagerOfflineFixtureResult["status"]>([
    "completed",
    "assertion_failed",
    "max_iterations",
    "api_error",
    "failed"
]);

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

type VoyagerInputDefinition =
    | { kind: "legacy"; testDef: VoyagerTestDefinition }
    | { kind: "benchmark-pack"; packDef: VoyagerBenchmarkPackDefinition; sourcePath: string };

type VoyagerBenchmarkScenarioExecution = {
    summary: VoyagerBenchmarkScenarioSummary;
    withSkillsRun: VoyagerRunResult;
    withoutSkillsRun: VoyagerRunResult;
};

type VoyagerBenchmarkPackExecution = {
    summary: VoyagerBenchmarkPackSummary;
    scenarioExecutions: VoyagerBenchmarkScenarioExecution[];
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

        const input = await loadVoyagerInputDefinition(queryArg, opts);
        const traceDir = resolveTraceDirectory(opts.saveTrace, input.kind === "benchmark-pack" ? input.packDef.pack.id : undefined);

        if (input.kind === "benchmark-pack") {
            const result = await runVoyagerBenchmarkPack({
                packDef: input.packDef,
                sourcePath: input.sourcePath,
                pretty,
                spinnies
            });

            if (traceDir) {
                await saveVoyagerPackArtifacts(traceDir, result);
            }

            if (format === "json") {
                console.log(JSON.stringify(result.summary, null, 2));
            } else {
                printVoyagerBenchmarkPackResult(result.summary, traceDir);
            }

            if (!result.summary.pass) {
                process.exit(1);
            }
            return;
        }

        const testDef = input.testDef;
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
            const ghosts = await discoverVoyagerGhosts({
                baseDir,
                manifestManager,
                manifest,
                profiler
            });
            await maybeOfferGhostDocking({
                useGlobalScope,
                manifestManager,
                ghosts,
                allowPrompt: Boolean(process.stdin.isTTY && process.stdout.isTTY)
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

async function loadVoyagerInputDefinition(queryArg: string | undefined, opts: any): Promise<VoyagerInputDefinition> {
    if (!opts.file) {
        const testDef: VoyagerTestDefinition = { query: queryArg || "" };
        ensureLegacyTestDefinition(testDef);
        return { kind: "legacy", testDef };
    }

    const filePath = path.resolve(process.cwd(), opts.file);
    try {
        const fileContent = await fs.readFile(filePath, "utf-8");
        const parsed = yaml.load(fileContent) as unknown;

        if (looksLikeBenchmarkPack(parsed)) {
            return {
                kind: "benchmark-pack",
                packDef: validateBenchmarkPackDefinition(parsed),
                sourcePath: filePath
            };
        }

        const testDef = parsed as VoyagerTestDefinition;
        ensureLegacyTestDefinition(testDef);
        return { kind: "legacy", testDef };
    } catch (err: any) {
        printError(`Failed to read test definition from ${opts.file}: ${err.message}`);
        process.exit(1);
    }
}

function ensureLegacyTestDefinition(testDef: VoyagerTestDefinition) {
    if (!testDef.query) {
        printError("You must provide either an inline [query] or a -f/--file definition with a 'query' field.");
        process.exit(1);
    }
}

function looksLikeBenchmarkPack(value: unknown): boolean {
    return isRecord(value) && (
        "kind" in value
        || "version" in value
        || "pack" in value
        || "scenarios" in value
    );
}

function validateBenchmarkPackDefinition(value: unknown): VoyagerBenchmarkPackDefinition {
    if (!isRecord(value)) {
        throw new Error("Benchmark pack root must be an object.");
    }

    if (value.kind === undefined) {
        throw new Error("Benchmark pack is missing required 'kind'.");
    }
    if (value.kind !== BENCHMARK_PACK_KIND) {
        throw new Error(`Unsupported benchmark pack kind '${String(value.kind)}'. Expected '${BENCHMARK_PACK_KIND}'.`);
    }
    if (value.version !== 1) {
        throw new Error(`Unsupported benchmark pack version '${String(value.version)}'. Expected 1.`);
    }
    if (!isRecord(value.pack)) {
        throw new Error("Benchmark pack is missing required 'pack' object.");
    }

    const packId = value.pack.id;
    if (typeof packId !== "string" || !SCENARIO_ID_PATTERN.test(packId)) {
        throw new Error("Benchmark pack requires a slug-valid 'pack.id'.");
    }

    if (!Array.isArray(value.scenarios) || value.scenarios.length === 0) {
        throw new Error("Benchmark pack requires a non-empty 'scenarios' array.");
    }

    const seenScenarioIds = new Set<string>();
    const scenarios = value.scenarios.map((scenario, index) => validateBenchmarkScenario(scenario, index, seenScenarioIds));

    return {
        kind: BENCHMARK_PACK_KIND,
        version: 1,
        pack: {
            id: packId,
            name: typeof value.pack.name === "string" ? value.pack.name : undefined,
            description: typeof value.pack.description === "string" ? value.pack.description : undefined,
            tags: Array.isArray(value.pack.tags) ? value.pack.tags.filter((tag): tag is string => typeof tag === "string") : undefined
        },
        scenarios
    };
}

function validateBenchmarkScenario(value: unknown, index: number, seenScenarioIds: Set<string>): VoyagerBenchmarkScenarioDefinition {
    if (!isRecord(value)) {
        throw new Error(`Scenario at index ${index} must be an object.`);
    }

    if (typeof value.id !== "string" || !SCENARIO_ID_PATTERN.test(value.id)) {
        throw new Error(`Scenario at index ${index} requires a slug-valid 'id'.`);
    }
    if (seenScenarioIds.has(value.id)) {
        throw new Error(`Duplicate scenario id '${value.id}'.`);
    }
    seenScenarioIds.add(value.id);

    if (typeof value.query !== "string" || value.query.length === 0) {
        throw new Error(`Scenario '${value.id}' requires a non-empty 'query'.`);
    }
    if (!isRecord(value.fixtures)) {
        throw new Error(`Scenario '${value.id}' requires a 'fixtures' object.`);
    }
    if (!isRecord(value.fixtures.with_skills)) {
        throw new Error(`Scenario '${value.id}' is missing required 'fixtures.with_skills'.`);
    }
    if (!isRecord(value.fixtures.without_skills)) {
        throw new Error(`Scenario '${value.id}' is missing required 'fixtures.without_skills'.`);
    }

    return {
        id: value.id,
        name: typeof value.name === "string" ? value.name : undefined,
        query: value.query,
        tags: Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === "string") : undefined,
        fixtures: {
            with_skills: validateOfflineFixture(value.fixtures.with_skills, value.id, "with_skills"),
            without_skills: validateOfflineFixture(value.fixtures.without_skills, value.id, "without_skills")
        },
        assertions: validateScenarioAssertions(value.assertions)
    };
}

function validateScenarioAssertions(value: unknown): VoyagerBenchmarkScenarioDefinition["assertions"] | undefined {
    if (value === undefined) return undefined;
    if (!isRecord(value)) {
        throw new Error("Scenario assertions must be an object when provided.");
    }

    return {
        with_skills: validateBranchAssertions(value.with_skills),
        without_skills: validateBranchAssertions(value.without_skills),
        delta: validateDeltaAssertions(value.delta)
    };
}

function validateBranchAssertions(value: unknown): VoyagerBranchAssertions | undefined {
    if (value === undefined) return undefined;
    if (!isRecord(value)) {
        throw new Error("Scenario branch assertions must be an object when provided.");
    }

    return {
        expected_tools: Array.isArray(value.expected_tools)
            ? value.expected_tools.filter((entry): entry is string => typeof entry === "string")
            : undefined,
        assert_final_contains: Array.isArray(value.assert_final_contains)
            ? value.assert_final_contains.filter((entry): entry is string => typeof entry === "string")
            : undefined,
        assert_status: value.assert_status === "completed" || value.assert_status === "failed"
            ? value.assert_status
            : undefined
    };
}

function validateDeltaAssertions(value: unknown): VoyagerDeltaAssertions | undefined {
    if (value === undefined) return undefined;
    if (!isRecord(value)) {
        throw new Error("Scenario delta assertions must be an object when provided.");
    }

    return {
        expect_assertion_improved: typeof value.expect_assertion_improved === "boolean" ? value.expect_assertion_improved : undefined,
        expect_status_changed: typeof value.expect_status_changed === "boolean" ? value.expect_status_changed : undefined,
        expect_status_summary: typeof value.expect_status_summary === "string" ? value.expect_status_summary : undefined,
        expect_tool_count_delta: validateDeltaComparator(value.expect_tool_count_delta),
        expect_iteration_delta: validateDeltaComparator(value.expect_iteration_delta),
        expect_elapsed_ms_delta: validateDeltaComparator(value.expect_elapsed_ms_delta)
    };
}

function validateDeltaComparator(value: unknown): VoyagerDeltaComparator | undefined {
    if (value === undefined) return undefined;
    if (!isRecord(value)) {
        throw new Error("Delta comparator must be an object when provided.");
    }

    const comparator: VoyagerDeltaComparator = {};
    if (typeof value.eq === "number") comparator.eq = value.eq;
    if (typeof value.gte === "number") comparator.gte = value.gte;
    if (typeof value.lte === "number") comparator.lte = value.lte;
    return Object.keys(comparator).length > 0 ? comparator : undefined;
}

function validateOfflineFixture(value: unknown, scenarioId: string, label: "with_skills" | "without_skills"): VoyagerOfflineFixtureResult {
    if (!isRecord(value)) {
        throw new Error(`Scenario '${scenarioId}' fixture '${label}' must be an object.`);
    }

    if (typeof value.status !== "string" || !OFFLINE_FIXTURE_STATUSES.has(value.status as VoyagerOfflineFixtureResult["status"])) {
        throw new Error(`Scenario '${scenarioId}' fixture '${label}' requires a valid 'status'.`);
    }
    if (typeof value.final_answer !== "string") {
        throw new Error(`Scenario '${scenarioId}' fixture '${label}' requires 'final_answer'.`);
    }
    if (typeof value.iterations !== "number") {
        throw new Error(`Scenario '${scenarioId}' fixture '${label}' requires numeric 'iterations'.`);
    }
    if (typeof value.elapsed_ms !== "number") {
        throw new Error(`Scenario '${scenarioId}' fixture '${label}' requires numeric 'elapsed_ms'.`);
    }
    if (typeof value.available_tool_count !== "number") {
        throw new Error(`Scenario '${scenarioId}' fixture '${label}' requires numeric 'available_tool_count'.`);
    }
    if (!Array.isArray(value.trace_sequence) || !value.trace_sequence.every((entry: unknown) => typeof entry === "string")) {
        throw new Error(`Scenario '${scenarioId}' fixture '${label}' requires string-array 'trace_sequence'.`);
    }
    if (!Array.isArray(value.trace) || !value.trace.every(isVoyagerOfflineTraceEvent)) {
        throw new Error(`Scenario '${scenarioId}' fixture '${label}' requires valid 'trace' entries.`);
    }

    return {
        status: value.status as VoyagerOfflineFixtureResult["status"],
        final_answer: value.final_answer,
        iterations: value.iterations,
        elapsed_ms: value.elapsed_ms,
        available_tool_count: value.available_tool_count,
        trace_sequence: value.trace_sequence,
        trace: value.trace,
        error: typeof value.error === "string" ? value.error : undefined
    };
}

function isVoyagerOfflineTraceEvent(value: unknown): boolean {
    if (!isRecord(value)) return false;
    return typeof value.role === "string" && typeof value.content === "string";
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

async function discoverVoyagerGhosts({
    baseDir,
    manifestManager,
    manifest,
    profiler
}: {
    baseDir: string;
    manifestManager: any;
    manifest: any;
    profiler: ProfilerService;
}): Promise<GhostRecord[]> {
    const scanContext = await resolveGhostScanContext({
        baseDir,
        targets: manifest.targets,
        scanMode: "autodetect"
    });
    const ghosts = await discoverGhosts({
        baseDir,
        manifestManager,
        manifest,
        scanContext,
        profiler
    });

    return summarizeGhosts(ghosts).active;
}

async function maybeOfferGhostDocking({
    useGlobalScope,
    manifestManager,
    ghosts,
    allowPrompt
}: {
    useGlobalScope: boolean;
    manifestManager: any;
    ghosts: GhostRecord[];
    allowPrompt: boolean;
}) {
    if (!allowPrompt) return;
    if (ghosts.length === 0) return;

    const scopeLabel = useGlobalScope ? "global" : "local";
    console.log(kleur.magenta(`\n👻  Ghost Alert: I found ${ghosts.length} ${scopeLabel} skill(s) that aren't manifested.`));
    if (!(await ask(`Would you like to dock these to your ${scopeLabel} manifest now?`, kleur))) {
        return;
    }

    for (const ghost of ghosts) {
        const name = ghost.name || path.basename(ghost.path);
        await manifestManager.addSkill({
            name,
            source: ghost.path,
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

    const assertions = evaluateVoyagerBranchAssertions(runSkeleton({
        label,
        status,
        finalAnswer,
        iterations: iteration,
        elapsedMs: Date.now() - startedAt,
        availableToolCount: tools.length,
        toolCallCount: traceSequence.length,
        traceSequence,
        trace,
        error
    }), {
        expected_tools: testDef.expected_tools,
        assert_final_contains: testDef.assert_final_contains,
        assert_status: testDef.assert_status
    });

    if (status === "completed" && !assertions.allPassed) {
        status = "assertion_failed";
    }

    const run = runSkeleton({
        label,
        status,
        finalAnswer,
        iterations: iteration,
        elapsedMs: Date.now() - startedAt,
        availableToolCount: tools.length,
        toolCallCount: traceSequence.length,
        traceSequence,
        trace,
        error
    }, assertions);

    if (pretty) {
        if (status === "completed" || status === "assertion_failed") {
            spinnies.succeed(spinnerId, { text: `${kleur.green(label)} run complete.` });
        } else {
            spinnies.fail(spinnerId, { text: `${kleur.red(label)} run failed.` });
        }
    }

    return run;
}

async function runVoyagerBenchmarkPack({
    packDef,
    sourcePath,
    pretty,
    spinnies
}: {
    packDef: VoyagerBenchmarkPackDefinition;
    sourcePath: string;
    pretty: boolean;
    spinnies: Spinnies;
}): Promise<VoyagerBenchmarkPackExecution> {
    const spinnerId = `voyager-pack-${packDef.pack.id}`;
    if (pretty) {
        spinnies.add(spinnerId, { text: `Running benchmark pack ${kleur.bold(packDef.pack.id)}...` });
    }

    const scenarioExecutions: VoyagerBenchmarkScenarioExecution[] = [];

    for (const scenario of packDef.scenarios) {
        const withSkillsRun = buildOfflineRunFromFixture("with-skills", scenario.fixtures.with_skills);
        const withoutSkillsRun = buildOfflineRunFromFixture("without-skills", scenario.fixtures.without_skills);

        const withSkillsAssertions = evaluateVoyagerBranchAssertions(withSkillsRun, scenario.assertions?.with_skills);
        const withoutSkillsAssertions = evaluateVoyagerBranchAssertions(withoutSkillsRun, scenario.assertions?.without_skills);

        const finalWithSkillsRun = finalizeOfflineRun(withSkillsRun, withSkillsAssertions);
        const finalWithoutSkillsRun = finalizeOfflineRun(withoutSkillsRun, withoutSkillsAssertions);
        const delta = buildVoyagerPackDelta(finalWithSkillsRun, finalWithoutSkillsRun);
        const deltaEvaluation = evaluateVoyagerDeltaAssertions(delta, scenario.assertions?.delta);
        const scenarioFailures = collectScenarioFailures(withSkillsAssertions, withoutSkillsAssertions, deltaEvaluation.failures);
        const scenarioPassed = withSkillsAssertions.allPassed && withoutSkillsAssertions.allPassed && deltaEvaluation.allPassed;

        scenarioExecutions.push({
            withSkillsRun: finalWithSkillsRun,
            withoutSkillsRun: finalWithoutSkillsRun,
            summary: {
                id: scenario.id,
                name: scenario.name,
                path: path.join("scenarios", scenario.id, "summary.json"),
                status: scenarioPassed ? "passed" : "failed",
                with_skills: {
                    status: toPackConditionStatus(finalWithSkillsRun.status),
                    assertions_passed: withSkillsAssertions.allPassed,
                    tool_call_count: finalWithSkillsRun.toolCallCount
                },
                without_skills: {
                    status: toPackConditionStatus(finalWithoutSkillsRun.status),
                    assertions_passed: withoutSkillsAssertions.allPassed,
                    tool_call_count: finalWithoutSkillsRun.toolCallCount
                },
                delta: {
                    ...delta,
                    expectations_passed: deltaEvaluation.allPassed
                },
                failures: scenarioFailures
            }
        });
    }

    const summary = buildVoyagerBenchmarkPackSummary(packDef, sourcePath, scenarioExecutions);

    if (pretty) {
        if (summary.pass) {
            spinnies.succeed(spinnerId, { text: `Benchmark pack ${kleur.green(packDef.pack.id)} complete.` });
        } else {
            spinnies.fail(spinnerId, { text: `Benchmark pack ${kleur.red(packDef.pack.id)} failed.` });
        }
    }

    return {
        summary,
        scenarioExecutions
    };
}

function buildOfflineRunFromFixture(label: string, fixture: VoyagerOfflineFixtureResult): VoyagerRunResult {
    const trace = fixture.trace.map((entry, index) => ({
        role: entry.role,
        content: entry.content,
        toolName: entry.toolName,
        toolCallId: entry.toolCallId,
        timestamp: entry.timestamp ?? new Date(Date.now() + index).toISOString()
    }));

    return runSkeleton({
        label,
        status: fixture.status === "failed" ? "assertion_failed" : fixture.status,
        finalAnswer: fixture.final_answer,
        iterations: fixture.iterations,
        elapsedMs: fixture.elapsed_ms,
        availableToolCount: fixture.available_tool_count,
        toolCallCount: fixture.trace_sequence.length,
        traceSequence: [...fixture.trace_sequence],
        trace,
        error: fixture.error
    });
}

function finalizeOfflineRun(run: VoyagerRunResult, assertions: VoyagerAssertionSummary): VoyagerRunResult {
    const status = run.status === "completed" && !assertions.allPassed
        ? "assertion_failed"
        : run.status;

    return runSkeleton({
        ...run,
        status
    }, assertions);
}

function runSkeleton(run: Omit<VoyagerRunResult, "assertions">, assertions?: VoyagerAssertionSummary): VoyagerRunResult {
    return {
        ...run,
        assertions: assertions ?? {
            allPassed: true,
            missingExpectedTools: [],
            missingFinalContains: []
        }
    };
}

function evaluateVoyagerBranchAssertions(run: VoyagerRunResult, assertions?: VoyagerBranchAssertions): VoyagerAssertionSummary {
    const missingExpectedTools: string[] = [];
    const missingFinalContains: string[] = [];

    let expectedToolsPassed: boolean | undefined;
    if (assertions?.expected_tools && assertions.expected_tools.length > 0) {
        expectedToolsPassed = true;
        let traceIdx = 0;
        for (const expected of assertions.expected_tools) {
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
    if (assertions?.assert_final_contains && assertions.assert_final_contains.length > 0) {
        finalContainsPassed = true;
        for (const fragment of assertions.assert_final_contains) {
            if (!run.finalAnswer.includes(fragment)) {
                finalContainsPassed = false;
                missingFinalContains.push(fragment);
            }
        }
    }

    let statusPassed: boolean | undefined;
    if (assertions?.assert_status) {
        statusPassed = toPackConditionStatus(run.status) === assertions.assert_status;
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
        delta: buildVoyagerCompareDelta(withSkills, withoutSkills)
    };
}

function buildVoyagerCompareDelta(withSkills: VoyagerRunResult, withoutSkills: VoyagerRunResult): VoyagerCompareResult["delta"] {
    return {
        status_changed: withSkills.status !== withoutSkills.status,
        status_summary: `${withoutSkills.status} -> ${withSkills.status}`,
        assertion_improved: Number(withSkills.assertions.allPassed) > Number(withoutSkills.assertions.allPassed),
        iteration_delta: withSkills.iterations - withoutSkills.iterations,
        elapsed_ms_delta: withSkills.elapsedMs - withoutSkills.elapsedMs,
        tool_count_delta: withSkills.toolCallCount - withoutSkills.toolCallCount,
        skills_used_delta: withSkills.availableToolCount - withoutSkills.availableToolCount
    };
}

function buildVoyagerPackDelta(withSkills: VoyagerRunResult, withoutSkills: VoyagerRunResult): VoyagerCompareResult["delta"] {
    const withSkillsStatus = toPackConditionStatus(withSkills.status);
    const withoutSkillsStatus = toPackConditionStatus(withoutSkills.status);
    const assertionImproved = Number(withSkills.assertions.allPassed) > Number(withoutSkills.assertions.allPassed)
        || (withSkillsStatus === "completed" && withoutSkillsStatus === "failed");

    return {
        status_changed: withSkillsStatus !== withoutSkillsStatus,
        status_summary: `${withoutSkillsStatus} -> ${withSkillsStatus}`,
        assertion_improved: assertionImproved,
        iteration_delta: withSkills.iterations - withoutSkills.iterations,
        elapsed_ms_delta: withSkills.elapsedMs - withoutSkills.elapsedMs,
        tool_count_delta: withSkills.toolCallCount - withoutSkills.toolCallCount,
        skills_used_delta: withSkills.availableToolCount - withoutSkills.availableToolCount
    };
}

function evaluateVoyagerDeltaAssertions(delta: VoyagerCompareResult["delta"], assertions?: VoyagerDeltaAssertions): { allPassed: boolean; failures: string[] } {
    if (!assertions) {
        return { allPassed: true, failures: [] };
    }

    const failures: string[] = [];

    if (assertions.expect_assertion_improved !== undefined && delta.assertion_improved !== assertions.expect_assertion_improved) {
        failures.push(`Expected assertion_improved=${assertions.expect_assertion_improved} but received ${delta.assertion_improved}.`);
    }
    if (assertions.expect_status_changed !== undefined && delta.status_changed !== assertions.expect_status_changed) {
        failures.push(`Expected status_changed=${assertions.expect_status_changed} but received ${delta.status_changed}.`);
    }
    if (assertions.expect_status_summary !== undefined && delta.status_summary !== assertions.expect_status_summary) {
        failures.push(`Expected status_summary='${assertions.expect_status_summary}' but received '${delta.status_summary}'.`);
    }

    evaluateComparatorFailures("tool_count_delta", delta.tool_count_delta, assertions.expect_tool_count_delta, failures);
    evaluateComparatorFailures("iteration_delta", delta.iteration_delta, assertions.expect_iteration_delta, failures);
    evaluateComparatorFailures("elapsed_ms_delta", delta.elapsed_ms_delta, assertions.expect_elapsed_ms_delta, failures);

    return {
        allPassed: failures.length === 0,
        failures
    };
}

function evaluateComparatorFailures(
    label: string,
    value: number,
    comparator: VoyagerDeltaComparator | undefined,
    failures: string[]
) {
    if (!comparator) return;
    if (comparator.eq !== undefined && value !== comparator.eq) {
        failures.push(`Expected ${label} == ${comparator.eq} but received ${value}.`);
    }
    if (comparator.gte !== undefined && value < comparator.gte) {
        failures.push(`Expected ${label} >= ${comparator.gte} but received ${value}.`);
    }
    if (comparator.lte !== undefined && value > comparator.lte) {
        failures.push(`Expected ${label} <= ${comparator.lte} but received ${value}.`);
    }
}

function collectScenarioFailures(
    withSkills: VoyagerAssertionSummary,
    withoutSkills: VoyagerAssertionSummary,
    deltaFailures: string[]
): string[] {
    const failures: string[] = [];

    if (withSkills.expectedToolsPassed === false) {
        failures.push(`with_skills missing expected tools: ${withSkills.missingExpectedTools.join(", ")}`);
    }
    if (withSkills.finalContainsPassed === false) {
        failures.push(`with_skills missing output fragments: ${withSkills.missingFinalContains.join(", ")}`);
    }
    if (withSkills.statusPassed === false) {
        failures.push("with_skills status assertion failed.");
    }

    if (withoutSkills.expectedToolsPassed === false) {
        failures.push(`without_skills missing expected tools: ${withoutSkills.missingExpectedTools.join(", ")}`);
    }
    if (withoutSkills.finalContainsPassed === false) {
        failures.push(`without_skills missing output fragments: ${withoutSkills.missingFinalContains.join(", ")}`);
    }
    if (withoutSkills.statusPassed === false) {
        failures.push("without_skills status assertion failed.");
    }

    failures.push(...deltaFailures);
    return failures;
}

function buildVoyagerBenchmarkPackSummary(
    packDef: VoyagerBenchmarkPackDefinition,
    sourcePath: string,
    executions: VoyagerBenchmarkScenarioExecution[]
): VoyagerBenchmarkPackSummary {
    const scenariosPassed = executions.filter(execution => execution.summary.status === "passed").length;
    const scenariosFailed = executions.length - scenariosPassed;

    const conditionsPassed = executions.reduce((sum, execution) => {
        return sum
            + Number(execution.summary.with_skills.assertions_passed)
            + Number(execution.summary.without_skills.assertions_passed);
    }, 0);

    const deltaImproved = executions.filter(execution => execution.summary.delta.assertion_improved).length;
    const deltaNeutral = executions.filter(execution => isNeutralDelta(execution.summary.delta)).length;
    const deltaRegressed = executions.length - deltaImproved - deltaNeutral;

    return {
        kind: BENCHMARK_PACK_RESULT_KIND,
        version: 1,
        pack: {
            id: packDef.pack.id,
            name: packDef.pack.name,
            source: sourcePath,
            mode: "offline-fixture",
            generated_at: new Date().toISOString()
        },
        totals: {
            scenarios_total: executions.length,
            scenarios_passed: scenariosPassed,
            scenarios_failed: scenariosFailed,
            conditions_total: executions.length * 2,
            conditions_passed: conditionsPassed,
            conditions_failed: executions.length * 2 - conditionsPassed,
            delta_improved: deltaImproved,
            delta_neutral: deltaNeutral,
            delta_regressed: deltaRegressed
        },
        pass: scenariosFailed === 0,
        scenarios: executions.map(execution => execution.summary)
    };
}

function isNeutralDelta(delta: VoyagerBenchmarkScenarioSummary["delta"]): boolean {
    return !delta.assertion_improved
        && !delta.status_changed
        && delta.iteration_delta === 0
        && delta.elapsed_ms_delta === 0
        && delta.tool_count_delta === 0;
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

function printVoyagerBenchmarkPackResult(result: VoyagerBenchmarkPackSummary, traceDir?: string) {
    console.log(kleur.bold("Benchmark Pack Summary"));
    console.log(`${kleur.gray("Pack:")} ${kleur.white(result.pack.name || result.pack.id)}`);
    console.log(`${kleur.gray("Pass:")} ${result.pass ? kleur.green("yes") : kleur.red("no")}`);
    console.log(`${kleur.gray("Scenarios:")} ${result.totals.scenarios_passed}/${result.totals.scenarios_total} passed`);

    for (const scenario of result.scenarios) {
        console.log(`\n${kleur.bold(scenario.id)} ${scenario.status === "passed" ? kleur.green("passed") : kleur.red("failed")}`);
        console.log(`  ${kleur.gray("Status delta:")} ${scenario.delta.status_summary}`);
        console.log(`  ${kleur.gray("Assertion improved:")} ${scenario.delta.assertion_improved ? "yes" : "no"}`);
        if (scenario.failures.length > 0) {
            for (const failure of scenario.failures) {
                console.log(`  ${kleur.red("✗")} ${failure}`);
            }
        }
    }

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

function resolveTraceDirectory(saveTrace?: string | boolean, packId?: string): string | undefined {
    if (!saveTrace) return undefined;

    if (typeof saveTrace === "string") {
        return path.resolve(process.cwd(), saveTrace);
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const suffix = packId ? `-${packId}` : "";
    return path.join(process.cwd(), ".harbor", "voyager-runs", `${stamp}${suffix}`);
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

async function saveVoyagerPackArtifacts(traceDir: string, payload: VoyagerBenchmarkPackExecution) {
    await fs.mkdir(traceDir, { recursive: true });
    await fs.writeFile(path.join(traceDir, "summary.json"), JSON.stringify(payload.summary, null, 2), "utf-8");

    for (const execution of payload.scenarioExecutions) {
        const scenarioDir = path.join(traceDir, "scenarios", execution.summary.id);
        await fs.mkdir(scenarioDir, { recursive: true });
        await fs.writeFile(path.join(scenarioDir, "with-skills.json"), JSON.stringify(execution.withSkillsRun, null, 2), "utf-8");
        await fs.writeFile(path.join(scenarioDir, "without-skills.json"), JSON.stringify(execution.withoutSkillsRun, null, 2), "utf-8");
        await fs.writeFile(path.join(scenarioDir, "summary.json"), JSON.stringify(execution.summary, null, 2), "utf-8");
    }
}

function isComparePayload(payload: unknown): payload is VoyagerCompareResult {
    return Boolean(payload && typeof payload === "object" && "with_skills" in payload && "without_skills" in payload);
}

function toPackConditionStatus(status: VoyagerRunResult["status"]): "completed" | "failed" {
    return status === "completed" ? "completed" : "failed";
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

function isRecord(value: unknown): value is Record<string, any> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
