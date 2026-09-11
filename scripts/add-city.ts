#!/usr/bin/env node
// Scaffold: pnpm tsx scripts/add-city.ts --city mashhad --mode metro
// Creates data/cities/<city>/, overrides/<city>.overrides.json, importers/<city>.ts stub,
// topology placeholders, and reminds to register sources.json + pinned submodule.
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { city: { type: "string" }, mode: { type: "string", default: "metro" } } });
if (!values.city) {
  console.error("usage: pnpm tsx scripts/add-city.ts --city <id> [--mode metro]");
  process.exit(1);
}
console.log(`add-city: city=${values.city} mode=${values.mode} — not yet implemented (see README "Adding a new city")`);
process.exit(2);
