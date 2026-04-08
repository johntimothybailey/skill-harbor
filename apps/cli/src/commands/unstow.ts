import os from "node:os";
import path from "node:path";
import Spinnies from "spinnies";
import { Orchestrator } from "../orchestrator";
import { getManagedAgentTargets } from "../utils";
import { printHeader, printSuccess, printError } from "../ui";

export async function unstowAction(options: any, command: any) {
    const opts = command.opts();
    const baseDir = opts.global ? os.homedir() : process.cwd();
    const stowageBase = path.join(baseDir, opts.global ? ".harbor" : ".harbor", "stowage");
    const spinnies = new Spinnies();
    const orchestrator = new Orchestrator({ skillName: "Unstow", spinnies });

    try {
        printHeader("Restoring Agent Context (Unlock)");
        const targets = getManagedAgentTargets(baseDir, opts.global === true);

        for (const target of targets) {
            const stowPath = path.join(stowageBase, target.label.toLowerCase());
            await orchestrator.unstowTarget(stowPath, target.path, target.label);
        }

        orchestrator.finalize("All agent context has been restored.");
        printSuccess(`Unstow complete. Your harbor is fully unlocked.`);
    } catch (error: any) {
        printError(`Unstowage failed: ${error.message}`);
        process.exit(1);
    }
}
