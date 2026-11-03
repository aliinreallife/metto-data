#!/usr/bin/env node
// Cross-reference candidate OpenStreetMap objects against reviewed name inventories.
// This is an OFFLINE research queue, never a release, routing or geo approval tool.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SUPPORTED = new Set(["isfahan", "shiraz"]);

function normalizeFa(value) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKC")
    .replace(/[\u064a\u0649]/gu, "\u06cc")
    .replace(/\u0643/gu, "\u06a9")
    .replace(/[\u064b-\u065f\u0670\u0640]/gu, "")
    .replace(/\u200c/gu, " ")
    .replace(/^(?:ایستگاه\s+)?متروی?\s+/u, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createNameReview(report, matrix, matrixSha256) {
  if (
    !report ||
    !SUPPORTED.has(report.cityId) ||
    report.reviewOnly !== true ||
    !Array.isArray(report.candidates) ||
    !/^[a-f0-9]{64}$/.test(report.source?.rawInputSha256 ?? "") ||
    !report.releaseGate ||
    ![
      "stationIdentityReviewed",
      "pointsReviewed",
      "routeOrderReviewed",
      "boardingReviewed",
      "operatorApproved",
    ].every((key) => report.releaseGate[key] === false) ||
    !matrix ||
    matrix.cityId !== report.cityId ||
    matrix.releaseStatus !== "candidate" ||
    !Array.isArray(matrix.stationReviews) ||
    !matrix.stationReviews.length ||
    !matrix.releaseGates ||
    Object.values(matrix.releaseGates).length === 0 ||
    !Object.values(matrix.releaseGates).every((flag) => flag === false) ||
    !/^[a-f0-9]{64}$/.test(matrixSha256)
  ) {
    throw new Error(
      "expected same-city candidate OSM report and blocked station evidence matrix",
    );
  }
  const objectIds = new Set();
  for (const candidate of report.candidates) {
    const osm = candidate?.osm;
    if (
      !osm ||
      !["node", "way", "relation"].includes(osm.type) ||
      !Number.isSafeInteger(osm.id) ||
      osm.id <= 0 ||
      !Number.isSafeInteger(osm.version) ||
      osm.version < 1 ||
      ![
        "boardingVerified",
        "routeMembershipVerified",
        "amenitiesVerified",
        "approvedForProduction",
      ].every((key) => candidate[key] === false)
    )
      throw new Error("Expected versioned, unapproved OSM candidates");
    const key = osm.type + "/" + osm.id;
    if (objectIds.has(key)) throw new Error("Duplicate OSM candidate " + key);
    objectIds.add(key);
  }
  const groups = new Map();
  for (const station of matrix.stationReviews) {
    if (
      typeof station.candidateNameFa !== "string" ||
      typeof station.lineId !== "string" ||
      !station.lineId.startsWith(report.cityId + ":line:")
    ) {
      throw new Error("invalid namespaced station evidence");
    }
    const key = normalizeFa(station.candidateNameFa);
    if (!key) throw new Error("empty station name");
    const group = groups.get(key) ?? {
      namesFa: [],
      lineIds: [],
      memberships: 0,
    };
    if (!group.namesFa.includes(station.candidateNameFa))
      group.namesFa.push(station.candidateNameFa);
    if (!group.lineIds.includes(station.lineId))
      group.lineIds.push(station.lineId);
    group.memberships++;
    groups.set(key, group);
  }
  const byName = new Map();
  for (const candidate of report.candidates) {
    if (!candidate?.osm || typeof candidate.osm.id !== "number") continue;
    const names = [candidate.nameFa, candidate.name].filter(
      (name) => typeof name === "string" && /[\u0600-\u06ff]/u.test(name),
    );
    for (const normalized of new Set(names.map(normalizeFa).filter(Boolean))) {
      const matches = byName.get(normalized) ?? [];
      if (
        !matches.some(
          (c) =>
            c.osm.id === candidate.osm.id && c.osm.type === candidate.osm.type,
        )
      )
        matches.push(candidate);
      byName.set(normalized, matches);
    }
  }
  const entries = [...groups.entries()].map(([normalizedName, group]) => {
    const matches = byName.get(normalizedName) ?? [];
    return {
      ...group,
      normalizedName,
      matchState:
        matches.length === 0
          ? "no-exact-name-match"
          : matches.length === 1
            ? "name-match-needs-human-review"
            : "ambiguous-multiple-osm-objects",
      possibleOsm: matches.map((c) => ({
        type: c.osm.type,
        id: c.osm.id,
        version: c.osm.version,
        url: `https://www.openstreetmap.org/${c.osm.type}/${c.osm.id}`,
        versionUrl: `https://www.openstreetmap.org/${c.osm.type}/${c.osm.id}/history/${c.osm.version}`,
        representativePoint: c.representativePoint,
        positionReview: c.positionReview,
        railway: c.tags?.railway ?? null,
        publicTransport: c.tags?.public_transport ?? null,
      })),
      stationIdentityVerified: false,
      coordinatesVerified: false,
      boardingVerified: false,
      routeOrderVerified: false,
      productionApproved: false,
    };
  });
  return {
    schemaVersion: 1,
    cityId: report.cityId,
    reviewOnly: true,
    sourceRawInputSha256: report.source.rawInputSha256,
    sourceObservedOsmBase: report.source.observedOsmBase,
    matrixSha256,
    note: "Exact normalized Persian name leads only. A matching OSM object is not an approved physical station, interchange, route edge or boarding status.",
    counts: {
      stationMemberships: matrix.stationReviews.length,
      uniqueNameLeads: entries.length,
      oneObjectNameMatches: entries.filter(
        (x) => x.matchState === "name-match-needs-human-review",
      ).length,
      ambiguousNames: entries.filter(
        (x) => x.matchState === "ambiguous-multiple-osm-objects",
      ).length,
      unmatchedNames: entries.filter(
        (x) => x.matchState === "no-exact-name-match",
      ).length,
    },
    releaseGate: {
      stationIdentityReviewed: false,
      pointsReviewed: false,
      routeOrderReviewed: false,
      boardingReviewed: false,
      operatorApproved: false,
    },
    entries,
  };
}

function cli(argv) {
  if (argv.length !== 6)
    throw new Error(
      "usage: --city isfahan|shiraz --candidates osm-candidates.json --matrix station-evidence.json",
    );
  function option(name) {
    const index = argv.indexOf(name);
    if (index < 0 || !argv[index + 1] || argv[index + 1].startsWith("--")) {
      throw new Error("missing " + name);
    }
    return argv[index + 1];
  }
  const city = option("--city");
  if (!SUPPORTED.has(city)) throw new Error("unsupported city");
  const source = JSON.parse(
    readFileSync(resolve(option("--candidates")), "utf8"),
  );
  const rawMatrix = readFileSync(resolve(option("--matrix")));
  const matrix = JSON.parse(rawMatrix.toString("utf8"));
  if (source.cityId !== city || matrix.cityId !== city) {
    throw new Error("city mismatch between inputs");
  }
  const sha = createHash("sha256").update(rawMatrix).digest("hex");
  const report = createNameReview(source, matrix, sha);
  const dir = join(ROOT, ".quality-report");
  mkdirSync(dir, { recursive: true });
  const out = join(dir, city + "-osm-name-review.json");
  writeFileSync(out, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(
    "OSM name review: " +
      city +
      ": " +
      report.counts.oneObjectNameMatches +
      " single-name leads, " +
      report.counts.ambiguousNames +
      " ambiguous, " +
      report.counts.unmatchedNames +
      " unmatched. Output " +
      out,
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    cli(process.argv.slice(2));
  } catch (error) {
    console.error("OSM name review: " + error.message);
    process.exitCode = 1;
  }
}
