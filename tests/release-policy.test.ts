import {describe,it,expect} from "vitest";
import {spawnSync} from "node:child_process";
import {join,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const root=join(dirname(fileURLToPath(import.meta.url)),"..");
describe("per-city release policy",()=>{
 it("allows verified Tehran without granting a release to Mashhad",()=>{
   const ok=spawnSync("pnpm",["check-release","--city","tehran"],{cwd:root,encoding:"utf8"});
   expect(ok.status,ok.stderr+"\n"+ok.stdout).toBe(0);
   const denied=spawnSync("pnpm",["check-release","--city","mashhad"],{cwd:root,encoding:"utf8"});
   expect(denied.status).not.toBe(0);
   expect(denied.stderr+denied.stdout).toMatch(/candidate dataset is not approved/);
 });
 it("does not allow release checks for unregistered cities",()=>{
   const result=spawnSync("pnpm",["check-release","--city","not-real"],{cwd:root,encoding:"utf8"});
   expect(result.status).not.toBe(0);
 });
});
