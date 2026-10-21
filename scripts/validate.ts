#!/usr/bin/env node
// Validate built dataset + contributions/pending/*.json. Read-only; exits non-zero on any error.
import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateCityDir } from "../validators/validate.js";
import { validateContributionsDir } from "../validators/contributions.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");

function validateContributions(): string[] {
  let cityIds = new Set<string>();
  try {
    cityIds = new Set(Object.keys(JSON.parse(readFileSync(join(repoRoot, "sources.json"), "utf8"))));
  } catch {
    // validateContributionsDir reports unknown cities; keep going
  }
  return validateContributionsDir(repoRoot, "pending", cityIds);
}

function main(): void {
  const { values } = parseArgs({ options: { city: { type: "string" } } });
  const registered = Object.keys(JSON.parse(readFileSync(join(repoRoot, "sources.json"), "utf8")) as Record<string, unknown>).sort();
  const cities: string[] = values.city ? [values.city] : registered;
  if (cities.some(c => !registered.includes(c))) {
    console.error(`validate: unknown city ${values.city}`);
    process.exit(2);
  }
  let errors: string[] = [];
  for (const city of cities) {
    errors.push(...validateCityDir(join(repoRoot, "data", "cities", city), city));
  }
  errors.push(...validateContributions());
  if (errors.length > 0) {
    for (const e of errors) console.error(`validate error: ${e}`);
    console.error(`validate: ${errors.length} error(s)`);
    process.exit(1);
  }
  console.log(`validate: ok (${cities.join(",")})`);
}

main();
