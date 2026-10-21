import {describe,it,expect} from "vitest";
import {normalizeGenerated} from "../scripts/check-generated.js";
import {validateSourceRecord, type SourceRecord} from "../scripts/check-provenance.js";

const source: SourceRecord = {
 name:"Example Metro", repository:"https://github.com/example/transit-data",
 path:"upstream-example", upstreamFile:"data/stations.json", license:"ODbL-1.0",
 licenseFile:"LICENSES/ODbL-1.0.txt", type:"git-submodule",
 pinnedCommit:"a".repeat(40), lastSyncedAt:"2026-10-21",stationCount:1,datasetVersion:"2026.10.1",
 releaseStatus:"candidate",
};

describe("source & generated integrity gates", () => {
 it("rejects unsafe source and upstream paths and ambiguous licenses", () => {
   expect(validateSourceRecord("example",source)).toEqual([]);
   expect(validateSourceRecord("example",{...source,path:"../secret"}).join(" ")).toMatch(/upstream path/);
   expect(validateSourceRecord("example",{...source,upstreamFile:"../../secret"}).join(" ")).toMatch(/upstream file/);
   expect(validateSourceRecord("example",{...source,license:"unknown"}).join(" ")).toMatch(/license/);
   expect(validateSourceRecord("example",{...source,pinnedCommit:"HEAD"}).join(" ")).toMatch(/pinned SHA/);
 });
 it("ignores only meta.generatedAt when comparing canonical generated data", () => {
   const a={cityId:"mashhad",releaseStatus:"candidate",generatedAt:"2026-10-21",counts:{stations:38}};
   const b={...a,generatedAt:"2026-10-22"};
   expect(normalizeGenerated("meta.json",a)).toBe(normalizeGenerated("meta.json",b));
   expect(normalizeGenerated("stations.json",a)).not.toBe(normalizeGenerated("stations.json",b));
   expect(normalizeGenerated("meta.json",a)).not.toBe(normalizeGenerated("meta.json",{...b,releaseStatus:"verified"}));
 });
});
