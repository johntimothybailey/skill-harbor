import { upAction } from "./up";

/**
 * Freshen Action
 * 
 * Provides a thematic way to "pull fresh cargo" by running the 'up' command
 * with the --force flag automatically enabled.
 */
export async function freshenAction(options: any, command: any) {
    // Inject the force flag into the options
    const freshenOptions = {
        ...options,
        force: true
    };

    // Forward to the 'up' action
    return upAction(freshenOptions, command);
}
