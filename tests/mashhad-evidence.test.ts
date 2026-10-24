import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import snapshot from "../sources/mashhad/osm-review-snapshot.json" with { type: "json" };
import review from "../sources/mashhad/review.json" with { type: "json" };
import graph from "../data/cities/mashhad/graph.json" with { type: "json" };
import corrections from "../overrides/mashhad.overrides.json" with { type: "json" };

describe("Mashhad independently retrieved OSM evidence", () => {
  it("pins the archived evidence bytes and attributes the licensed source", () => {
    const bytes = readFileSync(new URL("../sources/mashhad/osm-review-snapshot.json", import.meta.url));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(review.evidenceArtifacts[0].sha256);
    expect(snapshot.license).toBe("ODbL-1.0");
    expect(snapshot.attribution).toContain("OpenStreetMap contributors");
  });

  it("corroborates the rounded Fajr correction without replacing it with Velayat", () => {
    const node = snapshot.fajrRepresentativePoint.node;
    expect(node.id).toBe(14133541209);
    expect(node.version).toBe(2);
    const fix = corrections.corrections.find((c) => c.upstreamKey === "Fajr")!.location!;
    expect(fix.lat).toBeCloseTo(node.lat!, 5);
    expect(fix.lng).toBeCloseTo(node.lon!, 5);
  });

  it.each([1, 2])("records matching candidate and OSM stop order for Line %i", (line) => {
    const evidence = snapshot.routes.find((r) => r.lineId === `mashhad:line:${line}`)!;
    const route = graph.routes.find((r) => r.lineId === evidence.lineId)!;
    expect(evidence.reviewedCandidateStationIds).toEqual(route.stops.map((s) => s.stationId));
    expect(evidence.nodes.map((n) => n.id)).toEqual(evidence.stopMembers.map((m) => m.ref));
    expect(evidence.nodes).toHaveLength(line === 1 ? 24 : 13);
  });

  it("preserves the older OSM conflict while recording newer boarding evidence outside the initial scope", () => {
    const line3 = snapshot.routes.find((r) => r.lineId === "mashhad:line:3")!;
    expect(line3.nodes).toHaveLength(3);
    expect(snapshot.basijLine3Stop.tags.railway).toBe("proposed");
    const basij = review.observations.find((o) => o.id === "line3-basij");
    expect(basij?.status).toBe("corroborated-dated-report");
    expect(basij?.sources).toContain("Shahrara report 436562, published 2026-08-09");
    expect(review.deliveryPlan.initialLinesUnderReview).not.toContain("mashhad:line:3");
    expect(review.deliveryPlan.arrivalEstimates).toBe(false);
    expect(review.deliveryPlan.travelTimeEstimates).toBe(false);
    expect(review.reviewStatus).toBe("needs-verification");
  });
});
