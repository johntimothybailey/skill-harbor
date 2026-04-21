export interface VoyagerTestDefinition {
    /** The instruction given to the agent */
    query: string;
    /** The sequence of skills the agent should use in order */
    expected_tools?: string[];
    /** Mocks for specific tool calls. Key is skill name, value is mock return string */
    mocks?: Record<string, string>;
    /** Optional metadata for display/reporting */
    metadata?: {
        name?: string;
        tags?: string[];
    };
    /** Optional substrings that must appear in the final answer */
    assert_final_contains?: string[];
    /** Optional terminal-status assertion */
    assert_status?: "completed" | "failed";
}

export interface VoyagerBranchAssertions {
    expected_tools?: string[];
    assert_final_contains?: string[];
    assert_status?: "completed" | "failed";
}

export interface VoyagerDeltaComparator {
    eq?: number;
    gte?: number;
    lte?: number;
}

export interface VoyagerDeltaAssertions {
    expect_assertion_improved?: boolean;
    expect_status_changed?: boolean;
    expect_status_summary?: string;
    expect_tool_count_delta?: VoyagerDeltaComparator;
    expect_iteration_delta?: VoyagerDeltaComparator;
    expect_elapsed_ms_delta?: VoyagerDeltaComparator;
}

export type VoyagerRunStatus = "completed" | "assertion_failed" | "max_iterations" | "api_error";

export interface VoyagerTraceEvent {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    toolName?: string;
    toolCallId?: string;
    timestamp: string;
}

export interface VoyagerOfflineTraceEvent {
    role: VoyagerTraceEvent["role"];
    content: string;
    toolName?: string;
    toolCallId?: string;
    timestamp?: string;
}

export type VoyagerOfflineFixtureStatus = VoyagerRunStatus | "failed";

export interface VoyagerOfflineFixtureResult {
    status: VoyagerOfflineFixtureStatus;
    final_answer: string;
    iterations: number;
    elapsed_ms: number;
    available_tool_count: number;
    trace_sequence: string[];
    trace: VoyagerOfflineTraceEvent[];
    error?: string;
}

export interface VoyagerAssertionSummary {
    allPassed: boolean;
    expectedToolsPassed?: boolean;
    finalContainsPassed?: boolean;
    statusPassed?: boolean;
    missingExpectedTools: string[];
    missingFinalContains: string[];
}

export interface VoyagerRunResult {
    label: string;
    status: VoyagerRunStatus;
    finalAnswer: string;
    iterations: number;
    elapsedMs: number;
    availableToolCount: number;
    toolCallCount: number;
    traceSequence: string[];
    trace: VoyagerTraceEvent[];
    assertions: VoyagerAssertionSummary;
    error?: string;
}

export interface VoyagerCompareResult {
    scenario: {
        query: string;
        name?: string;
        expectedTools?: string[];
    };
    with_skills: VoyagerRunResult;
    without_skills: VoyagerRunResult;
    delta: {
        status_changed: boolean;
        status_summary: string;
        assertion_improved: boolean;
        iteration_delta: number;
        elapsed_ms_delta: number;
        tool_count_delta: number;
        skills_used_delta: number;
    };
}

export interface VoyagerBenchmarkScenarioDefinition {
    id: string;
    name?: string;
    query: string;
    tags?: string[];
    fixtures: {
        with_skills: VoyagerOfflineFixtureResult;
        without_skills: VoyagerOfflineFixtureResult;
    };
    assertions?: {
        with_skills?: VoyagerBranchAssertions;
        without_skills?: VoyagerBranchAssertions;
        delta?: VoyagerDeltaAssertions;
    };
}

export interface VoyagerBenchmarkPackDefinition {
    kind: "harbor.voyager.benchmark-pack";
    version: 1;
    pack: {
        id: string;
        name?: string;
        description?: string;
        tags?: string[];
    };
    scenarios: VoyagerBenchmarkScenarioDefinition[];
}

export interface VoyagerBenchmarkScenarioSummary {
    id: string;
    name?: string;
    path?: string;
    status: "passed" | "failed";
    with_skills: {
        status: "completed" | "failed";
        assertions_passed: boolean;
        tool_call_count: number;
    };
    without_skills: {
        status: "completed" | "failed";
        assertions_passed: boolean;
        tool_call_count: number;
    };
    delta: VoyagerCompareResult["delta"] & {
        expectations_passed: boolean;
    };
    failures: string[];
}

export interface VoyagerBenchmarkPackSummary {
    kind: "harbor.voyager.benchmark-pack.result";
    version: 1;
    pack: {
        id: string;
        name?: string;
        source: string;
        mode: "offline-fixture";
        generated_at: string;
    };
    totals: {
        scenarios_total: number;
        scenarios_passed: number;
        scenarios_failed: number;
        conditions_total: number;
        conditions_passed: number;
        conditions_failed: number;
        delta_improved: number;
        delta_neutral: number;
        delta_regressed: number;
    };
    pass: boolean;
    scenarios: VoyagerBenchmarkScenarioSummary[];
}
