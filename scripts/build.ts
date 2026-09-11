#!/usr/bin/env node
// Scaffold: run the city importer, then validators, then write data/cities/<city>/*.
// See importers/README.md and topology/README.md. Must fail closed: any validator
// error aborts before writing (never leave half-written output).
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { city: { type: "string", default: "tehran" } } });
console.log(`build: city=${values.city} — importer not yet ported (see importers/tehran.ts TODO)`);
process.exit(2);
