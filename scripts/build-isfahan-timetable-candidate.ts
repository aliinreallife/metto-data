#!/usr/bin/env node
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { buildIsfahanTimetableCandidate } from "../importers/isfahan-timetable.js";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
try {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== "--input")) throw Error("Usage: candidate:isfahan:timetable [--input path/to/stop_times.csv]");
  const input = args[1] ? resolve(args[1]) : join(root, ".quality-report/isfahan-timetable-intake-2026-10-31/inputs/stop_times.csv");
  const result = buildIsfahanTimetableCandidate(root, input);
  const folder = join(root, ".quality-report"); mkdirSync(folder, { recursive: true });
  const output = join(folder, "isfahan-timetable-candidate.json");
  writeFileSync(output + ".tmp", JSON.stringify(result, null, 2) + "\n"); renameSync(output + ".tmp", output);
  console.log(JSON.stringify({ reviewOnly: true, productionEtaApproved: false, counts: result.counts, output }));
} catch (error) { console.error((error as Error).message); process.exitCode = 1; }
