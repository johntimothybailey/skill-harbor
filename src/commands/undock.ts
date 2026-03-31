import os from "node:os";
import Spinnies from "spinnies";
import { Orchestrator } from "../orchestrator";
import { exists, getManagedAgentTargets } from "../utils";
import { printHeader, printSuccess, printError } from "../ui";

export async function undockAction(options: any, command: any) {
    const opts = command.opts();
    const baseDir = opts.global ? os.homedir() : process.cwd();
    const spinnies = new Spinnies();
    const orchestrator = new Orchestrator({ 
        skillName: "Undock", 
        spinnies,
    });

    try {
        printHeader("Undocking Operations Initiated");
        const targets = getManagedAgentTargets(baseDir, opts.global === true);

        for (const target of targets) {
            if (await exists(target.path)) {
                await orchestrator.purgeTarget(target.path, target.label);
            }
        }

        orchestrator.finalize("All targeted agent berths have been cleared.");
        printSuccess(`Undock complete. ${opts.global ? "Global" : "Local"} workspace is clean.`);
    } catch (error: any) {
        printError(`Undock failed: ${error.message}`);
        process.exit(1);
    }
}
