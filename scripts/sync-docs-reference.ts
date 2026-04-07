import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

async function sync() {
    console.log("⚓ Syncing CLI Reference Docs...");

    const helpOutput = execSync("node apps/cli/dist/index.js --help", { encoding: "utf-8" });
    const targetFile = path.join(process.cwd(), "docs", "reference", "commands.mdx");

    if (!(await fs.stat(targetFile).catch(() => false))) {
        console.error("❌ Target file not found: " + targetFile);
        process.exit(1);
    }

    let content = await fs.readFile(targetFile, "utf-8");

    // Replace the 'Commands' table and raw help output section
    // For this implementation, we'll just append the raw help as a 'Raw Help Output' section
    // but the actual action should be more sophisticated if the MDX is structured.
    
    const rawHelpSection = `\n\n--- \n\n## 🛰️ Raw Help Output\n\n\`\`\`text\n${helpOutput}\n\`\`\``;
    
    // Check if section already exists and replace, else append
    const marker = "## 🛰️ Raw Help Output";
    if (content.includes(marker)) {
        const parts = content.split(marker);
        content = parts[0] + marker + rawHelpSection.split(marker)[1];
    } else {
        content += rawHelpSection;
    }

    await fs.writeFile(targetFile, content);
    console.log("✅ CLI Reference updated successfully!");
}

sync().catch(err => {
    console.error("❌ Sync failed:", err);
    process.exit(1);
});
