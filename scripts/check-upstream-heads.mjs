#!/usr/bin/env node
/**
 * Scheduled, read-only check: upstream HEAD is information, NOT a trusted
 * replacement for our reviewed and pinned data.
 */
import {execFileSync} from "node:child_process";
import {readFileSync,writeFileSync} from "node:fs";

const outputArg=process.argv.find(x=>x.startsWith("--output="));
const output=outputArg?.slice("--output=".length);
const sources=JSON.parse(readFileSync("sources.json","utf8"));
const rows=[];
for(const [city,s] of Object.entries(sources)){
  const source=s;
  if(source.type!=="git-submodule" ||
    !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(source.repository) ||
    !/^[0-9a-f]{40}$/.test(source.pinnedCommit))
    throw Error(`Invalid or unsafe registry entry: ${city}`);
  const raw=execFileSync("git",["ls-remote",source.repository+".git","HEAD"],{
    encoding:"utf8",timeout:60000,stdio:["ignore","pipe","pipe"]
  }).trim();
  const remote=raw.split(/\s+/)[0];
  if(!/^[0-9a-f]{40}$/.test(remote))throw Error(`Cannot inspect upstream HEAD: ${city}`);
  rows.push({city,repository:source.repository,pinned:source.pinnedCommit,remote,changed:remote!==source.pinnedCommit});
}
const result={generatedAt:new Date().toISOString(),
  note:"Review-only. This job never updates submodules or published files.",sources:rows};
const serialized=JSON.stringify(result,null,2)+"\n";
if(output)writeFileSync(output,serialized);
console.log(serialized);
