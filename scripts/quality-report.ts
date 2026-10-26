#!/usr/bin/env node
/**
 * Audits candidate-vs-published data and exports raw facility claims as a
 * review-only artifact. A successful audit is NOT approval for service use.
 */
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { validateContributionsDir } from "../validators/contributions.js";
import type { CityGraph, Station as CityStation } from "../schema/v1/types.js";
import { buildMashhadPathReview } from "./mashhad-path-review.js";
import serviceEvidence from "../sources/mashhad/service-evidence.json" with { type: "json" };
import osmEvidence from "../sources/mashhad/osm-review-snapshot.json" with { type: "json" };
import {
  checkReleaseReview,
  datasetFingerprint,
  readCityReview,
} from "../validators/release-review.js";

type Station = {
  id: string;
  names: { en: string; fa: string };
  location: { lat: number; lng: number };
  amenities: Record<string, boolean | null>;
  amenitiesVerified?: boolean;
};
type Graph = {
  routes: { lineId: string; stops: { stationId: string; status?: string }[] }[];
  segments: unknown[];
  transfers: unknown[];
};
type Source = {
  path: string;
  upstreamFile: string;
  repository: string;
  pinnedCommit: string;
  releaseStatus?: string;
};
export type Findings = {
  errors: string[];
  warnings: string[];
  unknownAmenities: number;
  interchanges: number;
};
function distance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = Math.PI / 180,
    dlat = (a.lat - b.lat) * rad,
    dlng = (a.lng - b.lng) * rad;
  const x =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dlng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
export function inspectCity(
  city: string,
  status: string,
  stations: Station[],
  graph: Graph,
  reviewedAmenities: ReadonlyMap<string, boolean | null> = new Map(),
): Findings {
  const errors: string[] = [],
    warnings: string[] = [];
  let unknownAmenities = 0;
  const names = new Set<string>();
  for (const s of stations) {
    const name = s.names.en.toLowerCase().trim();
    if (names.has(name))
      errors.push(`${city}: duplicate English name ${s.names.en}`);
    names.add(name);
    unknownAmenities += Object.values(s.amenities).filter(
      (v) => v === null,
    ).length;
    if (city === "mashhad" && status === "candidate") {
      if (
        s.amenitiesVerified !== false ||
        Object.entries(s.amenities).some(
          ([key, value]) =>
            value !== null && reviewedAmenities.get(s.id + ":" + key) !== value,
        )
      )
        errors.push(
          `${s.id}: unverified facility claims leaked into canonical data`,
        );
    }
  }
  for (let i = 0; i < stations.length; i++)
    for (let j = i + 1; j < stations.length; j++) {
      const d = distance(stations[i].location, stations[j].location);
      if (d < 1)
        errors.push(
          `${city}: duplicate station center ${stations[i].id} / ${stations[j].id}`,
        );
      else if (d < 60)
        warnings.push(
          `${city}: stations ${stations[i].id} / ${stations[j].id} within ${Math.round(d)}m; review`,
        );
    }
  const memberships = new Map<string, Set<string>>();
  for (const route of graph.routes)
    for (const stop of route.stops) {
      if (!memberships.has(stop.stationId))
        memberships.set(stop.stationId, new Set());
      memberships.get(stop.stationId)!.add(route.lineId);
    }
  const interchanges = [...memberships.values()].filter(
    (s) => s.size > 1,
  ).length;
  if (interchanges > 0 && graph.transfers.length === 0)
    warnings.push(
      `${city}: ${interchanges} interchanges lack reviewed transfer walking times`,
    );
  if (status === "candidate")
    warnings.push(
      `${city}: releaseStatus=candidate; NOT approved for production`,
    );
  return { errors, warnings, unknownAmenities, interchanges };
}
/** Only validated, explicitly approved fields can pass the candidate facility gate. */
function reviewedAmenityValues(
  root: string,
  city: string,
): Map<string, boolean | null> {
  const cityIds = new Set(
    Object.keys(JSON.parse(readFileSync(join(root, "sources.json"), "utf8"))),
  );
  const errors = validateContributionsDir(root, "approved", cityIds);
  if (errors.length)
    throw Error("invalid approved contribution evidence: " + errors.join("; "));
  const facts = new Map<string, boolean | null>(),
    path = join(root, "contributions", "approved");
  let files: string[] = [];
  try {
    files = readdirSync(path)
      .filter((f) => f.endsWith(".json"))
      .sort();
  } catch {
    return facts;
  }
  for (const file of files) {
    const d = JSON.parse(readFileSync(join(path, file), "utf8"));
    if (d.city !== city || d.entityType !== "station") continue;
    for (const op of d.operations) {
      if (!op.path.startsWith("/amenities/")) continue;
      const key = d.entityId + ":" + op.path.slice("/amenities/".length);
      if (facts.has(key) && facts.get(key) !== op.value)
        throw Error("conflicting approved amenity evidence");
      facts.set(key, op.value);
    }
  }
  return facts;
}
const FIELDS = [
  "wc",
  "elevator",
  "atm",
  "coffeeShop",
  "fastFood",
  "groceryStore",
  "freeWifi",
  "prayerRoom",
  "bicycleParking",
  "metroPolice",
  "blindPath",
  "waitingChair",
  "fireSuppressionSystem",
  "fireExtinguisher",
  "creditTicketSales",
  "camera",
  "trashCan",
  "smoking",
  "petsAllowed",
  "cleanFood",
] as const;

export function generateReport(root: string, out: string) {
  const registry = JSON.parse(
    readFileSync(join(root, "sources.json"), "utf8"),
  ) as Record<string, Source>;
  const errors: string[] = [],
    warnings: string[] = [],
    table: string[] = [];
  mkdirSync(out, { recursive: true });
  for (const [city, source] of Object.entries(registry).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const dir = join(root, "data", "cities", city);
    const stations = JSON.parse(
      readFileSync(join(dir, "stations.json"), "utf8"),
    ) as Station[];
    const lines = JSON.parse(
      readFileSync(join(dir, "lines.json"), "utf8"),
    ) as unknown[];
    const graph = JSON.parse(
      readFileSync(join(dir, "graph.json"), "utf8"),
    ) as Graph;
    const meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8")) as {
      releaseStatus?: string;
    };
    if (meta.releaseStatus !== source.releaseStatus)
      errors.push(
        `${city}: release status in meta.json disagrees with sources.json`,
      );
    const status = source.releaseStatus ?? "verified";
    const inspected = inspectCity(
      city,
      status,
      stations,
      graph,
      reviewedAmenityValues(root, city),
    );
    errors.push(...inspected.errors);
    warnings.push(...inspected.warnings);
    let claimsCount = 0;
    if (city === "mashhad") {
      const raw = JSON.parse(
        readFileSync(join(root, source.path, source.upstreamFile), "utf8"),
      ) as Record<string, Record<string, unknown>>;
      const items = Object.entries(raw).map(([upstreamKey, value]) => {
        const fields = Object.fromEntries(
          FIELDS.filter((k) => typeof value[k] === "boolean").map((k) => [
            k,
            value[k],
          ]),
        );
        claimsCount += Object.keys(fields).length;
        return {
          upstreamKey,
          source: source.repository,
          pinnedCommit: source.pinnedCommit,
          verification: "unverified",
          reportedFacilities: fields,
        };
      });
      writeFileSync(
        join(out, "mashhad-facility-candidates.json"),
        JSON.stringify(
          {
            warning:
              "UNVERIFIED upstream claims - not canonical facts; must not be shown as confirmed amenities",
            city,
            sourceLicense: "ODbL-1.0",
            stations: items,
          },
          null,
          2,
        ) + "\n",
      );
      const serviceBytes = readFileSync(
        join(root, "sources/mashhad/service-evidence.json"),
      );
      const osmBytes = readFileSync(
        join(root, "sources/mashhad/osm-review-snapshot.json"),
      );
      const pathReview = buildMashhadPathReview({
        graph: graph as CityGraph,
        stations: stations as CityStation[],
        datasetSha256: datasetFingerprint(root, city),
        service: JSON.parse(serviceBytes.toString()) as typeof serviceEvidence,
        osm: JSON.parse(osmBytes.toString()) as typeof osmEvidence,
        serviceEvidenceSha256: createHash("sha256")
          .update(serviceBytes)
          .digest("hex"),
        osmEvidenceSha256: createHash("sha256").update(osmBytes).digest("hex"),
      });
      writeFileSync(
        join(out, "mashhad-path-review.json"),
        JSON.stringify(pathReview, null, 2) + "\n",
      );
      errors.push(...pathReview.integrityGaps);
      const reviewErrors = checkReleaseReview(
        city,
        source,
        meta.releaseStatus,
        readCityReview(root, city),
        datasetFingerprint(root, city),
      );
      // Candidate CI stays useful; publishing remains blocked by these same
      // errors even if only sources.json's candidate flag is changed or removed.
      if (status === "verified") errors.push(...reviewErrors);
      writeFileSync(
        join(out, "mashhad-release-review.json"),
        JSON.stringify(
          {
            city,
            sourcePinnedCommit: source.pinnedCommit,
            datasetSha256: datasetFingerprint(root, city),
            releaseReady: reviewErrors.length === 0,
            blockers: reviewErrors,
            warning:
              "Structural checks and a digest do not independently verify passenger service. Maintainer review is required.",
            boardingClaims: graph.routes.flatMap((route) =>
              route.stops.map((stop) => ({
                stationId: stop.stationId,
                lineId: route.lineId,
                assertedStatus: stop.status ?? "unknown",
              })),
            ),
            interchangeStations: stations
              .filter((station) => {
                const lines = new Set(
                  graph.routes
                    .filter((route) =>
                      route.stops.some((stop) => stop.stationId === station.id),
                    )
                    .map((route) => route.lineId),
                );
                return lines.size > 1;
              })
              .map((station) => ({
                stationId: station.id,
                names: station.names,
                lines: graph.routes
                  .filter((route) =>
                    route.stops.some((stop) => stop.stationId === station.id),
                  )
                  .map((route) => route.lineId),
                note: "Confirm interchange access and directional walking durations with evidence; no default time is approval.",
              })),
          },
          null,
          2,
        ) + "\n",
      );
    }
    table.push(
      `| ${city} | ${status} | ${stations.length} | ${lines.length} | ${graph.segments.length} | ${inspected.unknownAmenities} | ${claimsCount} |`,
    );
  }
  const json = {
    tool: "metto-data quality audit v1",
    errors,
    warnings,
    byCity: table,
  };
  writeFileSync(
    join(out, "quality-report.json"),
    JSON.stringify(json, null, 2) + "\n",
  );
  const markdown = [
    "# Transit data quality audit",
    "",
    "| City | Release status | Stations | Lines | Segments | Unknown amenity values | Unverified source facility claims |",
    "|---|---|---:|---:|---:|---:|---:|",
    ...table,
    "",
    "## Blocking errors",
    ...(errors.length ? errors.map((x) => "- " + x) : ["None"]),
    "",
    "## Manual-review warnings",
    ...warnings.map((x) => "- " + x),
    "",
    "Raw Mashhad facility claims remain unverified candidate evidence. Only explicitly reviewed, approved field corrections may enter canonical amenities; approving one field does not verify every facility.",
    "The separate mashhad-path-review.json covers only the first Lines 1/2 path scope (36 stations). It distinguishes dated line-level reports from station-specific evidence, excludes timing and Line 3, and never grants release approval.",
    "",
  ].join("\n");
  writeFileSync(join(out, "quality-report.md"), markdown);
  return { errors, warnings };
}
const invoked =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invoked) {
  try {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..");
    const result = generateReport(root, join(root, ".quality-report"));
    console.log(
      `quality report: ${result.errors.length} errors, ${result.warnings.length} review warnings`,
    );
    if (result.errors.length) {
      result.errors.forEach((x) => console.error(x));
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("quality report fatal", error);
    process.exitCode = 1;
  }
}
