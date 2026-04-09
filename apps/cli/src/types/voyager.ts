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

export type VoyagerRunStatus = "completed" | "assertion_failed" | "max_iterations" | "api_error";

export interface VoyagerTraceEvent {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    toolName?: string;
    toolCallId?: string;
    timestamp: string;
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
