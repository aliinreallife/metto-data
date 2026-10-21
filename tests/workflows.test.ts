import {describe,it,expect} from "vitest";
import {checkWorkflowReferences} from "../scripts/check-workflows.js";
describe("GitHub Actions pinning policy",()=>{
 it("rejects floating tags and branches",()=>{
  expect(checkWorkflowReferences("steps:\n  - uses: actions/checkout@v4\n  - uses: vendor/action@main")).toHaveLength(2);
 });
 it("accepts verified SHA actions and local references",()=>{
  const sha="a".repeat(40);
  expect(checkWorkflowReferences(`steps:\n  - uses: actions/checkout@${sha} # pinned\n  - uses: ./local-action`)).toEqual([]);
 });
});
