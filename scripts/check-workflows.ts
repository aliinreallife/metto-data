#!/usr/bin/env node
/** Fail on mutable action tags in any GitHub workflow. */
import {readFileSync,readdirSync} from "node:fs";
import {join,dirname} from "node:path";
import {fileURLToPath} from "node:url";
export function checkWorkflowReferences(text:string):string[]{
 const bad:string[]=[];
 for(const line of text.split(/\r?\n/)){
   const found=/^\s*(?:-\s*)?uses:\s*([^\s#]+)/.exec(line);
   if(!found)continue;
   const ref=found[1];
   if(ref.startsWith("./"))continue;
   if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[0-9a-f]{40}$/.test(ref))
     bad.push(`unpinned or unsafe action: ${ref}`);
 }
 return bad;
}
const invoked=process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1];
if(invoked){
 const dir=join(dirname(fileURLToPath(import.meta.url)),"..",".github","workflows");
 const errors=readdirSync(dir).filter(s=>/\.ya?ml$/.test(s)).flatMap(name=>
   checkWorkflowReferences(readFileSync(join(dir,name),"utf8")).map(x=>name+": "+x));
 if(errors.length){errors.forEach(x=>console.error(x));process.exitCode=1;}
 else console.log("workflow pinning: OK (all third-party actions have 40-character SHAs)");
}
