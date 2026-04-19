import os from "node:os";
import kleur from "kleur";
import prompts from "prompts";
import { resolveCommandScope } from "../command-scope";
import { formatBerthDetail, getManifestManager } from "../utils";
import { printError, printHeader, printInfo, printSuccess } from "../ui";
import {
    discoverGhosts,
    markGhostsFriendly,
    GhostRecord,
    readGhostMetadata,
    resolveGhostScanContext,
    resolveGhostScanMode,
    summarizeGhosts
} from "../services/ghosts";

function formatGhostContext(ghost: GhostRecord): string {
    return `(${ghost.location}: ${formatBerthDetail({
        label: ghost.berthLabel,
        location: ghost.berthLocation
    })})`;
}

function formatGhostName(ghost: GhostRecord): string {
    return ghost.friendly
        ? kleur.bold().green(ghost.name)
        : kleur.bold().white(ghost.name);
}

function formatMetadataValue(key: string, value: unknown): string {
    const formattedValue = typeof value === "string" ? value : JSON.stringify(value);
    return key === "description" ? kleur.gray(formattedValue) : kleur.white(formattedValue);
}

async function printGhostDetails(ghost: GhostRecord): Promise<void> {
    console.log(`    ${kleur.bold().cyan("path:")} ${kleur.white(ghost.path)}`);
    const metadata = await readGhostMetadata(ghost.path);
    const entries = Object.entries(metadata);

    if (entries.length === 0) {
        console.log(`    ${kleur.bold().cyan("metadata:")} ${kleur.gray("none")}`);
        return;
    }

    console.log(`    ${kleur.bold().cyan("metadata:")}`);
    for (const [key, value] of entries) {
        console.log(`      ${kleur.bold().cyan(`${key}:`)} ${formatMetadataValue(key, value)}`);
    }
}

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
        const scanMode = resolveGhostScanMode(opts.scanMode);
        const scanContext = await resolveGhostScanContext({
            baseDir,
            targets: manifest.targets,
            scanMode
        });
        const ghosts = await discoverGhosts({
            baseDir,
            manifestManager,
            manifest,
            scanContext
        });
        const { active, friendly } = summarizeGhosts(ghosts);

        if (active.length === 0 && friendly.length === 0) {
            printInfo("No Ghosts Found", "No unmanaged skills were discovered in active berths or stowage.");
            return;
        }

        if (active.length > 0) {
            console.log(kleur.magenta(`\n👻 Active Ghosts (${active.length})`));
            for (const ghost of active) {
                console.log(`  ${kleur.red("•")} ${formatGhostName(ghost)} ${kleur.yellow(formatGhostContext(ghost))}`);
                if (opts.details) {
                    await printGhostDetails(ghost);
                    console.log("");
                }
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
                console.log(`  ${kleur.green("✓")} ${formatGhostName(ghost)} ${kleur.yellow(formatGhostContext(ghost))}`);
                if (opts.details) {
                    await printGhostDetails(ghost);
                    console.log("");
                }
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
                    title: `${ghost.name} ${formatGhostContext(ghost)}`,
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
