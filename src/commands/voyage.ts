import fs from "node:fs/promises";
import path from "node:path";
import kleur from "kleur";
import Spinnies from "spinnies";
import yaml from "js-yaml";
import matter from "gray-matter";
import { getManifestManager, getAgentBerths } from "../utils";
import { ConfigManager } from "../services/config";
import { ProfilerService } from "../services/profiler";
import { VoyageTestDefinition } from "../types/voyage";
import { printHeader, printError, printInfo, printSuccess } from "../ui";
import { ask } from "../utils";
import os from "node:os";

export async function voyageAction(queryArg: string | undefined, options: any, command: any) {
    const opts = command.opts();
    const spinnies = new Spinnies();
    
    let testDef: VoyageTestDefinition = { query: queryArg || "" };

    try {
        printHeader("Voyage: Fleet Integration Testing");

        if (opts.file) {
            const filePath = path.resolve(process.cwd(), opts.file);
            try {
                const fileContent = await fs.readFile(filePath, "utf-8");
                testDef = yaml.load(fileContent) as VoyageTestDefinition;
            } catch (err: any) {
                printError(`Failed to read test definition from ${opts.file}: ${err.message}`);
                process.exit(1);
            }
        } else if (!testDef.query) {
            printError("You must provide either a inline [query] or a -f/--file definition.");
            process.exit(1);
        }

        const configManager = ConfigManager.getInstance();
        const config = await configManager.loadConfig({
            model: opts.model,
            baseUrl: opts.baseUrl
        });

        if (!config.sonar.apiKey) {
            printError("Voyage simulation requires an API key in HARBOR_PROFILER_API_KEY, OPENAI_API_KEY, or profiler.yaml");
            process.exit(1);
        }

        spinnies.add("voyage-init", { text: "Discovering active berths and preparing fleet cargo..." });

        const manifestManager = getManifestManager({ global: false });
        let manifest: any;
        try {
            manifest = await manifestManager.readMerged();
        } catch {
            manifest = { targets: [] };
        }

        const profiler = new ProfilerService();
        const baseDir = process.cwd();
        const activeBerths = await getAgentBerths(baseDir, manifest.targets && manifest.targets.length > 0 ? manifest.targets : undefined);

        if (activeBerths.length === 0) {
            spinnies.fail("voyage-init", { text: "No active agent berths found to voyage with." });
            process.exit(1);
        }

        // Gather tool definitions
        const tools: any[] = [];
        const loadedSkillNames = new Set<string>();

        for (const berth of activeBerths) {
            const skillPaths = await profiler.findSkills(berth.path);
            for (const spath of skillPaths) {
                const name = path.basename(spath);
                if (loadedSkillNames.has(name)) continue;

                try {
                    const skillFile = path.join(spath, "SKILL.md");
                    const rawContent = await fs.readFile(skillFile, "utf-8");
                    const { data } = matter(rawContent);

                    if (data.name && data.description) {
                        tools.push({
                            type: "function",
                            function: {
                                name: data.name.replace(/[^a-zA-Z0-9_-]/g, ""), // Sanitize for OpenAI strict rules
                                description: data.description,
                                parameters: {
                                    type: "object",
                                    properties: {},
                                    required: []
                                }
                            }
                        });
                        loadedSkillNames.add(name);
                    }
                } catch {
                    // Skip unreadable
                }
            }
        }

        if (tools.length === 0) {
            spinnies.fail("voyage-init", { text: "No properly formatted skills found in active berths." });
            
            // Ghost Discovery Assistance
            const ghosts = await profiler.findSkills(process.cwd());
            const localGhosts = ghosts.filter(p => !p.includes(".harbor/skills"));

            if (localGhosts.length > 0) {
                console.log(kleur.magenta(`\n👻  Ghost Alert: I found ${localGhosts.length} local skill(s) that aren't manifested.`));
                if (await ask("Would you like to dock these to your local manifest now?", kleur)) {
                    for (const ghostPath of localGhosts) {
                        const name = path.basename(ghostPath);
                        await manifestManager.addSkill({
                            name,
                            source: ghostPath,
                            localPath: ""
                        }, "local");
                        console.log(kleur.green(`   ✓ Docked: ${name} (Local)`));
                    }
                    printSuccess("All ghosts berthed. Run 'voyage' again to deploy them.");
                }
            }
            process.exit(1);
        }

        spinnies.succeed("voyage-init", { text: `Fleet ready. Discovered ${tools.length} actionable skills.` });
        
        console.log(`\n${kleur.blue("▶")} ${kleur.bold("Query:")} ${kleur.gray(testDef.query)}\n`);

        const messages: any[] = [
            { 
                role: "system", 
                content: "You are an autonomous orchestrator agent traversing the Skill Harbor. Your goal is to satisfy the user's request by calling the appropriate sequence of skills (tools). When you have completed the request, return your final answer summarizing what was done." 
            },
            { 
                role: "user", 
                content: testDef.query 
            }
        ];

        let iteration = 0;
        const maxIterations = 10;
        const traceSequence: string[] = [];

        spinnies.add("voyage-loop", { text: "Agent thinking..." });

        while (iteration < maxIterations) {
            iteration++;
            
            const response = await fetch(`${config.sonar.baseUrl}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${config.sonar.apiKey}`
                },
                body: JSON.stringify({
                    model: config.sonar.model,
                    messages: messages,
                    tools: tools,
                    tool_choice: "auto"
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                spinnies.fail("voyage-loop");
                printError(`LLM API Error (${response.status}): ${errText}`);
                process.exit(1);
            }

            const data: any = await response.json();
            const choice = data.choices[0];
            const message = choice.message;

            messages.push(message);

            if (message.tool_calls && message.tool_calls.length > 0) {
                // Agent invoked tools
                spinnies.update("voyage-loop", { text: "Agent orchestrating..." });
                
                for (const toolCall of message.tool_calls) {
                    const toolName = toolCall.function.name;
                    traceSequence.push(toolName);
                    
                    spinnies.succeed("voyage-loop", { text: `${kleur.cyan("⚓ Agent deployed skill:")} ${kleur.bold(toolName)}` });
                    
                    // Simulate execution
                    const mockResponse = testDef.mocks?.[toolName] || "Simulated success. Context payload acknowledged.";
                    
                    messages.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        name: toolName,
                        content: mockResponse
                    });

                    console.log(`  ${kleur.gray("↳ Mocked Response:")} ${kleur.dim(mockResponse)}`);
                }
                
                spinnies.add("voyage-loop", { text: "Agent evaluating results..." });
            } else {
                // Final answer provided
                spinnies.succeed("voyage-loop", { text: `${kleur.green("Voyage Complete!")}` });
                console.log(`\n${kleur.magenta("■ Final Output:")}\n${kleur.white(message.content)}`);
                break;
            }
        }

        if (iteration >= maxIterations) {
            printError(`Voyage automatically terminated after ${maxIterations} loops to prevent infinite drifting.`);
        }

        // Assertions
        if (testDef.expected_tools && testDef.expected_tools.length > 0) {
            console.log(`\n${kleur.bold("Assertions Validation:")}`);
            let allPassed = true;
            
            // Expected sequence matching logic (exact order preservation check)
            let traceIdx = 0;
            for (const expected of testDef.expected_tools) {
                const foundIdx = traceSequence.indexOf(expected, traceIdx);
                if (foundIdx === -1) {
                    allPassed = false;
                    console.log(`  ${kleur.red("✗")} Expected skill ${kleur.bold(expected)} was not invoked in the correct sequence.`);
                } else {
                    console.log(`  ${kleur.green("✓")} Expected skill ${kleur.bold(expected)} was successfully deployed.`);
                    traceIdx = foundIdx + 1;
                }
            }

            if (!allPassed) {
                console.log(`\n${kleur.bgRed().white(" ASSERTION FAILED ")} The voyage did not match the expected course.`);
                process.exit(1);
            } else {
                console.log(`\n${kleur.bgGreen().white(" ASSERTIONS PASSED ")} The agent navigated perfectly.`);
            }
        }

    } catch (error: any) {
        if (spinnies.hasActiveSpinners()) spinnies.fail("voyage-loop");
        printError(`Voyage critical failure: ${error.message}`);
        process.exit(1);
    }
}
