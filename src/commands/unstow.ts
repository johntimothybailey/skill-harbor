import os from "node:os";
import path from "node:path";
import Spinnies from "spinnies";
import { Orchestrator } from "../orchestrator";
import { printHeader, printSuccess, printError } from "../ui";

export async function unstowAction(options: any, command: any) {
    const opts = command.opts();
    const baseDir = opts.global ? os.homedir() : process.cwd();
    const stowageBase = path.join(baseDir, opts.global ? ".harbor" : ".harbor", "stowage");
    const spinnies = new Spinnies();
    const orchestrator = new Orchestrator({ skillName: "Unstow", spinnies });

    try {
        printHeader("Restoring Agent Context (Unlock)");
        
        const targets = [
            { path: path.join(baseDir, ".claude", "skills"), label: "Claude" },
            { path: path.join(baseDir, ".cursor", "rules"), label: "Cursor" },
            { path: path.join(baseDir, ".antigravity", "skills"), label: "Antigravity" }
        ];

        if (opts.global) {
            targets.push({ path: path.join(os.homedir(), ".rulesync", "skills"), label: "Rulesync" });
        }

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
