import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {join,dirname} from "node:path";
import {fileURLToPath} from "node:url";
describe("upstream watcher security model",()=>{
  it("compares pins without a source auto-update command",()=>{
    const here=dirname(fileURLToPath(import.meta.url));
    const script=readFileSync(join(here,"..","scripts","check-upstream-heads.mjs"),"utf8");
    expect(script).toContain("ls-remote");
    expect(script).not.toMatch(/git\s+pull|git\s+submodule\s+update/);
  });
});
