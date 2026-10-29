import { expect, it } from "vitest";
// @ts-expect-error Plain Node research utilities intentionally ship as .mjs.
import { processOSMExport } from "../scripts/osm-candidate-intake.mjs";
// @ts-expect-error Plain Node research utilities intentionally ship as .mjs.
import { completeRelation, parseOSMExport } from "../scripts/osm-export.mjs";
// @ts-expect-error Plain Node research utilities intentionally ship as .mjs.
import { createNameReview } from "../scripts/osm-name-review.mjs";
const station = {
  type: "node",
  id: 1,
  version: 3,
  lat: 29.6,
  lon: 52.5,
  tags: { name: "امام حسین", railway: "station", station: "subway" },
};
const document = (elements: unknown[], extras = {}) =>
  Buffer.from(
    JSON.stringify({
      osm3s: { timestamp_osm_base: "2026-10-28T00:00:00Z" },
      elements,
      ...extras,
    }),
  );
it("candidate intake rejects partial errors, duplicates and missing versions instead of silently dropping objects", () => {
  for (const raw of [
    document([station], { remark: "runtime error: Query timed out" }),
    document([station, { type: "node", id: 2, tags: { railway: "station" } }]),
    document([station, { ...station, version: 4 }]),
  ]) {
    expect(() => processOSMExport(raw, "shiraz")).toThrow();
    expect(() => parseOSMExport(raw)).toThrow();
  }
});
it("rejects invalid metadata before claiming a pinned snapshot", () => {
  for (const timestamp of [null, 0, {}, "invalid"])
    expect(() =>
      parseOSMExport(
        document([station], { osm3s: { timestamp_osm_base: timestamp } }),
      ),
    ).toThrow();
});
it("requires every relation member, nested member and way node; preserves source order and roles", () => {
  const root = {
    type: "relation",
    id: 15510494,
    version: 2,
    members: [
      { type: "relation", ref: 200, role: "forward" },
      { type: "node", ref: 1, role: "stop" },
    ],
  };
  const child = {
    type: "relation",
    id: 200,
    version: 1,
    members: [{ type: "way", ref: 300, role: "" }],
  };
  const way = { type: "way", id: 300, version: 4, nodes: [1, 2] };
  const docs = [root, child, way, station, { ...station, id: 2 }];
  const complete = parseOSMExport(document(docs));
  expect(completeRelation(complete, 15510494)).toEqual(root);
  for (const missing of [child, way, station, docs[4]])
    expect(() =>
      completeRelation(
        parseOSMExport(document(docs.filter((e) => e !== missing))),
        15510494,
      ),
    ).toThrow(/Missing referenced/);
  expect(() =>
    completeRelation(
      parseOSMExport(
        document([
          { ...root, members: [{ type: "node", ref: 1.2, role: "stop" }] },
          station,
        ]),
      ),
      15510494,
    ),
  ).toThrow(/Invalid member/);
});
it("handles cyclic memberships without inventing extra topology", () => {
  const relation = {
    type: "relation",
    id: 15510494,
    version: 1,
    members: [{ type: "relation", ref: 15510494, role: "" }],
  };
  expect(
    completeRelation(parseOSMExport(document([relation])), 15510494),
  ).toEqual(relation);
});
it("name review rejects malformed or conflicting identities and approval-bearing inputs", () => {
  const report = processOSMExport(document([station]), "shiraz");
  const matrix = {
    cityId: "shiraz",
    releaseStatus: "candidate",
    releaseGates: { approved: false },
    stationReviews: [
      { lineId: "shiraz:line:1", candidateNameFa: "امام حسین" },
      { lineId: "shiraz:line:2", candidateNameFa: "امام حسین" },
    ],
  };
  const review = (r: unknown) => createNameReview(r, matrix, "a".repeat(64));
  expect(review(report).entries[0].possibleOsm[0].versionUrl).toBe(
    "https://www.openstreetmap.org/node/1/history/3",
  );
  expect(review(report).entries[0].memberships).toBe(2);
  for (const change of [
    { osm: { type: "node", id: 1, version: undefined } },
    { osm: { type: "node", id: 1.5, version: 1 } },
    { approvedForProduction: true },
    { boardingVerified: true },
  ])
    expect(() =>
      review({
        ...report,
        candidates: [{ ...report.candidates[0], ...change }],
      }),
    ).toThrow();
  expect(() =>
    review({
      ...report,
      candidates: [...report.candidates, ...report.candidates],
    }),
  ).toThrow(/Duplicate/);
  expect(() =>
    review({ ...report, releaseGate: { operatorApproved: true } }),
  ).toThrow();
});
