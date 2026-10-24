import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { buildMashhadPathReview } from "../scripts/mashhad-path-review.js";
import { datasetFingerprint } from "../validators/release-review.js";
import service from "../sources/mashhad/service-evidence.json" with { type: "json" };
import osm from "../sources/mashhad/osm-review-snapshot.json" with { type: "json" };
import graph from "../data/cities/mashhad/graph.json" with { type: "json" };
import stations from "../data/cities/mashhad/stations.json" with { type: "json" };
import review from "../sources/mashhad/review.json" with { type: "json" };
import type { CityGraph, Station } from "../schema/v1/types.js";
import { fileURLToPath } from "node:url";

function input() {
  const hash = (path: string) => createHash("sha256").update(readFileSync(new URL(path, import.meta.url))).digest("hex");
  return {
    graph: structuredClone(graph) as CityGraph, stations: structuredClone(stations) as Station[],
    service: structuredClone(service), osm: structuredClone(osm),
    datasetSha256: datasetFingerprint(fileURLToPath(new URL("..", import.meta.url)), "mashhad"),
    serviceEvidenceSha256: hash("../sources/mashhad/service-evidence.json"),
    osmEvidenceSha256: hash("../sources/mashhad/osm-review-snapshot.json"),
  };
}

describe("Mashhad first-scope evidence packet", () => {
  it("includes exactly 36 stations, 37 boarding claims, 35 edges and two untimed Shariati directions", () => {
    const report = buildMashhadPathReview(input());
    expect(report.counts).toEqual({ stations: 36, lines: 2, boardingClaims: 37, segments: 35, directedInterchanges: 2 });
    expect(report.integrityGaps).toEqual([]);
    expect(report.topology.every(t => t.orderedStopsMatch)).toBe(true);
    expect(report.boardingClaims.every(c => c.lineServiceClaimIds.length > 0)).toBe(true);
    expect(report.boardingClaims.every(c => c.individuallyFieldVerified === false)).toBe(true);
    expect(report.interchangeClaims.map(c => [c.fromLineId, c.toLineId])).toEqual([
      ["mashhad:line:1", "mashhad:line:2"], ["mashhad:line:2", "mashhad:line:1"],
    ]);
    expect(report.interchangeClaims.every(c => c.stationId === "mashhad:station:shariati")).toBe(true);
    expect(JSON.stringify(report.interchangeClaims)).not.toMatch(/walkSeconds|duration|arrival|headway/);
    expect(report.releaseReady).toBe(false);
    expect(report.approval).toBe("not-granted");
    expect(report.manualReviewOutstanding.length).toBeGreaterThan(0);
    expect(report.evidenceSha256.service).toBe(review.evidenceArtifacts.find(a => a.path.endsWith("/service-evidence.json"))?.sha256);
  });

  it("keeps Basij's newer opening evidence and future Line 3 work outside the initial scope", () => {
    const report = buildMashhadPathReview(input());
    expect(service.claims.find(c => c.id === "basij-passenger-opening")?.sourceIds).toContain("shahrara-436562");
    expect(report.supportingClaims.some(c => c.lineIds.includes("mashhad:line:3"))).toBe(false);
    expect(report.excludedLineIds).toEqual(["mashhad:line:3"]);
    expect(report.scope.arrivalEstimates).toBe(false);
    expect(report.scope.travelTimeEstimates).toBe(false);
    expect(report.notRequiredForThisScope.join(" ")).toContain("Measured interchange walking duration");
  });

  it("requires explicit evidence for each interchange and refuses invented transfer times", () => {
    const missing = input(); missing.service.untimedInterchanges[0].claimIds = ["unknown"];
    expect(() => buildMashhadPathReview(missing)).toThrow(/interchange claim/);
    const timed = input(); Object.assign(timed.service.untimedInterchanges[0], { walkSeconds: 180 });
    expect(() => buildMashhadPathReview(timed)).toThrow(/timed interchange/);
    const closed = input();
    closed.graph.routes[0].stops.find(s => s.stationId === "mashhad:station:shariati")!.status = "under_construction";
    expect(() => buildMashhadPathReview(closed)).toThrow(/interchange claim/);
    const oneWay = input(); oneWay.service.untimedInterchanges.pop();
    expect(buildMashhadPathReview(oneWay).integrityGaps.join(" ")).toMatch(/both directed/);
  });

  it("rejects expansion, timing capability and invalid evidence references", () => {
    const expanded = input(); expanded.service.initialScope.lineIds.push("mashhad:line:3");
    expect(() => buildMashhadPathReview(expanded)).toThrow(/scope/);
    const eta = input(); eta.service.initialScope.arrivalEstimates = true;
    expect(() => buildMashhadPathReview(eta)).toThrow(/timing claims/);
    const unrelated = input(); unrelated.service.claims[0].stationIds.push("tehran:station:tajrish");
    expect(() => buildMashhadPathReview(unrelated)).toThrow(/unknown source or city entity/);
    const invalidSource = input(); invalidSource.service.claims[0].sourceIds.push("nonexistent");
    expect(() => buildMashhadPathReview(invalidSource)).toThrow(/unknown source/);
  });

  it("surfaces missing line-service support and stale ordered topology without granting approval", () => {
    const modified = input(); modified.service.claims = modified.service.claims.filter(c => c.id !== "line2-service");
    modified.osm.routes[0].reviewedCandidateStationIds.reverse();
    const report = buildMashhadPathReview(modified);
    expect(report.integrityGaps.join(" ")).toMatch(/No dated line-service evidence/);
    expect(report.integrityGaps.join(" ")).toMatch(/Ordered OSM/);
    expect(report.releaseReady).toBe(false);
  });

  it("changes the review fingerprint for source evidence, geometry or directed interchange edits", () => {
    const baseline = buildMashhadPathReview(input()).pathReviewSha256;
    const source = input(); source.serviceEvidenceSha256 = "a".repeat(64);
    expect(buildMashhadPathReview(source).pathReviewSha256).not.toBe(baseline);
    const point = input(); point.stations[0].location.lat += 0.001;
    expect(buildMashhadPathReview(point).pathReviewSha256).not.toBe(baseline);
    const direction = input(); direction.service.untimedInterchanges.pop();
    expect(buildMashhadPathReview(direction).pathReviewSha256).not.toBe(baseline);
    const missingHash = input(); missingHash.datasetSha256 = "";
    expect(() => buildMashhadPathReview(missingHash)).toThrow(/fingerprint/);
  });
});
