#!/usr/bin/env node
/**
 * Read an Overpass export for manual review. Never touches canonical data.
 * ODbL-1.0 © OpenStreetMap contributors: https://www.openstreetmap.org/copyright
 *
 * Usage:
 * node scripts/osm-candidate-intake.mjs --city isfahan --input osm.json
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cities = {
  isfahan: { latMin: 32.51, latMax: 32.81, lonMin: 51.46, lonMax: 51.87 },
  shiraz: { latMin: 29.48, latMax: 29.78, lonMin: 52.38, lonMax: 52.76 },
};
const tagFields = [
  "name", "name:fa", "name:en", "railway", "station",
  "public_transport", "subway", "construction", "disused:railway",
  "proposed", "ref", "operator", "network",
];

export function processOSMExport(rawBytes, city) {
  if (!Object.hasOwn(cities, city)) throw new Error("unknown city; only isfahan and shiraz are supported");
  if (!Buffer.isBuffer(rawBytes) || rawBytes.length === 0 || rawBytes.length > 20_000_000) {
    throw new Error("input must be a nonempty Overpass JSON export of at most 20 MB");
  }
  let parsed;
  try { parsed = JSON.parse(rawBytes.toString("utf8")); }
  catch { throw new Error("invalid JSON source file"); }
  if (!parsed || !Array.isArray(parsed.elements) ||
      !parsed.osm3s || typeof parsed.osm3s.timestamp_osm_base !== "string" ||
      !Number.isFinite(Date.parse(parsed.osm3s.timestamp_osm_base))) {
    throw new Error("input requires Overpass elements[] and osm3s.timestamp_osm_base");
  }
  if (parsed.elements.length > 50000) throw new Error("unreasonably large station export");
  const candidates = [];
  const seen = new Set();
  for (const e of parsed.elements) {
    if (!e || !["node", "way", "relation"].includes(e.type) ||
        !Number.isSafeInteger(e.id) || e.id <= 0 || !Number.isSafeInteger(e.version) ||
        e.version < 1 || !e.tags || typeof e.tags !== "object" || Array.isArray(e.tags)) {
      continue;
    }
    const t = e.tags;
    const relevant = t.station === "subway" || t.subway === "yes" ||
      ["station", "halt", "stop", "platform"].includes(t.railway) ||
      ["station", "stop_position", "platform"].includes(t.public_transport);
    if (!relevant) continue;
    const key = `${e.type}/${e.id}`;
    if (seen.has(key)) throw new Error(`duplicate OSM element ${key}`);
    seen.add(key);
    const lat = e.type === "node" ? e.lat : e.center?.lat;
    const lng = e.type === "node" ? e.lon : e.center?.lon;
    const validPoint = typeof lat === "number" && Number.isFinite(lat) &&
      typeof lng === "number" && Number.isFinite(lng) &&
      lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    const b = cities[city];
    const inBounds = validPoint && lat >= b.latMin && lat <= b.latMax &&
      lng >= b.lonMin && lng <= b.lonMax;
    const pickedTags = Object.fromEntries(tagFields
      .filter((k) => typeof t[k] === "string" && t[k].length > 0)
      .map((k) => [k, t[k]]));
    candidates.push({
      osm: { type: e.type, id: e.id, version: e.version,
        url: `https://www.openstreetmap.org/${key}` },
      nameFa: pickedTags["name:fa"] ?? null,
      name: pickedTags.name ?? null,
      tags: pickedTags,
      representativePoint: validPoint ? { lat, lng } : null,
      positionReview: !validPoint ? "missing-center" :
        inBounds ? "in-search-box-unverified" : "outside-search-box-unverified",
      stationNameMatch: "unreviewed",
      boardingVerified: false,
      routeMembershipVerified: false,
      amenitiesVerified: false,
      approvedForProduction: false,
    });
  }
  candidates.sort((a, b) => a.osm.type.localeCompare(b.osm.type) || a.osm.id - b.osm.id);
  return {
    schemaVersion: 1, cityId: city, reviewOnly: true,
    source: {
      label: "manual Overpass JSON export (not authenticated as an operator feed)",
      observedOsmBase: parsed.osm3s.timestamp_osm_base,
      rawInputSha256: createHash("sha256").update(rawBytes).digest("hex"),
      license: "ODbL-1.0", attribution: "© OpenStreetMap contributors",
      attributionUrl: "https://www.openstreetmap.org/copyright",
      authenticatedSource: false,
    },
    releaseGate: {
      stationIdentityReviewed: false, pointsReviewed: false,
      routeOrderReviewed: false, boardingReviewed: false, operatorApproved: false,
    },
    counts: { candidates: candidates.length, withCoordinates: candidates.filter(x => x.representativePoint).length,
      outsideReviewBox: candidates.filter(x => x.positionReview === "outside-search-box-unverified").length },
    candidates,
  };
}

function cli(args) {
  function readArg(flag) {
    const i = args.indexOf(flag);
    if (i < 0 || !args[i + 1] || args[i + 1].startsWith("--")) {
      throw new Error(`missing ${flag}`);
    }
    return args[i + 1];
  }
  if (args.length !== 4) throw new Error("usage: --city isfahan|shiraz --input path/to/overpass.json");
  const city = readArg("--city");
  const file = resolve(readArg("--input"));
  const output = processOSMExport(readFileSync(file), city);
  // Always keep this output under gitignored review-only artifacts.
  const dir = join(root, ".quality-report");
  mkdirSync(dir, { recursive: true });
  const target = join(dir, `${city}-osm-candidates.json`);
  writeFileSync(target, JSON.stringify(output, null, 2) + "\n", { flag: "w" });
  console.log(`osm candidate intake: ${city} — ${output.counts.candidates} unverified elements; ${target}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { cli(process.argv.slice(2)); }
  catch (e) { console.error(`osm candidate intake: ${e.message}`); process.exitCode = 1; }
}
