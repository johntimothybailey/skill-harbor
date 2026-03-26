import os from "node:os";
import path from "node:path";
import Spinnies from "spinnies";
import { Orchestrator } from "../orchestrator";
import { exists } from "../utils";
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
        
        const targets = [
            { path: path.join(baseDir, ".claude", "skills"), label: "Claude" },
            { path: path.join(baseDir, ".cursor", "rules"), label: "Cursor" },
            { path: path.join(baseDir, ".antigravity", "skills"), label: "Antigravity" }
        ];

        if (opts.global) {
            targets.push({ path: path.join(os.homedir(), ".rulesync", "skills"), label: "Rulesync" });
        }

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
