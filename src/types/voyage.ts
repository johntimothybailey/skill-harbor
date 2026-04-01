export interface VoyageTestDefinition {
    /** The instruction given to the agent */
    query: string;
    /** The sequence of skills the agent should use in order */
    expected_tools?: string[];
    /** Mocks for specific tool calls. Key is skill name, value is mock return string */
    mocks?: Record<string, string>;
}
