import boxen, { Options as BoxenOptions } from 'boxen';
import kleur from 'kleur';

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
