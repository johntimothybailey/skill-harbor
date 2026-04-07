import os from "node:os";
import path from "node:path";
import Spinnies from "spinnies";
import { Orchestrator } from "../orchestrator";
import { getManagedAgentTargets } from "../utils";
import { printHeader, printSuccess, printError } from "../ui";

export async function stowAction(options: any, command: any) {
    const opts = command.opts();
    const baseDir = opts.global ? os.homedir() : process.cwd();
    const stowageBase = path.join(baseDir, opts.global ? ".harbor" : ".harbor", "stowage");
    const spinnies = new Spinnies();
    const orchestrator = new Orchestrator({ skillName: "Stow", spinnies });

    try {
        printHeader("Stowing Agent Context");
        const targets = getManagedAgentTargets(baseDir, opts.global === true);

        for (const target of targets) {
            const stowPath = path.join(stowageBase, target.label.toLowerCase());
            await orchestrator.stowTarget(target.path, stowPath, target.label);
        }

        orchestrator.finalize("All agent context has been stowed safely.");
        printSuccess(`Stow complete. Run 'unstow' to restore your environment later.`);
    } catch (error: any) {
        printError(`Stowage failed: ${error.message}`);
        process.exit(1);
    }
}
