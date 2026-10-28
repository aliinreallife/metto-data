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
});
