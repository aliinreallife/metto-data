#!/usr/bin/env node
// Validate contribution proposals (schema + city/entity/path allowlist).
// Covers pending/, approved/, and rejected/ queues. Read-only: must not
// mutate data/cities/* or overrides/*.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateContributionsDir } from "../validators/contributions.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");

function main(): void {
  let cityIds = new Set<string>();
  try {
    const sources = JSON.parse(readFileSync(join(repoRoot, "sources.json"), "utf8")) as Record<string, unknown>;
    cityIds = new Set(Object.keys(sources));
  } catch {
    // validateContributionsDir will report unknown cities; keep going
  }
  const errors = [
    ...validateContributionsDir(repoRoot, "pending", cityIds),
    ...validateContributionsDir(repoRoot, "approved", cityIds),
    ...validateContributionsDir(repoRoot, "rejected", cityIds),
  ];
  if (errors.length > 0) {
    for (const e of errors) console.error(`contributions-validate error: ${e}`);
    console.error(`contributions-validate: ${errors.length} error(s)`);
    process.exit(1);
  }
  console.log("contributions-validate: ok (pending, approved, rejected)");
}

main();
