#!/usr/bin/env node
/**
 * EXPLICIT operator-reviewed research command, NOT part of CI or the app.
 * Downloads one bounded Overpass JSON snapshot for station-candidate review.
 * ODbL © OpenStreetMap contributors. Does not infer boarding or train service.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MAX_BYTES = 20_000_000;
const ENDPOINTS = Object.freeze({
  main: "https://overpass-api.de/api/interpreter",
  private: "https://overpass.private.coffee/api/interpreter",
});
const BOX = Object.freeze({
  isfahan: [32.51, 51.46, 32.81, 51.87],
  shiraz: [29.48, 52.38, 29.78, 52.76],
});

export function stationQuery(city) {
  const box = BOX[city];
  if (!box) throw new Error("Only isfahan and shiraz are supported");
  const bbox = box.join(",");
  const clauses = [
    'nwr["station"="subway"]',
    'nwr["railway"="station"]',
    'nwr["public_transport"="station"]["subway"="yes"]',
    'nwr["public_transport"="platform"]["subway"="yes"]',
    'nwr["railway"="platform"]["subway"="yes"]',
    'nwr["public_transport"="stop_position"]["subway"="yes"]',
  ];
  return '[out:json][timeout:75];\n(\n' +
    clauses.map((clause) => '  ' + clause + '(' + bbox + ');').join('\n') +
    '\n);\nout center meta;\n';
}

export function scopedQuery(city, scope) {
  if (scope === "stations") return stationQuery(city);
  if (scope === "shiraz-line2-relation" && city === "shiraz") {
    // OSM relation only: a discovery lead, not verified boarding or travel.
    return '[out:json][timeout:75];\\nrelation(15510494);\\n(._;>;);\\nout center meta;\\n'.replaceAll('\\n', '\n');
  }
  throw new Error("Unsupported city/scope combination");
}

export function inspectRaw(raw) {
  if (!Buffer.isBuffer(raw) || raw.length === 0 || raw.length > MAX_BYTES) {
    throw new Error("Empty or oversized export (limit: 20 MB)");
  }
  let d;
  try { d = JSON.parse(raw.toString("utf8")); }
  catch { throw new Error("Overpass response is not JSON"); }
  if (!d || !Array.isArray(d.elements) || d.elements.length === 0 ||
      !d.osm3s || !Number.isFinite(Date.parse(d.osm3s.timestamp_osm_base))) {
    throw new Error("Missing OSM base timestamp or OSM elements; output not admissible");
  }
  if (d.remark && /timeout|error|runtime/i.test(String(d.remark))) {
    throw new Error("Overpass returned an error/timeout remark");
  }
  const seen = new Set();
  for (const e of d.elements) {
    if (!e || !["node", "way", "relation"].includes(e.type) ||
        !Number.isSafeInteger(e.id) || e.id <= 0 ||
        !Number.isSafeInteger(e.version) || e.version <= 0) {
      throw new Error("Export contains an unversioned/invalid OSM entity; require 'out center meta'");
    }
    const key = e.type + "/" + e.id;
    if (seen.has(key)) throw new Error("Duplicate OSM entity: " + key);
    seen.add(key);
  }
  return {
    snapshotBase: d.osm3s.timestamp_osm_base,
    count: d.elements.length,
    rawSha256: createHash("sha256").update(raw).digest("hex"),
  };
}

async function boundedResponse(response) {
  if (!response.ok) throw new Error("Overpass HTTP " + response.status);
  const sizeHeader = Number(response.headers.get("content-length"));
  if (sizeHeader > MAX_BYTES) throw new Error("Overpass export exceeds 20 MB");
  if (!response.body) throw new Error("Overpass returned no body");
  const reader = response.body.getReader();
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error("Overpass export exceeds 20 MB");
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

function getOpt(argv, name) {
  const i = argv.indexOf(name);
  if (i < 0) return null;
  if (!argv[i + 1] || argv[i + 1].startsWith("--")) {
    throw new Error("Missing value for " + name);
  }
  return argv[i + 1];
}

async function main(argv) {
  const city = getOpt(argv, "--city");
  const endpointName = getOpt(argv, "--endpoint") ?? "main";
  const validFile = getOpt(argv, "--validate");
  const scope = getOpt(argv, "--scope") ?? "stations";
  const dry = argv.includes("--dry-run");
  const expected = (dry ? 1 : 0) + (validFile ? 2 : 0) +
    (argv.includes("--endpoint") ? 2 : 0) + (argv.includes("--scope") ? 2 : 0) + 2;
  if (!BOX[city] || !ENDPOINTS[endpointName] || argv.length !== expected ||
      (dry && validFile)) {
    throw new Error("Usage: --city isfahan|shiraz [--scope stations|shiraz-line2-relation] [--endpoint main|private] [--dry-run | --validate saved-overpass.json]");
  }
  const query = scopedQuery(city, scope);
  if (dry) { process.stdout.write(query); return; }
  // No URL or arbitrary host is accepted from the CLI.
  let raw;
  let source;
  if (validFile) {
    raw = readFileSync(resolve(validFile));
    source = { kind: "manual-supplied-export", endpoint: null };
  } else {
    const endpoint = ENDPOINTS[endpointName];
    const response = await fetch(endpoint, {
      method: "POST",
      body: new URLSearchParams({ data: query }),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
        "User-Agent": "MettoSourceReview/1.0 (https://github.com/aliinreallife/metto-data)",
      },
      signal: AbortSignal.timeout(90000),
      redirect: "error",
    });
    raw = await boundedResponse(response);
    source = { kind: "live-overpass-export", endpoint };
  }
  const checked = inspectRaw(raw);
  let relationMembers = null;
  if (scope === "shiraz-line2-relation") {
    const parsed = JSON.parse(raw.toString("utf8"));
    const relation = parsed.elements.find(
      (e) => e.type === "relation" && e.id === 15510494
    );
    if (!relation || !Array.isArray(relation.members) ||
        relation.members.length === 0) {
      throw new Error("Expected Shiraz Line 2 relation with a nonempty member list");
    }
    relationMembers = relation.members.length;
  }
  const dir = join(ROOT, ".quality-report");
  mkdirSync(dir, { recursive: true });
  const stem = scope === "stations" ? city + "-overpass-raw" :
    "shiraz-line2-relation-overpass-raw";
  const output = join(dir, stem + ".json");
  const manifest = join(dir, stem + ".provenance.json");
  // Write the original Overpass bytes without normalization. Never publish
  // source data to data/cities/, scripts' own fixtures or the production app.
  const tmp = output + ".tmp";
  try {
    writeFileSync(tmp, raw, { flag: "w" });
    renameSync(tmp, output);
  } finally { rmSync(tmp, { force: true }); }
  const provenance = {
    schemaVersion: 1, cityId: city, reviewOnly: true,
    fetchedOrCheckedAt: new Date().toISOString(),
    source, ...checked, scope,
    ...(relationMembers === null ? {} :
      { sourceRelation: { type: "relation", id: 15510494,
        observedMembers: relationMembers, routeTopologyVerified: false,
        boardingStationsVerified: false, directionVerified: false } }),
    requestQuery: validFile ? null : query,
    license: "ODbL-1.0",
    attribution: "© OpenStreetMap contributors",
    attributionUrl: "https://www.openstreetmap.org/copyright",
    verifiedPassengerService: false, coordinatesApproved: false,
    routesApproved: false, readyForProduction: false,
    note: "Snapshot is not an operator feed; OSM object versions and positions still require independent per-station review.",
  };
  writeFileSync(manifest, JSON.stringify(provenance, null, 2) + "\n");
  console.log("Saved " + checked.count + " versioned OSM source objects for " + city +
    " (review-only). SHA-256 " + checked.rawSha256);
  console.log("Source: " + output + "; provenance: " + manifest);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error("OSM source acquisition: " + error.message);
    process.exitCode = 1;
  });
}
