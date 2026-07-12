import { access, readFile } from "node:fs/promises";
import path from "node:path";

const outputDir = path.resolve(".output/chrome-mv3");
const manifestPath = path.join(outputDir, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const iconPaths = new Set([
  ...Object.values(manifest.icons ?? {}),
  ...Object.values(manifest.action?.default_icon ?? {}),
]);

const missing = [];
for (const iconPath of iconPaths) {
  try {
    await access(path.join(outputDir, iconPath));
  } catch {
    missing.push(iconPath);
  }
}

if (missing.length > 0) {
  throw new Error(`Generated manifest references missing icons: ${missing.join(", ")}`);
}

console.log(`Validated ${iconPaths.size} manifest icons in ${outputDir}`);
