#!/usr/bin/env node
// Release readiness checks (read-only; exits non-zero on any failure):
// - every city in sources.json has complete, non-empty generated data
// - sources.json entries are complete (provenance + license + pinned commit)
// - license files exist
// - submodule gitlinks match sources.json pinned commits
// - validators pass for every city
import { execSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateCityDir } from "../validators/validate.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");

const GENERATED_FILES = [
  "city.json",
  "agencies.json",
  "networks.json",
  "stations.json",
  "lines.json",
  "graph.json",
  "meta.json",
] as const;

const SOURCE_FIELDS = [
  "name",
  "repository",
  "path",
  "upstreamFile",
  "license",
  "licenseFile",
  "type",
  "pinnedCommit",
  "lastSyncedAt",
  "datasetVersion",
] as const;

function gitlink(submodulePath: string): string | null {
  try {
    const out = execSync(`git rev-parse HEAD:${submodulePath}`, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return /^[0-9a-f]{40}$/.test(out) ? out : null;
  } catch {
    return null;
  }
}

function main(): void {
  const errors: string[] = [];

  let sources: Record<string, Record<string, unknown>>;
  try {
    sources = JSON.parse(readFileSync(join(repoRoot, "sources.json"), "utf8"));
  } catch (e) {
    console.error(`check-release error: cannot read sources.json (${(e as Error).message})`);
    process.exit(1);
  }
  const cities = Object.keys(sources);
  if (cities.length === 0) errors.push("sources.json: no supported cities");

  for (const city of cities) {
    const entry = sources[city] ?? {};
    for (const field of SOURCE_FIELDS) {
      if (entry[field] === undefined || entry[field] === "") {
        errors.push(`sources.json: city ${city} is missing ${field}`);
      }
    }

    // License files.
    for (const file of ["LICENSE", "DATA_LICENSE.md", "ATTRIBUTION.md"]) {
      try {
        if (statSync(join(repoRoot, file)).size === 0) errors.push(`${file}: empty file`);
      } catch {
        errors.push(`${file}: missing file`);
      }
    }
    if (typeof entry.licenseFile === "string") {
      try {
        if (statSync(join(repoRoot, entry.licenseFile)).size === 0) {
          errors.push(`${entry.licenseFile}: empty file (city ${city})`);
        }
      } catch {
        errors.push(`${entry.licenseFile}: missing file (city ${city})`);
      }
    }

    // Submodule gitlink matches the pinned commit.
    if (entry.type === "git-submodule" && typeof entry.path === "string") {
      const link = gitlink(entry.path);
      if (!link) {
        errors.push(`city ${city}: cannot resolve gitlink for ${entry.path}`);
      } else if (link !== entry.pinnedCommit) {
        errors.push(`city ${city}: gitlink ${link} disagrees with sources.json pinnedCommit ${entry.pinnedCommit}`);
      }
      try {
        if (statSync(join(repoRoot, String(entry.path), String(entry.upstreamFile))).size === 0) {
          errors.push(`city ${city}: upstream file is empty`);
        }
      } catch {
        errors.push(`city ${city}: upstream file missing (submodule not checked out?)`);
      }
    }

    // Generated files exist, are non-empty, and parse.
    const cityDir = join(repoRoot, "data", "cities", city);
    for (const file of GENERATED_FILES) {
      try {
        const size = statSync(join(cityDir, file)).size;
        if (size <= 2) errors.push(`data/cities/${city}/${file}: empty file`);
        else JSON.parse(readFileSync(join(cityDir, file), "utf8"));
      } catch {
        errors.push(`data/cities/${city}/${file}: missing or invalid JSON`);
      }
    }

    // Non-empty dataset arrays (only when files parsed above).
    try {
      const stations = JSON.parse(readFileSync(join(cityDir, "stations.json"), "utf8"));
      const lines = JSON.parse(readFileSync(join(cityDir, "lines.json"), "utf8"));
      const graph = JSON.parse(readFileSync(join(cityDir, "graph.json"), "utf8"));
      if (!Array.isArray(stations) || stations.length === 0) {
        errors.push(`data/cities/${city}/stations.json: empty dataset`);
      }
      if (!Array.isArray(lines) || lines.length === 0) {
        errors.push(`data/cities/${city}/lines.json: empty dataset`);
      }
      if (!Array.isArray(graph?.routes) || graph.routes.length === 0) {
        errors.push(`data/cities/${city}/graph.json: no routes`);
      }
      if (!Array.isArray(graph?.segments) || graph.segments.length === 0) {
        errors.push(`data/cities/${city}/graph.json: no segments`);
      }
    } catch {
      // already reported as missing/invalid above
    }

    // Validators pass.
    errors.push(...validateCityDir(cityDir, city));
  }

  if (errors.length > 0) {
    for (const e of [...new Set(errors)]) console.error(`check-release error: ${e}`);
    console.error(`check-release: ${new Set(errors).size} error(s) — not ready for release`);
    process.exit(1);
  }
  console.log(`check-release: ok (${cities.join(",")})`);
}

main();
