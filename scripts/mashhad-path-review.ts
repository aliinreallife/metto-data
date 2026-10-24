// A review packet for the first path-only scope, never a release approval.
import { createHash } from "node:crypto";
import type { CityGraph, Station } from "../schema/v1/types.js";
import serviceEvidence from "../sources/mashhad/service-evidence.json" with { type: "json" };
import osmEvidence from "../sources/mashhad/osm-review-snapshot.json" with { type: "json" };

export function buildMashhadPathReview(input: {
  graph: CityGraph; stations: Station[]; datasetSha256: string;
  service: typeof serviceEvidence; osm: typeof osmEvidence;
  serviceEvidenceSha256: string; osmEvidenceSha256: string;
}) {
  const { graph, stations, service, osm } = input;
  const scope = service.initialScope;
  const allowedLines = ["mashhad:line:1", "mashhad:line:2"];
  if (service.cityId !== "mashhad" || service.schemaVersion !== 1 || service.reviewOnly !== true ||
      JSON.stringify(scope.lineIds) !== JSON.stringify(allowedLines) || scope.timing !== "none" ||
      scope.arrivalEstimates !== false || scope.travelTimeEstimates !== false) {
    throw new Error("Unexpected Mashhad path-review scope or timing claims");
  }
  for (const digest of [input.datasetSha256, input.serviceEvidenceSha256, input.osmEvidenceSha256]) {
    if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error("Missing path-review input fingerprint");
  }
  const sourceIds = new Set(service.sources.map(s => s.id));
  const claims = new Map(service.claims.map(c => [c.id, c]));
  const stationIds = new Set(stations.map(s => s.id));
  const lineIds = new Set(graph.routes.map(r => r.lineId));
  if (sourceIds.size !== service.sources.length || claims.size !== service.claims.length) throw new Error("Duplicate evidence identity");
  for (const source of service.sources) {
    if (new URL(source.url).protocol !== "https:" || source.contentRedistributed !== false ||
        !Number.isFinite(Date.parse(source.publishedAt)) || !/^\d{4}-\d{2}-\d{2}$/.test(source.retrievedOn) ||
        !Number.isFinite(Date.parse(source.retrievedOn)) || !/^[a-f0-9]{64}$/.test(source.fetchedResponseSha256)) {
      throw new Error("Invalid dated source record");
    }
  }
  for (const claim of service.claims) {
    if (!claim.sourceIds.length || claim.sourceIds.some(id => !sourceIds.has(id)) ||
        !claim.lineIds.length || claim.lineIds.some(id => !lineIds.has(id)) ||
        claim.stationIds.some(id => !stationIds.has(id))) throw new Error("Evidence references an unknown source or city entity");
  }

  const routes = graph.routes.filter(r => allowedLines.includes(r.lineId));
  if (routes.length !== 2 || new Set(routes.map(r => r.lineId)).size !== 2) throw new Error("Unexpected initial route inventory");
  const includedIds = new Set(routes.flatMap(r => r.stops.map(s => s.stationId)));
  const selectedStations = stations.filter(s => includedIds.has(s.id));
  const segments = graph.segments.filter(s => allowedLines.includes(s.lineId));
  const scopedClaims = service.claims.filter(c => c.lineIds.every(id => allowedLines.includes(id)));
  const integrityGaps: string[] = [];
  const topology = routes.map(route => {
    const evidence = osm.routes.find(r => r.lineId === route.lineId);
    const matches = evidence !== undefined && JSON.stringify(evidence.reviewedCandidateStationIds) ===
      JSON.stringify(route.stops.map(s => s.stationId));
    if (!matches) integrityGaps.push(`Ordered OSM stop evidence does not match ${route.lineId}`);
    return { lineId: route.lineId, orderedStopsMatch: matches,
      relationId: evidence?.relation.id ?? null, relationVersion: evidence?.relation.version ?? null };
  });
  const boardingClaims = routes.flatMap(route => {
    const lineServiceClaimIds = scopedClaims.filter(c => c.kind === "line-service" && c.lineIds.includes(route.lineId) &&
      c.status === "corroborated-dated-report").map(c => c.id);
    if (!lineServiceClaimIds.length) integrityGaps.push(`No dated line-service evidence for ${route.lineId}`);
    return route.stops.map(stop => ({ stationId: stop.stationId, lineId: route.lineId, assertedStatus: stop.status,
      lineServiceClaimIds,
      stationSpecificClaimIds: scopedClaims.filter(c => c.lineIds.includes(route.lineId) && c.stationIds.includes(stop.stationId)).map(c => c.id),
      individuallyFieldVerified: false,
    }));
  });
  const interchangeClaims = service.untimedInterchanges.map(link => {
    if (Object.keys(link).some(k => !["stationId", "fromLineId", "toLineId", "claimIds"].includes(k)) ||
        link.fromLineId === link.toLineId || !allowedLines.includes(link.fromLineId) || !allowedLines.includes(link.toLineId) ||
        ![link.fromLineId, link.toLineId].every(lineId => routes.some(r => r.lineId === lineId &&
          r.stops.some(s => s.stationId === link.stationId && s.status === "operational"))) ||
        !selectedStations.some(s => s.id === link.stationId && s.status === "operational") ||
        !link.claimIds.length || link.claimIds.some(id => {
          const c = claims.get(id);
          return !c || c.kind !== "interchange-connectivity" || c.status !== "corroborated-dated-report" ||
            !c.stationIds.includes(link.stationId) || !c.lineIds.includes(link.fromLineId) || !c.lineIds.includes(link.toLineId);
        })) throw new Error("Unsubstantiated, out-of-scope or timed interchange claim");
    return { ...link };
  });
  const directions = interchangeClaims.map(l => `${l.stationId}|${l.fromLineId}|${l.toLineId}`);
  if (new Set(directions).size !== directions.length) throw new Error("Duplicate interchange direction");
  if (interchangeClaims.length !== 2) integrityGaps.push("Review both directed Shariati interchange claims explicitly");
  const projection = { cityId: "mashhad", scope, stations: selectedStations, routes, segments, interchangeClaims };
  const pathReviewSha256 = createHash("sha256").update(JSON.stringify({
    datasetSha256: input.datasetSha256, serviceEvidenceSha256: input.serviceEvidenceSha256,
    osmEvidenceSha256: input.osmEvidenceSha256, projection,
  })).digest("hex");
  return {
    schemaVersion: 1, cityId: "mashhad", reviewOnly: true, releaseReady: false, approval: "not-granted",
    scope, datasetSha256: input.datasetSha256, pathReviewSha256,
    evidenceSha256: { service: input.serviceEvidenceSha256, osm: input.osmEvidenceSha256 },
    counts: { stations: selectedStations.length, lines: routes.length, boardingClaims: boardingClaims.length,
      segments: segments.length, directedInterchanges: interchangeClaims.length },
    excludedLineIds: [...lineIds].filter(id => !allowedLines.includes(id)),
    topology, boardingClaims, interchangeClaims, supportingClaims: scopedClaims,
    sourceRecords: service.sources.filter(s => scopedClaims.some(c => c.sourceIds.includes(s.id))),
    integrityGaps, manualReviewOutstanding: service.remainingReview,
    notRequiredForThisScope: service.notRequiredForThisScope,
    warning: "Dated reports corroborate facts, not live operation. Line-level evidence is not individual station verification. This packet cannot authorize public routing or override check-release.",
  };
}
