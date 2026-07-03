// Regenerate the web ABI modules from the compiled contract artifacts.
// Run from conclave/web after compiling contracts: node scripts/sync-abi.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const CONTRACT_NAMES = ["ConfidentialBallot", "ConfidentialGovToken"];
const artifactsRoot = resolve(process.cwd(), "..", "contracts", "artifacts", "contracts");
const outputDir = resolve(process.cwd(), "src", "lib", "abi");

mkdirSync(outputDir, { recursive: true });

for (const contractName of CONTRACT_NAMES) {
  const artifactPath = resolve(artifactsRoot, `${contractName}.sol`, `${contractName}.json`);
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  const fileBody =
    `// Generated from contracts artifacts by scripts/sync-abi.mjs. Do not edit by hand.\n` +
    `export const ${contractName}Abi = ${JSON.stringify(artifact.abi, null, 2)} as const;\n`;
  writeFileSync(resolve(outputDir, `${contractName}.ts`), fileBody);
  console.log(`[sync-abi] wrote src/lib/abi/${contractName}.ts (${artifact.abi.length} ABI entries)`);
}
