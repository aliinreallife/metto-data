import {describe,it,expect} from "vitest";
import {inspectCity,generateReport} from "../scripts/quality-report.js";
import {mkdtempSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
function s(id:string,lat:number,lng:number,wc:boolean|null=null){
 return {id,names:{en:id,fa:id},location:{lat,lng},amenities:{wc},amenitiesVerified:false};
}
const graph={routes:[{lineId:"mashhad:line:1",stops:[{stationId:"a"},{stationId:"b"}]}],segments:[{}],transfers:[]};
describe("quality gates on candidate records",()=>{
 it("rejects upstream facility claims being marked canonical prematurely",()=>{
  expect(inspectCity("mashhad","candidate",[s("a",36.3,59.6,true)],graph).errors.join(" ")).toMatch(/unverified facility/);
 });
 it("flags true duplicate locations, but only warns about close separate stations",()=>{
  expect(inspectCity("mashhad","candidate",[s("a",36.3,59.6),s("b",36.3,59.6)],graph).errors.join(" ")).toMatch(/duplicate station center/);
  const near=inspectCity("mashhad","candidate",[s("a",36.3,59.6),s("b",36.3002,59.6)],graph);
  expect(near.errors).toEqual([]);
  expect(near.warnings.join(" ")).toMatch(/within/);
 });
 it("does not silently invent interchange transfer walks",()=>{
  const routes={routes:[{lineId:"mashhad:line:1",stops:[{stationId:"a"},{stationId:"b"}]},
                        {lineId:"mashhad:line:2",stops:[{stationId:"a"},{stationId:"c"}]}],
                segments:[{},{}],transfers:[]};
  expect(inspectCity("mashhad","candidate",[s("a",36.3,59.6),s("b",36.31,59.61),s("c",36.32,59.62)],routes).warnings.join(" ")).toMatch(/interchanges/);
 });
 it("exports every Mashhad boarding claim for review without approving the city",()=>{
  const out=mkdtempSync(join(tmpdir(),"mashhad-review-report-"));
  try{
   const root=join(dirname(fileURLToPath(import.meta.url)),"..");
   expect(generateReport(root,out).errors).toEqual([]);
   const report=JSON.parse(readFileSync(join(out,"mashhad-release-review.json"),"utf8"));
   expect(report.releaseReady).toBe(false);
   expect(report.blockers.join("\n")).toMatch(/critical source-review blockers/);
   expect(report.boardingClaims).toHaveLength(41);
   expect(report.boardingClaims.filter((s:{lineId:string})=>s.lineId==="mashhad:line:3")).toHaveLength(4);
   expect(report.interchangeStations.map((s:{stationId:string})=>s.stationId).sort()).toEqual([
    "mashhad:station:basij","mashhad:station:shariati","mashhad:station:shohada",
   ]);
   expect(report.datasetSha256).toMatch(/^[a-f0-9]{64}$/);
  }finally{rmSync(out,{recursive:true,force:true});}
 });
});
