import stationEvidence from "../sources/shiraz/station-evidence.json" with { type: "json" };
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import review from "../sources/shiraz/review.json" with { type: "json" };
import registry from "../sources.json" with { type: "json" };

describe("shiraz intake remains research-only", () => {
  it("records a candidate rather than silently publishing a graph", () => {
    expect(review.cityId).toBe("shiraz");
    expect(review.releaseStatus).toBe("candidate");
    expect(review.reviewOnly).toBe(true);
    expect(review.productionAuthorized).toBe(false);
    expect(review.publishingGate).toBe("blocked");
    expect(Object.hasOwn(registry, "shiraz")).toBe(false);
    expect(existsSync(join(process.cwd(), "data", "cities", "shiraz", "graph.json"))).toBe(false);
  });
  it("keeps station leads separate from verified route edges", () => {
    expect(review.candidateLines).toHaveLength(2);
    expect(review.candidateLines[0].orderedStopNamesFa).toHaveLength(20);
    expect(review.candidateLines[1].orderedStopNamesFa).toHaveLength(7);
    expect(review.candidateLines[0].orderedStopNamesFa.filter((s) => review.candidateLines[1].orderedStopNamesFa.includes(s))).toEqual(["امام حسین"]);
    for (const line of review.candidateLines) {
      expect(line.orderVerified).toBe(false);
      expect(new Set(line.orderedStopNamesFa).size).toBe(line.orderedStopNamesFa.length);
      expect(line.orderedStopNamesFa.every((name) => typeof name === "string" && name.trim().length > 1)).toBe(true);
    }
  });
  it("requires provenance, conflict resolution and explicit release approval", () => {
    expect(review.sources.length).toBeGreaterThanOrEqual(3);
    expect(review.sources.every((s) => s.url.startsWith("https://") && s.contentRedistributed === false)).toBe(true);
    expect(review.conflictingClaims.length).toBeGreaterThanOrEqual(2);
    expect(review.outstandingGates.length).toBeGreaterThanOrEqual(6);
    expect(review.noCoordinatesCopied).toBe(true);
    expect(review.noTimetables).toBe(true);
    expect(review.noFacilityClaims).toBe(true);
    expect(review.noTravelTimeEstimates).toBe(true);
  });
  it("tracks 27 candidate line memberships with 26 distinct names and immutable source URLs", () => {
    expect(stationEvidence.releaseStatus).toBe("candidate");
    expect(stationEvidence.stationReviews).toHaveLength(27);
    expect(new Set(stationEvidence.stationReviews.map((r) => r.candidateNameFa)).size).toBe(26);
    expect(stationEvidence.stationReviews.filter((r) => r.lineId === "shiraz:line:1").map((r) => r.candidateNameFa)).toEqual(review.candidateLines[0].orderedStopNamesFa);
    expect(stationEvidence.stationReviews.filter((r) => r.lineId === "shiraz:line:2").map((r) => r.candidateNameFa)).toEqual(review.candidateLines[1].orderedStopNamesFa);
    const ids = new Set(stationEvidence.sourceLedger.map((s) => s.id));
    for (const s of stationEvidence.stationReviews) {
      expect(s.serviceTodayVerified).toBe(false);
      expect(s.coordinateReview).toBe("missing-licensed-element");
      expect(s.coordinates).toBeNull();
      expect(s.osmElement).toBeNull();
      expect(s.sourceIds.every((id) => ids.has(id))).toBe(true);
    }
    expect(stationEvidence.stationReviews.filter((s) => s.boardingReview === "dated-operator-opening-report").map((s) => s.candidateNameFa)).toEqual(["استقلال"]);
    expect(Object.values(stationEvidence.releaseGates).every((v) => v === false)).toBe(true);
  });

  it("models order conflict and nonboarding infrastructure without producing an edge", () => {
    const hypotheses = stationEvidence.line2OrderHypotheses;
    expect(hypotheses).toHaveLength(2);
    expect(hypotheses[0].boardingNamesFa).toEqual(review.candidateLines[1].orderedStopNamesFa);
    expect([...hypotheses[1].boardingNamesFa].sort()).toEqual([...hypotheses[0].boardingNamesFa].sort());
    expect(hypotheses[1].boardingNamesFa).not.toEqual(hypotheses[0].boardingNamesFa);
    expect(stationEvidence.line2TrackGapReview).toHaveLength(1);
    expect(stationEvidence.line2TrackGapReview[0].edgeInferenceAllowed).toBe(false);
    expect(stationEvidence.line2TrackGapReview[0].intermediateNamedStation).toBe("۱۵ خرداد");
    expect(stationEvidence.interchangeClaims.every((t) => t.transferLinksVerified === false && t.walkSeconds === null)).toBe(true);
  });

  it("requires raw pinned OSM members rather than treating Wikidata linkage as a route", () => {
    const r = stationEvidence.rawOsmIntake;
    expect(r.candidateLine2.type).toBe("relation");
    expect(r.candidateLine2.id).toBe(15510494);
    expect(r.candidateLine2.discoveredFromSourceId).toBe("wikidata-q97218492");
    expect(r.candidateLine2.version).toBeNull();
    expect(r.candidateLine2.rawElementSnapshotSha256).toBeNull();
    expect(r.candidateLine2.memberElementsCaptured).toBe(false);
    expect(r.line1.id).toBeNull();
    expect(r.interchangeAccessVerified).toBe(false);
    expect(r.currentGraphApproval).toBe("blocked");
    expect(stationEvidence.releaseGates.rawOsmElementsVersionPinned).toBe(false);
    expect(stationEvidence.releaseGates.routeMemberRolesReconciled).toBe(false);
    expect(stationEvidence.reviewPriority).toHaveLength(4);
  });

});
