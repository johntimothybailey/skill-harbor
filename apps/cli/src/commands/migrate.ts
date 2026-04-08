import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import kleur from "kleur";
import { printHeader, printSuccess, printInfo, printError } from "../ui";
import { exists } from "../utils";
import { ManifestManager } from "../manifest";

/**
 * Migration Engine for Skill Harbor.
 * Updates legacy project layouts to the consolidated .harbor/ standard.
 */
export async function migrateAction(options: any) {
    const cwd = process.cwd();
    const manifestManager = new ManifestManager({ cwd });
    await manifestManager.init();

    printHeader("Skill Harbor: Migration Engine", "Converting project to consolidated .harbor/ layout.");

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const ask = (query: string): Promise<boolean> => new Promise((resolve) => {
        rl.question(`${kleur.bold().yellow("🤔 " + query)} ${kleur.gray("(y/N)")} `, (answer) => {
            resolve(answer.toLowerCase() === 'y');
        });
    });

    try {
        let changesMade = false;

        // 1. Manifest Migration
        const legacyShared = path.join(cwd, "harbor-manifest.json");
        const preferredShared = path.join(cwd, ".harbor", "harbor-manifest.json");
        const legacyLocal = path.join(cwd, "harbor-manifest.local.json");
        const preferredLocal = path.join(cwd, ".harbor", "harbor-manifest.local.json");

        if (await exists(legacyShared)) {
            console.log(kleur.cyan(`📦  Found shared manifest at root: ${kleur.bold("harbor-manifest.json")}`));
            if (await ask("Move shared manifest to .harbor/?")) {
                await fs.rename(legacyShared, preferredShared);
                console.log(kleur.green("   ✓ Moved to .harbor/harbor-manifest.json"));
                changesMade = true;
            }
        }

        if (await exists(legacyLocal)) {
            console.log(kleur.cyan(`🔒  Found local manifest at root: ${kleur.bold("harbor-manifest.local.json")}`));
            if (await ask("Move local manifest to .harbor/?")) {
                await fs.rename(legacyLocal, preferredLocal);
                console.log(kleur.green("   ✓ Moved to .harbor/harbor-manifest.local.json"));
                changesMade = true;
            }
        }

        // 2. Skills Cache Migration
        const harborDir = path.join(cwd, ".harbor");
        const skillsDir = path.join(harborDir, "skills");
        
        // Find directories in .harbor that aren't 'skills', 'hooks', or 'stowage'
        const items = await fs.readdir(harborDir, { withFileTypes: true });
        const legacySkills = items.filter(dirent => 
            dirent.isDirectory() && 
            !["skills", "hooks", "stowage"].includes(dirent.name) &&
            !dirent.name.startsWith(".")
        );

        if (legacySkills.length > 0) {
            console.log(kleur.cyan(`🚀  Found ${legacySkills.length} cached skill(s) in .harbor/ root.`));
            if (await ask(`Move these to .harbor/skills/ for better organization?`)) {
                await fs.mkdir(skillsDir, { recursive: true });
                for (const skill of legacySkills) {
                    const oldPath = path.join(harborDir, skill.name);
                    const newPath = path.join(skillsDir, skill.name);
                    await fs.rename(oldPath, newPath);
                    console.log(kleur.gray(`   ✓ Repositioned: ${skill.name}`));
                }
                changesMade = true;
            }
        }

        // 3. Gitignore Migration
        const gitignorePath = path.join(cwd, ".gitignore");
        if (await exists(gitignorePath)) {
            const gitignore = await fs.readFile(gitignorePath, "utf-8");
            const lines = gitignore.split("\n");
            
            const legacyIgnoreIndex = lines.findIndex(l => l.trim() === ".harbor" || l.trim() === ".harbor/");
            
            if (legacyIgnoreIndex !== -1) {
                console.log(kleur.yellow("\n⚠️  Your .gitignore is currently ignoring the entire .harbor/ directory."));
                console.log(kleur.gray("    This will prevent you from committing your manifest and custom hooks."));
                
                if (await ask("Switch to granular ignores for .harbor/skills/ and .harbor/stowage/?")) {
                    const newIgnores = [
                        ".harbor/skills/",
                        ".harbor/stowage/",
                        "harbor-manifest.local.json",
                        "harbor-compass.yaml"
                    ];
                    
                    // Replace the legacy line
                    lines.splice(legacyIgnoreIndex, 1, ...newIgnores);
                    
                    // Filter duplicates and empty blocks
                    const uniqueLines = Array.from(new Set(lines));
                    await fs.writeFile(gitignorePath, uniqueLines.join("\n").replace(/\n{3,}/g, "\n\n"), "utf-8");
                    console.log(kleur.green("   ✓ .gitignore updated with granular rules."));
                    changesMade = true;
                }
            }
        }

        rl.close();

        if (changesMade) {
            printSuccess("Migration Complete! Your harbor is now fully modernized.");
            console.log(kleur.gray("Run 'skill-harbor up' to verify your fleet synchronization."));
        } else {
            printInfo("No Changes Needed", "Your project already adheres to the consolidated .harbor/ standard.");
        }

    } catch (err: any) {
        rl.close();
        printError(`Migration failed: ${err.message}`);
        process.exit(1);
    }
}
