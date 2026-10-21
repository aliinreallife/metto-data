#!/usr/bin/env node
// Build milestone: pnpm build [--city tehran] → importers/<city> → validators → data/cities/<city>/*.
// Fail closed: any validator error aborts BEFORE writing (never leave half-written output).
import { parseArgs } from "node:util";
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildTehran } from "../importers/tehran.js";
import { buildMashhad } from "../importers/mashhad.js";
import { validateDataset } from "../validators/validate.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");

function upstreamCommit(city: string): string {
  const sources = JSON.parse(readFileSync(join(repoRoot, "sources.json"), "utf8")) as Record<string, {path?: string; pinnedCommit?: string}>;
  const source = sources[city];
  if (!source?.path || !source.pinnedCommit) throw new Error(`build: missing pinned source for city ${city}`);
  const match = /^[a-z0-9-]+$/.test(source.path);
  if (!match) throw new Error(`build: invalid source path ${source.path}`);
  try {
    const out = execSync(`git rev-parse HEAD:${source.path}`, {
      cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (/^[0-9a-f]{40}$/.test(out)) {
      if (out !== source.pinnedCommit) throw new Error(`build: ${city} gitlink disagrees with sources.json`);
      return out;
    }
  } catch (e) {
    if ((e as Error).message?.includes("disagrees")) throw e;
    // Fixtures without a .git directory still use sources.json's exact pin.
  }
  return source.pinnedCommit;
}

function contributorIds(city: string): string[] {
  const ids = new Set<string>();
  try {
    for (const file of readdirSync(join(repoRoot, "contributions", "approved"))) {
      if (!file.endsWith(".json")) continue;
      const doc = JSON.parse(readFileSync(join(repoRoot, "contributions", "approved", file), "utf8")) as {
        submittedBy?: string;
        status?: string;
        city?: string;
      };
      if (doc.city === city && doc.status === "approved" && typeof doc.submittedBy === "string" && doc.submittedBy.length > 0) {
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
  const { values } = parseArgs({ options: { city: { type: "string" } } });
  const sources = JSON.parse(readFileSync(join(repoRoot, "sources.json"), "utf8")) as Record<
    string, { repository: string; upstreamFile: string; path: string; datasetVersion: string; releaseStatus?: "candidate" | "verified" }
  >;
  const cities = values.city ? [values.city] : Object.keys(sources).sort();
  const builders = { tehran: buildTehran, mashhad: buildMashhad } as Record<string, (root: string) => ReturnType<typeof buildTehran>>;
  for (const city of cities) {
    const source = sources[city];
    const importer = builders[city];
    if (!source || !importer) {
      console.error(`build: unknown city ${JSON.stringify(city)} (registered: ${Object.keys(builders).join(", ")})`);
      process.exit(2);
    }

    const result = importer(repoRoot);
    for (const warning of result.warnings) console.error(`build warning [${city}]: ${warning}`);
    const errors = validateDataset({
      city: result.city, agencies: result.agencies, networks: result.networks,
      stations: result.stations, lines: result.lines, graph: result.graph,
    });
    if (errors.length > 0) {
      for (const error of errors) console.error(`build error [${city}]: ${error}`);
      process.exit(1); // Do not write invalid dataset.
    }
    const meta = {
      cityId: city, datasetVersion: source.datasetVersion,
      generatedAt: new Date().toISOString(), releaseStatus: source.releaseStatus ?? "verified", importer: `importers/${city}.ts`,
      upstream: {
        repository: source.repository,
        commit: upstreamCommit(city),
        file: `${source.path}/${source.upstreamFile}`,
      },
      counts: {
        stations: result.stations.length, lines: result.lines.length,
        routes: result.graph.routes.length, segments: result.graph.segments.length,
        transfers: result.graph.transfers.length, cities: 1,
        agencies: result.agencies.length, networks: result.networks.length,
      },
      contributorIds: contributorIds(city),
    };

    const outDir = join(repoRoot, "data", "cities", city);
    mkdirSync(outDir, { recursive: true });
    writeAtomic(join(outDir, "city.json"), JSON.stringify(result.city, null, 2) + "\n");
    writeAtomic(join(outDir, "agencies.json"), JSON.stringify(result.agencies, null, 2) + "\n");
    writeAtomic(join(outDir, "networks.json"), JSON.stringify(result.networks, null, 2) + "\n");
    writeAtomic(join(outDir, "stations.json"), JSON.stringify(result.stations, null, 2) + "\n");
    writeAtomic(join(outDir, "lines.json"), JSON.stringify(result.lines, null, 2) + "\n");
    writeAtomic(join(outDir, "graph.json"), JSON.stringify(result.graph, null, 2) + "\n");
    writeAtomic(join(outDir, "meta.json"), JSON.stringify(meta, null, 2) + "\n");
    console.log(`build: ${city} ok — stations=${meta.counts.stations} lines=${meta.counts.lines} routes=${meta.counts.routes} segments=${meta.counts.segments} transfers=${meta.counts.transfers}`);
  }
}

main();
