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
});
