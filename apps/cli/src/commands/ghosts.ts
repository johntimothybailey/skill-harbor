import os from "node:os";
import kleur from "kleur";
import prompts from "prompts";
import { resolveCommandScope } from "../command-scope";
import { getManifestManager } from "../utils";
import { printError, printHeader, printInfo, printSuccess } from "../ui";
import { discoverGhosts, markGhostsFriendly, summarizeGhosts } from "../services/ghosts";

export async function ghostsAction(options: any, command: any) {
    const opts = command.opts();
    const manifestManager = getManifestManager(opts);

    try {
        printHeader("Ghosts: Fleet Drift Inspection");

        const { useGlobalScope, shouldStop } = await resolveCommandScope(opts, manifestManager, "skill-harbor ghosts");
        if (shouldStop) return;

        const manifest = useGlobalScope
            ? await manifestManager.read("global")
            : await manifestManager.readMerged();

        const baseDir = useGlobalScope ? os.homedir() : process.cwd();
        const ghosts = await discoverGhosts({
            baseDir,
            manifestManager,
            manifest
        });
        const { active, friendly } = summarizeGhosts(ghosts);

        if (active.length === 0 && friendly.length === 0) {
            printInfo("No Ghosts Found", "No unmanaged skills were discovered in active berths or stowage.");
            return;
        }

        if (active.length > 0) {
            console.log(kleur.magenta(`\n👻 Active Ghosts (${active.length})`));
            for (const ghost of active) {
                console.log(`  ${kleur.red("•")} ${kleur.bold(ghost.name)} ${kleur.gray(`(${ghost.location}: ${ghost.berthLabel})`)}`);
            }
        } else {
            console.log(kleur.green(`\n✅ No active ghosts found.`));
        }

        if (friendly.length > 0) {
            console.log(kleur.yellow(`\n💡 ${friendly.length} friendly ghost${friendly.length === 1 ? "" : "s"} hidden. Re-run with --friendly to show details.`));
        }

        if (opts.friendly && friendly.length > 0) {
            console.log(kleur.cyan(`\n✅ Friendly Ghosts (${friendly.length})`));
            for (const ghost of friendly) {
                console.log(`  ${kleur.green("✓")} ${kleur.bold(ghost.name)} ${kleur.gray(`(${ghost.location}: ${ghost.berthLabel})`)}`);
            }
        }

        if (active.length === 0 || !process.stdin.isTTY || !process.stdout.isTTY) {
            return;
        }

        const response = await prompts([
            {
                type: "select",
                name: "action",
                message: kleur.bold().cyan("How would you like to handle these active ghosts?"),
                choices: [
                    { title: "Mark some as friendly", value: "friendly" },
                    { title: "Leave them alone", value: "skip" }
                ],
                initial: 1
            }
        ]);

        if (response.action !== "friendly") {
            return;
        }

        const ghostSelection = await prompts([
            {
                type: "multiselect",
                name: "selected",
                message: kleur.bold().cyan("Select ghosts to mark as friendly:"),
                choices: active.map(ghost => ({
                    title: `${ghost.name} (${ghost.location}: ${ghost.berthLabel})`,
                    value: ghost.path
                })),
                instructions: false,
                hint: kleur.gray("- Space to select, Enter to confirm")
            }
        ]);

        const selectedPaths = ghostSelection.selected || [];
        if (selectedPaths.length === 0) {
            return;
        }

        const selectedGhosts = active.filter(ghost => selectedPaths.includes(ghost.path));
        await markGhostsFriendly(baseDir, selectedGhosts);
        printSuccess(`Marked ${selectedGhosts.length} ghost${selectedGhosts.length === 1 ? "" : "s"} as friendly.`);
    } catch (error: any) {
        printError(`Ghost inspection failed: ${error.message}`);
        process.exit(1);
    }
}
