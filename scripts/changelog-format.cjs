const { getInfo } = require("@changesets/get-github-info");

const defaultChangelogFunctions = {
  getReleaseLine: async (changeset, type, options) => {
    const [firstLine, ...futureLines] = changeset.summary
      .split("\n")
      .map((l) => l.trimEnd());

    // Extract Hero Title if present
    let heroTitle = "";
    const heroMatch = changeset.summary.match(/<!-- hero: (.*?) -->/);
    if (heroMatch) {
        heroTitle = heroMatch[1];
    }

    let returnVal = `\n\n`;
    
    // If we have a hero title, we'll format it as a sub-header
    if (heroTitle) {
        returnVal += `## ⚓ ${heroTitle}\n\n`;
    }

    // Clean up the summary by removing the hero comment
    const cleanSummary = changeset.summary.replace(/<!-- hero: (.*?) -->/, "").trim();
    
    returnVal += `${cleanSummary}\n`;

    return returnVal;
  },
  getDependencyReleaseLine: async (
    changesets,
    dependenciesUpdated,
    options
  ) => {
    if (dependenciesUpdated.length === 0) return "";

    const changesetLinks = changesets.map(
      (changeset) => `- Updated dependencies`
    );

    const updatedDependenciesList = dependenciesUpdated.map(
      (dependency) => `  - ${dependency.name}@${dependency.newVersion}`
    );

    return `\n\n- Updated dependencies\n${updatedDependenciesList.join("\n")}\n`;
  },
};

module.exports = defaultChangelogFunctions;
