import {describe,it,expect} from "vitest";
import {inspectCity} from "../scripts/quality-report.js";
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
});
