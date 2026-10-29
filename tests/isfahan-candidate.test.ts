import { afterEach, expect, it } from "vitest";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { buildIsfahanCandidate } from "../importers/isfahan-candidate.js";
const roots: string[] = [];
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const write = (p: string, value: unknown) =>
  writeFileSync(p, JSON.stringify(value));
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "isfahan-candidate-"));
  roots.push(root);
  mkdirSync(join(root, "sources"), { recursive: true });
  cpSync("sources/isfahan", join(root, "sources/isfahan"), { recursive: true });
  cpSync("sources/review-snapshots", join(root, "sources/review-snapshots"), {
    recursive: true,
  });
  return root;
}
function editRoute(root: string, index: number, edit: (doc: any) => void) {
  const configPath = join(root, "sources/isfahan/candidate-inputs.json"),
    config = read(configPath),
    source = config.routes[index];
  const path = join(root, source.path),
    doc = read(path);
  edit(doc);
  write(path, doc);
  source.sha256 = createHash("sha256").update(readFileSync(path)).digest("hex");
  write(configPath, config);
}
function editIdentities(root: string, edit: (doc: any) => void) {
  const path = join(root, "sources/isfahan/station-identities.json"),
    doc = read(path);
  edit(doc);
  write(path, doc);
}
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

it("reconciles 20 identities and both mapped directions with complete sourced rail geometry", () => {
  const report = buildIsfahanCandidate(process.cwd());
  expect(report.counts).toEqual({
    stations: 20,
    mappedRoutes: 2,
    physicalLinks: 38,
    inactiveStopMembers: 5,
    excludedWays: 6,
  });
  expect(report.routes[0].mappedStationIds).toEqual(
    [...report.routes[1].mappedStationIds].reverse(),
  );
  expect(report.routes[0].source).toMatchObject({
    type: "relation",
    id: 5587340,
    version: 33,
  });
  expect(report.routes[1].source).toMatchObject({
    type: "relation",
    id: 7705632,
    version: 18,
  });
  for (const link of report.physicalLinks) {
    expect(link.geometry.length).toBe(link.pathNodeIds.length);
    expect(link.geometry.length).toBeGreaterThan(1);
    expect(
      link.sourceWays.every((w) =>
        [364976148, 399299024, 917553488].includes(w.id),
      ),
    ).toBe(true);
    expect(link.passengerRoutingApproved).toBe(false);
  }
  expect(
    report.stations.every(
      (s) =>
        Object.values(s.amenities).every((v) => v === null) &&
        !s.currentServiceConfirmed &&
        !s.coordinatesIndependentlyVerified,
    ),
  ).toBe(true);
  expect(Object.values(report.releaseGates).every((v) => v === false)).toBe(
    true,
  );
  expect(report.format).toBe("isfahan-osm-review-graph-v1");
  expect(report.readyForProduction).toBe(false);
  expect(read("sources.json")).not.toHaveProperty("isfahan");
  expect(existsSync("data/cities/isfahan")).toBe(false);
});
it("does not merge the inactive extension's Baharestan with the core station", () => {
  const r = buildIsfahanCandidate(process.cwd()),
    core = r.stations.find((s) => s.id === "isfahan:station:baharestan")!;
  expect(core.sourceRefs.stopPosition.id).toBe(3787736361);
  expect(
    r.omittedInfrastructure.inactiveStopMembers.find(
      (s) => s.name === "بهارستان",
    )?.source.id,
  ).toBe(7694192090);
  expect(r.physicalLinks.some((e) => e.pathNodeIds.includes(7694192090))).toBe(
    false,
  );
  expect(r.omittedInfrastructure.excludedNonExistingRailWays).toHaveLength(6);
  expect(r.transfers).toEqual([]);
});
it("retains the explicit aliases and unresolved boarding evidence", () => {
  const r = buildIsfahanCandidate(process.cwd());
  expect(
    r.stations.find((s) => s.id === "isfahan:station:si-o-se-pol")?.aliasesFa,
  ).toContain("سی و سه پل");
  expect(
    r.stations.find((s) => s.id === "isfahan:station:shariati")?.aliasesFa,
  ).toContain("شریعتی");
  expect(
    r.stations.find((s) => s.id === "isfahan:station:defa-e-moghaddas")
      ?.aliasesFa,
  ).toContain("صفه");
  expect(
    r.stations
      .filter((s) => s.boardingReview === "conflicting-reports")
      .map((s) => s.names.fa),
  ).toEqual(["دانشگاه", "کارگر"]);
  expect(JSON.stringify(r)).not.toMatch(
    /"(travelSeconds|walkSeconds|timetable|headway|eta)":/,
  );
});
it("is deterministic and never writes canonical city files", () => {
  const root = fixture();
  expect(buildIsfahanCandidate(root)).toEqual(buildIsfahanCandidate(root));
  expect(existsSync(join(root, "data"))).toBe(false);
});
it("rejects a changed raw source and a changed object version", () => {
  const root = fixture(),
    config = read(join(root, "sources/isfahan/candidate-inputs.json"));
  writeFileSync(join(root, config.routes[0].path), " ", { flag: "a" });
  expect(() => buildIsfahanCandidate(root)).toThrow(/hash mismatch/);
  const other = fixture();
  editIdentities(other, (d) => d.stations[0].stationObject.version++);
  expect(() => buildIsfahanCandidate(other)).toThrow(/changed object/);
});
it("rejects missing geometry members and disconnected track", () => {
  const root = fixture();
  editRoute(
    root,
    0,
    (d) =>
      (d.elements = d.elements.filter(
        (e: any) => !(e.type === "node" && e.id === 3690028835),
      )),
  );
  expect(() => buildIsfahanCandidate(root)).toThrow(/Missing referenced/);
  const other = fixture();
  editRoute(other, 0, (d) => {
    const r = d.elements.find(
      (e: any) => e.type === "relation" && e.id === 5587340,
    );
    r.members = r.members.filter(
      (m: any) => !(m.type === "way" && m.ref === 399299024),
    );
  });
  expect(() => buildIsfahanCandidate(other)).toThrow(/corridor/);
});
it("rejects invented order and promotion of an inactive source stop", () => {
  const root = fixture();
  editRoute(root, 0, (d) => {
    const r = d.elements.find(
        (e: any) => e.type === "relation" && e.id === 5587340,
      ),
      stops = r.members.filter((m: any) => m.role === "stop");
    [stops[2].ref, stops[3].ref] = [stops[3].ref, stops[2].ref];
  });
  expect(() => buildIsfahanCandidate(root)).toThrow(/stop order/);
  const other = fixture();
  editRoute(other, 1, (d) => {
    const r = d.elements.find(
      (e: any) => e.type === "relation" && e.id === 7705632,
    );
    r.members.find((m: any) => m.role === "stop_inactive").role = "stop";
  });
  expect(() => buildIsfahanCandidate(other)).toThrow(/stop order/);
});
it("rejects street routing, construction and unsupported one-way track assumptions", () => {
  for (const tags of [
    { railway: "highway" },
    { railway: "construction", construction: "subway" },
    { railway: "subway", oneway: "yes" },
  ]) {
    const root = fixture();
    editRoute(root, 0, (d) => {
      const w = d.elements.find(
        (e: any) => e.type === "way" && e.id === 399299024,
      );
      Object.assign(w.tags, tags);
    });
    expect(() => buildIsfahanCandidate(root)).toThrow();
  }
});
it("rejects name-based identity collisions and unreviewed aliases", () => {
  const root = fixture();
  editIdentities(
    root,
    (d) => (d.stations[1].stationObject = d.stations[0].stationObject),
  );
  expect(() => buildIsfahanCandidate(root)).toThrow(/identity/);
  const other = fixture();
  editIdentities(
    other,
    (d) => (d.stations[14].aliasesFa = [d.stations[14].names.fa]),
  );
  expect(() => buildIsfahanCandidate(other)).toThrow(/reviewed alias/);
});
it("cannot turn research or boarding gates on through an input flag", () => {
  const root = fixture();
  editIdentities(root, (d) => (d.productionApproved = true));
  expect(() => buildIsfahanCandidate(root)).toThrow(/blocked/);
  const other = fixture();
  editIdentities(other, (d) => (d.stations[16].currentServiceConfirmed = true));
  expect(() => buildIsfahanCandidate(other)).toThrow(/status mismatch/);
});
