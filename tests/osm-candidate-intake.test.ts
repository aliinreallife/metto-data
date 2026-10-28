import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("review-only Overpass candidate collection", () => {
  it("retains immutable OSM entity versions, hashes and unresolved status", () => {
    const dir = mkdtempSync(join(tmpdir(), "metto-osm-"));
    try {
      const raw = {
        osm3s: { timestamp_osm_base: "2026-10-28T00:00:00Z" },
        elements: [
          { type: "node", id: 501, version: 4, lat: 32.65, lon: 51.67,
            tags: { name: "Sample", "name:fa": "نمونه", railway: "station", station: "subway" } },
          { type: "way", id: 502, version: 2, center: {lat: 32.66, lon: 51.68},
            tags: { name: "Platform", public_transport: "platform" } },
          { type: "node", id: 503, version: 1, lat: 40, lon: 51.67,
            tags: { name: "Unrelated", railway: "station" } },
          { type: "node", id: 504, version: 3, lat: 32.65, lon: 51.67,
            tags: { amenity: "cafe", name: "Nope" } },
        ],
      };
      const file = join(dir, "input.json");
      writeFileSync(file, JSON.stringify(raw), "utf8");
      execFileSync(process.execPath, ["scripts/osm-candidate-intake.mjs",
        "--city", "isfahan", "--input", file], { encoding: "utf8" });
      const report = JSON.parse(readFileSync(".quality-report/isfahan-osm-candidates.json", "utf8"));
      expect(report.reviewOnly).toBe(true);
      expect(report.source.license).toBe("ODbL-1.0");
      expect(report.source.attribution).toContain("OpenStreetMap");
      expect(report.source.rawInputSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(report.counts).toEqual({ candidates: 3, withCoordinates: 3, outsideReviewBox: 1 });
      expect(report.candidates.map((x: {osm: {id:number}}) => x.osm.id)).toEqual([501,503,502]);
      for (const record of report.candidates) {
        expect(record.boardingVerified).toBe(false);
        expect(record.approvedForProduction).toBe(false);
        expect(record.routeMembershipVerified).toBe(false);
      }
      expect(Object.values(report.releaseGate).every((v) => v === false)).toBe(true);
      expect(report.candidates[0].osm.version).toBe(4);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects invalid or incomplete Overpass files (no invented coordinates)", () => {
    const dir = mkdtempSync(join(tmpdir(), "metto-osm-invalid-"));
    try {
      const file = join(dir, "bad.json");
      writeFileSync(file, JSON.stringify({ elements: [] }), "utf8");
      expect(() => execFileSync(process.execPath, ["scripts/osm-candidate-intake.mjs",
        "--city", "shiraz", "--input", file], { stdio: "pipe" })).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
