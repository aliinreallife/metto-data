import stationEvidence from "../sources/isfahan/station-evidence.json" with { type: "json" };
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import review from "../sources/isfahan/review.json" with { type: "json" };
import registry from "../sources.json" with { type: "json" };

describe("isfahan intake remains research-only", () => {
  it("records a candidate, not a secretly registered city dataset", () => {
    expect(review.cityId).toBe("isfahan");
    expect(review.releaseStatus).toBe("candidate");
    expect(review.reviewOnly).toBe(true);
    expect(review.productionAuthorized).toBe(false);
    expect(review.publishingGate).toBe("blocked");
    expect(Object.hasOwn(registry, "isfahan")).toBe(false);
    expect(existsSync(join(process.cwd(), "data", "cities", "isfahan", "graph.json"))).toBe(false);
  });
  it("keeps ordered station-name leads separate from verified route graphs", () => {
    expect(review.candidateLines).toHaveLength(1);
    expect(review.candidateLines[0].orderedStopNamesFa).toHaveLength(20);
    expect(review.linesExcludedFromRouting.map((line) => line.lineId)).toContain("isfahan:line:2");
    for (const line of review.candidateLines) {
      expect(line.orderVerified).toBe(false);
      expect(new Set(line.orderedStopNamesFa).size).toBe(line.orderedStopNamesFa.length);
      expect(line.orderedStopNamesFa.every((name) => typeof name === "string" && name.trim().length > 1)).toBe(true);
    }
  });
  it("requires provenance, conflict review and explicit release approval", () => {
    expect(review.sources.length).toBeGreaterThanOrEqual(3);
    expect(review.sources.every((s) => s.url.startsWith("https://") && s.contentRedistributed === false)).toBe(true);
    expect(review.conflictingClaims.length).toBeGreaterThanOrEqual(2);
    expect(review.outstandingGates.length).toBeGreaterThanOrEqual(6);
    expect(review.noCoordinatesCopied).toBe(true);
    expect(review.noTimetables).toBe(true);
    expect(review.noFacilityClaims).toBe(true);
    expect(review.noTravelTimeEstimates).toBe(true);
  });
  it("requires a source-linked record for every candidate Line 1 stop before publishing", () => {
    const evidence = stationEvidence;
    expect(evidence.releaseStatus).toBe("candidate");
    expect(evidence.stationCount).toBe(20);
    expect(evidence.stationReviews.map((s) => s.candidateNameFa)).toEqual(review.candidateLines[0].orderedStopNamesFa);
    expect(evidence.stationReviews.map((s) => s.sourceOrdinal)).toEqual(Array.from({length:20}, (_,i) => i+1));
    const sourceIds = new Set(evidence.sourceLedger.map((s) => s.id));
    for (const s of evidence.stationReviews) {
      expect(s.currentServiceConfirmed).toBe(false);
      expect(s.coordinateReview).toBe("missing-licensed-element");
      expect(s.coordinates).toBeNull();
      expect(s.osmElement).toBeNull();
      expect(s.sourceIds.every((id) => sourceIds.has(id))).toBe(true);
      expect(s.boardingReview === "not-station-verified" || s.boardingReview === "conflicting-reports").toBe(true);
    }
    expect(evidence.stationReviews.filter((s) => s.boardingReview === "conflicting-reports").map((s) => s.candidateNameFa)).toEqual(["دانشگاه", "کارگر"]);
    expect(Object.values(evidence.releaseGates).every((v) => v === false)).toBe(true);
    expect(evidence.lines.find((l) => l.lineId === "isfahan:line:2")?.boardingVerification).toBe("blocked");
  });

  it("keeps historical 2018 opening separate from current unverified boarding", () => {
    const history = stationEvidence.historicalOpeningReview;
    expect(history.historicalOpeningSupported).toBe(true);
    expect(history.currentBoardingClaim).toBe("unresolved");
    expect(history.sourceIds).toContain("tasnim-1396-12-27");
    expect(history.decision).toBe("do-not-automatically-mark-open-or-closed");
    const disputed = stationEvidence.stationReviews.filter((s) => history.stationsOfInterest.includes(s.candidateNameFa));
    expect(disputed).toHaveLength(2);
    for (const s of disputed) {
      expect(s.boardingReview).toBe("conflicting-reports");
      expect(s.currentServiceConfirmed).toBe(false);
      expect(s.coordinates).toBeNull();
      expect(s.sourceIds).toContain("tasnim-1396-12-27");
      expect(s.historicalOpeningEvidence).toBe("trial-opening-corridor-2018");
    }
  });

});
