#!/usr/bin/env node
// Explicit offline research command. Never writes a published city dataset.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { buildIsfahanCandidate } from "../importers/isfahan-candidate.js";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
try {
  const report = buildIsfahanCandidate(root);
  const folder = join(root, ".quality-report");
  mkdirSync(folder, { recursive: true });
  const output = join(folder, "isfahan-candidate-graph.json");
  writeFileSync(output + ".tmp", JSON.stringify(report, null, 2) + "\n");
  renameSync(output + ".tmp", output);
  console.log(
    JSON.stringify({
      reviewOnly: true,
      output,
      counts: report.counts,
      readyForProduction: false,
    }),
  );
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
