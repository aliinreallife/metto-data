#!/usr/bin/env node
// Build milestone: pnpm build [--city tehran] → importers/<city> → validators → data/cities/<city>/*.
// Fail closed: any validator error aborts BEFORE writing (never leave half-written output).
import { parseArgs } from "node:util";
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildTehran } from "../importers/tehran.js";
import { validateDataset } from "../validators/validate.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");

function upstreamCommit(): string {
  try {
    const out = execSync("git rev-parse HEAD:upstream-tehran-metro", {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (/^[0-9a-f]{40}$/.test(out)) return out;
  } catch {
    // fall through to sources.json
  }
  const sources = JSON.parse(readFileSync(join(repoRoot, "sources.json"), "utf8")) as Record<
    string,
    { pinnedCommit?: string }
  >;
  return sources.tehran?.pinnedCommit ?? "unknown";
}

function contributorIds(): string[] {
  const ids = new Set<string>();
  try {
    for (const file of readdirSync(join(repoRoot, "contributions", "approved"))) {
      if (!file.endsWith(".json")) continue;
      const doc = JSON.parse(readFileSync(join(repoRoot, "contributions", "approved", file), "utf8")) as {
        submittedBy?: string;
        status?: string;
      };
      if (doc.status === "approved" && typeof doc.submittedBy === "string" && doc.submittedBy.length > 0) {
        ids.add(doc.submittedBy);
      }
    }
  } catch {
    // no approved dir yet → empty
  }
  return [...ids].sort();
}

function writeAtomic(path: string, data: string): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, data, "utf8");
  renameSync(tmp, path);
}

function main(): void {
  const { values } = parseArgs({ options: { city: { type: "string", default: "tehran" } } });
  const city = values.city ?? "tehran";
  if (city !== "tehran") {
    console.error(`build: unknown city ${JSON.stringify(city)} (only --city tehran is supported in milestone 1)`);
    process.exit(2);
  }

  const result = buildTehran(repoRoot);
  for (const w of result.warnings) console.error(`build warning: ${w}`);

  const errors = validateDataset({
    city: result.city,
    agencies: result.agencies,
    networks: result.networks,
    stations: result.stations,
    lines: result.lines,
    graph: result.graph,
  });
  if (errors.length > 0) {
    for (const e of errors) console.error(`build error: ${e}`);
    console.error(`build: ${errors.length} validation error(s) — refusing to write data/cities/${city}/*`);
    process.exit(1);
  }

  const sources = JSON.parse(readFileSync(join(repoRoot, "sources.json"), "utf8")) as Record<
    string,
    { repository?: string; upstreamFile?: string; path?: string; datasetVersion?: string }
  >;
  const meta = {
    cityId: city,
    datasetVersion: sources.tehran?.datasetVersion ?? "0.0.0",
    generatedAt: new Date().toISOString(),
    importer: "importers/tehran.ts",
    upstream: {
      repository: sources.tehran?.repository ?? "",
      commit: upstreamCommit(),
      file: `${sources.tehran?.path ?? "upstream-tehran-metro"}/${sources.tehran?.upstreamFile ?? "data/stations.json"}`,
    },
    counts: {
      stations: result.stations.length,
      lines: result.lines.length,
      routes: result.graph.routes.length,
      segments: result.graph.segments.length,
      transfers: result.graph.transfers.length,
      cities: 1,
      agencies: result.agencies.length,
      networks: result.networks.length,
    },
    contributorIds: contributorIds(),
  };

  // All validation passed — now write (atomic per file, no half-JSON).
  const outDir = join(repoRoot, "data", "cities", city);
  mkdirSync(outDir, { recursive: true });
  writeAtomic(join(outDir, "city.json"), JSON.stringify(result.city, null, 2) + "\n");
  writeAtomic(join(outDir, "agencies.json"), JSON.stringify(result.agencies, null, 2) + "\n");
  writeAtomic(join(outDir, "networks.json"), JSON.stringify(result.networks, null, 2) + "\n");
  writeAtomic(join(outDir, "stations.json"), JSON.stringify(result.stations, null, 2) + "\n");
  writeAtomic(join(outDir, "lines.json"), JSON.stringify(result.lines, null, 2) + "\n");
  writeAtomic(join(outDir, "graph.json"), JSON.stringify(result.graph, null, 2) + "\n");
  writeAtomic(join(outDir, "meta.json"), JSON.stringify(meta, null, 2) + "\n");

  console.log(
    `build: tehran ok — stations=${meta.counts.stations} lines=${meta.counts.lines} ` +
      `routes=${meta.counts.routes} segments=${meta.counts.segments} transfers=${meta.counts.transfers} ` +
      `cities=${meta.counts.cities} agencies=${meta.counts.agencies} networks=${meta.counts.networks}`,
  );
}

main();
