import { describe, expect, it } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { buildMashhad } from "../importers/mashhad.js";
import { validateDataset, validateCityDir } from "../validators/validate.js";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const built = () => buildMashhad(root);

describe("mashhad candidate importer", () => {
  it("builds all 38 unique station records and 24/13/4 line memberships", () => {
    const result = built();
    expect(result.stations).toHaveLength(38);
    expect(result.lines).toHaveLength(3);
    expect(result.graph.routes.map(r => r.stops.length)).toEqual([24,13,4]);
    expect(result.graph.segments).toHaveLength(38);
    expect(new Set(result.stations.map(s => s.id)).size).toBe(38);
    expect(validateDataset(result)).toEqual([]);
  });
  it("keeps OSM-evidenced Fajr separate from Velayat", () => {
    const s = new Map(built().stations.map(s => [s.id, s]));
    expect(s.get("mashhad:station:fajr")?.location).toEqual({lat:36.31281,lng:59.65543});
    expect(s.get("mashhad:station:velayat")?.location).not.toEqual(s.get("mashhad:station:fajr")?.location);
    const raw = JSON.parse(readFileSync(join(root,"upstream-mashhad-metro","data","stations.json"),"utf8"));
    expect(raw.Fajr.latitude).toEqual(raw.Velayat.latitude); // Provenance stays untouched.
  });
  it("does not advertise unsupported facilities or invented transfer times", () => {
    const result = built();
    for (const s of result.stations) {
      expect(s.amenitiesVerified).toBe(false);
      expect(Object.values(s.amenities).every(v => v === null)).toBe(true);
    }
    expect(result.graph.transfers).toEqual([]);
  });
  it("models only the four Line 3 boarding nodes in the candidate topology", () => {
    const route = built().graph.routes.find(x => x.lineId === "mashhad:line:3");
    expect(route?.stops.map(s => s.stationId)).toEqual([
      "mashhad:station:imam-reza-terminal", "mashhad:station:basij",
      "mashhad:station:bab-al-javad", "mashhad:station:shohada",
    ]);
  });
  it("rejects duplicate coordinates instead of publishing conflicting stations", () => {
    const temp = mkdtempSync(join(tmpdir(),"mashhad-import-"));
    try {
      for (const f of ["sources.json"]) cpSync(join(root,f),join(temp,f));
      for (const [directory,file] of [
        ["upstream-mashhad-metro/data","stations.json"], ["topology","mashhad.routes.json"],
        ["overrides","mashhad.overrides.json"],
      ]) {
        mkdirSync(join(temp,directory),{recursive:true});
        cpSync(join(root,directory,file),join(temp,directory,file));
      }
      const overridePath = join(temp,"overrides","mashhad.overrides.json");
      const overrides = JSON.parse(readFileSync(overridePath,"utf8"));
      overrides.corrections[0].location = { lat:36.31704797082743,lng:59.66217756632278 };
      writeFileSync(overridePath,JSON.stringify(overrides));
      expect(() => buildMashhad(temp)).toThrow(/duplicate station coordinates/);
    } finally { rmSync(temp,{recursive:true,force:true}); }
  });
  it("validates the generated machine-readable release candidate", () => {
    expect(validateCityDir(join(root,"data","cities","mashhad"),"mashhad")).toEqual([]);
    const m = JSON.parse(readFileSync(join(root,"data","cities","mashhad","meta.json"),"utf8"));
    expect(m.upstream.commit).toBe("f5d5c78816a8cc360bb9ae00db8fb8bad23a29e0");
  });
});
