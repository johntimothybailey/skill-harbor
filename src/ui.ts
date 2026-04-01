import boxen, { Options as BoxenOptions } from 'boxen';
import kleur from 'kleur';
import prompts from 'prompts';
import { AgentBerth } from './utils';

const baseOptions: BoxenOptions = {
    padding: 1,
    margin: { top: 1, bottom: 1, left: 0, right: 0 },
    borderStyle: 'round',
};

export const printHeader = (title: string, subtitle?: string) => {
    let content = kleur.bold().blue(`⚓  ${title}`);
    if (subtitle) {
        content += `\n\n${kleur.gray(subtitle)}`;
    }
    console.log(boxen(content, { ...baseOptions, borderColor: 'blue' }));
};

export const printSuccess = (message: string) => {
    console.log(boxen(kleur.bold().green(`🎉  ${message}`), { ...baseOptions, borderColor: 'green' }));
};

export const printError = (message: string) => {
    console.log(boxen(kleur.bold().red(`🛳️  SkillHarbor Alert:\n\n${message}`), { ...baseOptions, borderColor: 'red' }));
};

export const printInfo = (title: string, message: string) => {
    console.log(boxen(`${kleur.bold().yellow(`💡  ${title}`)}\n\n${message}`, { ...baseOptions, borderColor: 'yellow' }));
};

export const printLighthouseSnippet = (snippet: string) => {
    console.log(boxen(snippet, {
        padding: { top: 1, bottom: 1, left: 2, right: 2 },
        margin: { top: 1, bottom: 1, left: 0, right: 0 },
        borderStyle: 'double',
        borderColor: 'cyan',
        title: kleur.bold().cyan(' Fleet Intelligence Snippet '),
        titleAlignment: 'center'
    }));
};

export const printHarborHealthReport = (report: any, format: string = 'pretty') => {
    const { totalSkills, totalTokens, totalCost, averageHeuristicConfidence, composition, shipDistribution, contextBloat, status } = report;
    
    if (format === 'json') {
        console.log(JSON.stringify(report, null, 2));
        return;
    }

    let content = `${kleur.bold().blue('⚓  Harbor Health Report: Fleet Intelligence Status')}\n`;
    content += `${kleur.gray('─────────────────────────────────────────────────')}\n\n`;
    
    content += `${kleur.cyan('Fleet Size:')}    ${totalSkills} Skills (${composition.agentic} Agentic, ${composition.tools} Tools)\n`;
    content += `${kleur.cyan('Total Volume:')}  ${kleur.bold(totalTokens.toLocaleString())} Tokens\n`;
    content += `${kleur.cyan('Daily Maintenance:')} GPT-4o: $${totalCost.gpt4o.toFixed(4)} | Mini: $${totalCost.gpt4oMini.toFixed(4)}\n\n`;
    
    let draftEmoji = "🔴";
    if (averageHeuristicConfidence > 3) draftEmoji = "🟠";
    if (averageHeuristicConfidence > 5) draftEmoji = "🟡";
    if (averageHeuristicConfidence > 6) draftEmoji = "🟢";
    if (averageHeuristicConfidence > 8) draftEmoji = "✨";
    
    content += `${kleur.cyan('Avg Confidence (Heuristic):')} ${draftEmoji} ${averageHeuristicConfidence.toFixed(1)}/10\n`;

    if (report.averageSonarConfidence !== undefined) {
        const sonar = report.averageSonarConfidence;
        const color = sonar > 80 ? kleur.green : sonar > 50 ? kleur.yellow : kleur.red;
        const barLength = 10;
        const filled = Math.round((sonar / 100) * barLength);
        const bar = color("█".repeat(filled)) + kleur.gray("░".repeat(barLength - filled));
        content += `${kleur.cyan('Avg Confidence (Sonar):')}     [${bar}] ${color(sonar.toFixed(1) + "%")}\n`;
    }
    content += `\n`;

    content += `${kleur.bold().yellow('📦 Ship Class Distribution')}\n`;
    content += `🛶 Dinghies: ${shipDistribution.Dinghy} | ⛵ Schooners: ${shipDistribution.Schooner} | 🚤 Brigantines: ${shipDistribution.Brigantine}\n`;
    content += `🛳️  Frigates: ${shipDistribution.Frigate} | 🚢 Galleons: ${shipDistribution.Galleon}\n\n`;

    if (report.fleetStatus) {
        content += `${kleur.bold().yellow('📊 Fleet Status Distribution')}\n`;
        content += `⚓ Berthed: ${report.fleetStatus.berthed} | 📦 Stowed: ${report.fleetStatus.stowed} | 🚜 Dry Dock: ${report.fleetStatus.dryDock}\n\n`;
    }

    content += `${kleur.bold().magenta('🧠 Context Window Saturation (Cumulative Bloat)')}\n`;
    for (const model of contextBloat) {
        const percent = model.percentage.toFixed(1);
        const barLength = 20;
        const filledLength = Math.min(barLength, Math.round((model.percentage / 100) * barLength));
        const bar = kleur.green('█'.repeat(filledLength)) + kleur.gray('░'.repeat(barLength - filledLength));
        
        let labelColor = kleur.white;
        if (model.percentage > 50) labelColor = kleur.yellow;
        if (model.percentage > 80) labelColor = kleur.red;
        
        content += `${model.model.padEnd(18)} [${bar}] ${labelColor(percent + '%')}\n`;
    }

    if (!status.isHealthy) {
        content += `\n${kleur.bold().red('🚫 CI/CD GATE VIOLATIONS:')}\n`;
        for (const violation of status.violations) {
            content += `${kleur.red(`   - ${violation}`)}\n`;
        }
    }

    console.log(boxen(content, {
        padding: 1,
        margin: { top: 1, bottom: 1, left: 0, right: 0 },
        borderStyle: 'double',
        borderColor: status.isHealthy ? 'blue' : 'red',
        title: kleur.bold()[status.isHealthy ? 'blue' : 'red'](' HARBOR HEALTH REPORT '),
        titleAlignment: 'center'
    }));
};

export const promptSelectTargets = async (availableTargets: AgentBerth[]): Promise<string[] | null> => {
    console.log(boxen(`${kleur.bold().yellow('🛳️  Skill Harbor: No targets detected.')}\n\n${kleur.gray('Your manifest does not define any targets, and no active agent berths\nwere auto-detected in this workspace.')}`, {
        padding: 1,
        margin: { top: 1, bottom: 0, left: 0, right: 0 },
        borderStyle: 'round',
        borderColor: 'yellow'
    }));

    const response = await prompts([
        {
            type: 'multiselect',
            name: 'targets',
            message: kleur.bold().cyan('Select targets to berth skills into:'),
            choices: [
                { title: kleur.bold().green('All Targets'), value: 'all' },
                ...availableTargets.map(t => ({ title: t.label, value: t.key })),
                { title: kleur.gray('Cancel Sync'), value: 'cancel' }
            ],
            hint: kleur.gray('- Space to select, Enter to confirm'),
            instructions: false
        }
    ]);

    if (!response.targets || response.targets.includes('cancel')) {
        console.log(kleur.gray('\nSync cancelled by user.\n'));
        return null;
    }

    if (response.targets.includes('all')) {
        return availableTargets.map(t => t.key);
    }

    console.log(boxen(`${kleur.gray('Missing a target? Request one at:')}\n${kleur.blue().underline('https://github.com/johntimothybailey/skill-harbor/issues')}`, {
        padding: { top: 0, bottom: 0, left: 1, right: 1 },
        margin: { top: 0, bottom: 1, left: 0, right: 0 },
        borderStyle: 'none'
    }));

    return response.targets;
};
