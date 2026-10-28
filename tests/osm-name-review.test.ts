import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("review-only OSM station-name cross-reference", () => {
  it("flags ambiguous OSM objects and keeps shared physical name leads separate from memberships", () => {
    const dir = mkdtempSync(join(tmpdir(), "metto-osm-name-"));
    try {
      const source = {
        cityId: "shiraz", reviewOnly: true,
        source: { rawInputSha256: "a".repeat(64), observedOsmBase: "2026-10-28T00:00:00Z" },
        candidates: [
          { osm: { type: "node", id: 812, version: 3 }, nameFa: "امام حسين", name: null,
            tags: { railway: "station" }, representativePoint: { lat: 29.61, lng: 52.55 },
            positionReview: "in-search-box-unverified" },
          { osm: { type: "node", id: 813, version: 2 }, nameFa: "امام حسین", name: null,
            tags: { railway: "platform" }, representativePoint: { lat: 29.612, lng: 52.552 },
            positionReview: "in-search-box-unverified" },
          { osm: { type: "node", id: 814, version: 1 }, nameFa: null, name: "ایستگاه مترو شهید دوران",
            tags: { railway: "station" }, representativePoint: { lat: 29.6, lng: 52.55 },
            positionReview: "in-search-box-unverified" },
        ],
      };
      const matrix = { cityId: "shiraz", releaseStatus: "candidate",
        releaseGates: { approved: false },
        stationReviews: [
          { lineId: "shiraz:line:1", candidateNameFa: "امام حسین" },
          { lineId: "shiraz:line:2", candidateNameFa: "امام حسین" },
          { lineId: "shiraz:line:1", candidateNameFa: "شهید دوران" },
          { lineId: "shiraz:line:2", candidateNameFa: "استقلال" },
        ],
      };
      const candidatesFile = join(dir, "candidates.json");
      const matrixFile = join(dir, "matrix.json");
      writeFileSync(candidatesFile, JSON.stringify(source));
      writeFileSync(matrixFile, JSON.stringify(matrix));
      const argv = ["scripts/osm-name-review.mjs", "--city", "shiraz",
        "--candidates", candidatesFile, "--matrix", matrixFile];
      execFileSync(process.execPath, argv, { encoding: "utf8" });
      const result = JSON.parse(readFileSync(".quality-report/shiraz-osm-name-review.json", "utf8"));
      expect(result.counts).toEqual({
        stationMemberships: 4, uniqueNameLeads: 3,
        oneObjectNameMatches: 1, ambiguousNames: 1, unmatchedNames: 1,
      });
      const imam = result.entries.find((x: { normalizedName: string }) => x.normalizedName === "امام حسین");
      expect(imam?.memberships).toBe(2);
      expect(imam?.lineIds).toEqual(["shiraz:line:1", "shiraz:line:2"]);
      expect(imam?.matchState).toBe("ambiguous-multiple-osm-objects");
      expect(imam?.possibleOsm.map((x: { id: number }) => x.id)).toEqual([812, 813]);
      expect(result.entries.find((x: { normalizedName: string }) => x.normalizedName === "شهید دوران")?.matchState)
        .toBe("name-match-needs-human-review");
      expect(result.entries.find((x: { normalizedName: string }) => x.normalizedName === "استقلال")?.matchState)
        .toBe("no-exact-name-match");
      expect(result.entries.every((x: { productionApproved: boolean; coordinatesVerified: boolean; boardingVerified: boolean }) =>
        !x.productionApproved && !x.coordinatesVerified && !x.boardingVerified)).toBe(true);
      expect(Object.values(result.releaseGate).every((value) => value === false)).toBe(true);
      writeFileSync(matrixFile, JSON.stringify({ ...matrix, cityId: "isfahan" }));
      expect(() => execFileSync(process.execPath, argv, { stdio: "pipe" })).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
