import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import kleur from 'kleur';
import ora from 'ora';
import dotenv from 'dotenv';
import boxen from 'boxen';

// Load .env and .env.local
dotenv.config();
dotenv.config({ path: path.join(process.cwd(), '.env.local'), override: true });

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MODEL = "llama-3.3-70b-versatile";

async function getDiff() {
    try {
        // Find the base branch (defaulting to main)
        const baseBranch = 'main';
        // Use 'git diff baseBranch' to include committed + staged + unstaged changes
        return execSync(`git diff ${baseBranch}`, { encoding: 'utf-8' });
    } catch (error) {
        console.error(kleur.red('The Quartermaster is lost! Failed to get git diff.'));
        process.exit(1);
    }
}

async function suggestNotes(diff: string) {
    if (!GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY environment variable is not set.');
    }

    const spinner = ora('The Quartermaster is auditing the ship...').start();

    const prompt = `
Act as a Nautical Quartermaster for the "Skill Harbor" project. 
The Quartermaster is responsible for the ship's manifest, supplies (skills), and keeping the logbook ship-shape.

Analyze the following git diff and:
1. Recommend a SemVer bump: 'minor' if there are new features or significant changes, 'patch' if it's only fixes or chores.
2. Generate a "Hero Title" - a catchy, short title for the release (e.g., "The Ghost in the Shell Fix", "Portability and Scryer").
3. Write beautiful, fun, nautical-themed release notes. Use emojis and sections like:
   - ## ✨ Key Features
   - ## 🛡️ CI/CD Enhancements
   - ## 🛠️ Technical Fixes
   - (Add a "New Skill" section if the diff shows a new skill was added)

Keep the tone professional yet adventurous and pun-filled.

OUTPUT FORMAT:
Return ONLY a JSON object with the following structure:
{
  "bump": "minor" | "patch",
  "heroTitle": "Catchy Title",
  "notes": "Full markdown release notes here"
}

DIFF:
${diff.substring(0, 15000)} // Capping for token limits
`;

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                response_format: { type: "json_object" }
            })
        });

        const data = await response.json() as any;
        spinner.stop();
        
        if (data.error) throw new Error(data.error.message);
        if (!data.choices?.[0]?.message?.content) throw new Error('No content in Groq response');

        return JSON.parse(data.choices[0].message.content);
    } catch (error: any) {
        spinner.fail('The Lighthouse failed to shine.');
        throw error;
    }
}

async function run() {
    console.log(kleur.bold().blue('\n⚓ Welcome to the Quartermaster\'s Manifest Tool\n'));

    if (!GROQ_API_KEY) {
        console.log(kleur.yellow('⚠️  The Quartermaster cannot work without fuel! GROQ_API_KEY is missing.'));
        process.exit(1);
    }

    const diff = await getDiff();
    if (!diff.trim()) {
        console.log(kleur.yellow('The manifest is clear. No changes detected since main!'));
        process.exit(0);
    }

    let suggestion = await suggestNotes(diff);
    let confirmed = false;
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    while (!confirmed) {
        console.log(kleur.cyan('\n--- Suggestion from the Quartermaster ---'));
        console.log(`${kleur.bold('Recommended Bump:')} ${suggestion.bump}`);
        console.log(`${kleur.bold('Hero Title:')} ⚓ ${suggestion.heroTitle}`);
        console.log(kleur.gray('\nProposed Notes:'));
        console.log(boxen(suggestion.notes, { padding: 1, borderColor: 'cyan' }));

        const action = await rl.question('\n[c]onfirm, [r]egenerate, [e]dit, or [q]uit? ');

        if (action === 'c') {
            confirmed = true;
        } else if (action === 'r') {
            suggestion = await suggestNotes(diff);
        } else if (action === 'e') {
            const newBump = await rl.question(`Bump [${suggestion.bump}]: `);
            if (newBump) suggestion.bump = newBump;
            const newTitle = await rl.question(`Hero Title [${suggestion.heroTitle}]: `);
            if (newTitle) suggestion.heroTitle = newTitle;
            console.log(kleur.yellow('Editing notes in pure text is hard here. Run with "r" to regenerate or "c" and edit the file manually.'));
            const proceed = await rl.question('Proceed to confirm? (y/n) ');
            if (proceed === 'y') confirmed = true;
        } else {
            console.log('The Quartermaster is heading below deck. Aborting.');
            process.exit(0);
        }
    }

    // Create the changeset file
    const changesetName = `quartermaster-${Date.now().toString(36)}`;
    const changesetPath = path.join(process.cwd(), '.changeset', `${changesetName}.md`);
    
    const content = `---
"skill-harbor": ${suggestion.bump}
---

<!-- hero: ${suggestion.heroTitle} -->

${suggestion.notes}
`;

    await fs.writeFile(changesetPath, content);
    console.log(kleur.green(`\n✅ Skill manifested! Added changeset: .changeset/${changesetName}.md`));
    console.log(kleur.blue(`\nRun ${kleur.bold('bun changeset version')} when ready to merge into main.`));
    
    rl.close();
}

// Minimal boxen implementation was removed as we use the real one now
run().catch(err => {
    console.error(kleur.red(`\nIncident at sea: ${err.message}`));
    process.exit(1);
});
