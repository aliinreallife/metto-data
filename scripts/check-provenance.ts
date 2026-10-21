#!/usr/bin/env node
/**
 * Offline source integrity gate. Never follows a moving upstream branch.
 * Run on a clean Git checkout with submodules initialized.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export interface SourceRecord {
  name: string; repository: string; path: string; upstreamFile: string;
  license: string; licenseFile: string; type: string; pinnedCommit: string;
  lastSyncedAt: string; stationCount: number; datasetVersion: string;
  releaseStatus?: "candidate" | "verified";
}

export function validateSourceRecord(city: string, source: SourceRecord): string[] {
  const problems: string[] = [];
  if (!/^[a-z0-9-]+$/.test(city)) problems.push(`invalid city ID ${city}`);
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(source.repository ?? ""))
    problems.push(`${city}: repository must be a GitHub HTTPS repository URL`);
  if (!/^upstream-[a-z0-9-]+$/.test(source.path ?? "")) problems.push(`${city}: invalid upstream path`);
  if (!/^(?!\/)(?!.*\.\.)[a-zA-Z0-9_.\/-]+$/.test(source.upstreamFile ?? ""))
    problems.push(`${city}: invalid upstream file path`);
  if (source.type !== "git-submodule") problems.push(`${city}: source type must be git-submodule`);
  if (!/^[a-f0-9]{40}$/.test(source.pinnedCommit ?? "")) problems.push(`${city}: invalid pinned SHA`);
  if (source.license !== "ODbL-1.0") problems.push(`${city}: license must be reviewed explicitly`);
  if (source.licenseFile !== "LICENSES/ODbL-1.0.txt") problems.push(`${city}: license file mismatch`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(source.lastSyncedAt ?? "") || Number.isNaN(Date.parse(source.lastSyncedAt)))
    problems.push(`${city}: invalid sync date`);
  if (!/^\d{4}\.\d{2}\.\d+$/.test(source.datasetVersion ?? "")) problems.push(`${city}: invalid dataset version`);
  if (!Number.isInteger(source.stationCount) || source.stationCount <= 0)
    problems.push(`${city}: invalid expected station count`);
  if (source.releaseStatus && source.releaseStatus !== "candidate" && source.releaseStatus !== "verified")
    problems.push(`${city}: invalid release status`);
  return problems;
}

function git(root: string, args: string[]): string {
  return execFileSync("git", args, {cwd: root, encoding:"utf8", stdio:["ignore","pipe","pipe"]}).trim();
}

export function checkProvenance(root: string): string[] {
  const errors: string[] = [];
  const sources = JSON.parse(readFileSync(join(root,"sources.json"),"utf8")) as Record<string, SourceRecord>;
  const paths = new Set<string>();
  for (const [city,source] of Object.entries(sources)) {
    errors.push(...validateSourceRecord(city, source));
    if (!/^upstream-[a-z0-9-]+$/.test(source.path ?? "") ||
        !/^(?!\/)(?!.*\.\.)[a-zA-Z0-9_.\/-]+$/.test(source.upstreamFile ?? "")) continue;
    if (paths.has(source.path)) errors.push(`${city}: duplicate upstream path ${source.path}`);
    paths.add(source.path);
    try {
      const declared = git(root,["config","-f",".gitmodules","--get",`submodule.${source.path}.url`]);
      if (declared.replace(/\.git$/,"") !== source.repository) errors.push(`${city}: .gitmodules URL differs from sources.json`);
      const path = git(root,["config","-f",".gitmodules","--get",`submodule.${source.path}.path`]);
      if (path !== source.path) errors.push(`${city}: .gitmodules path mismatch`);
      const entry = git(root,["ls-tree","HEAD","--",source.path]);
      const match = /^160000 commit ([a-f0-9]{40})\t/.exec(entry);
      if (!match || match[1] !== source.pinnedCommit) errors.push(`${city}: gitlink does not match pinned commit`);
      const checkedOut = git(join(root,source.path),["rev-parse","HEAD"]);
      if (checkedOut !== source.pinnedCommit) errors.push(`${city}: working submodule has a different commit`);
      if (git(join(root,source.path),["status","--porcelain"]).length) errors.push(`${city}: upstream submodule is dirty`);
      const input = join(root,source.path,source.upstreamFile);
      if (!existsSync(input)) { errors.push(`${city}: missing upstream JSON`); continue; }
      const doc = JSON.parse(readFileSync(input,"utf8")) as Record<string,unknown>;
      if (!doc || Array.isArray(doc) || typeof doc !== "object" ||
          Object.keys(doc).length !== source.stationCount)
        errors.push(`${city}: stationCount disagrees with pinned upstream snapshot`);
      if (!existsSync(join(root,source.licenseFile))) errors.push(`${city}: missing redistribution license text`);
    } catch (error) {
      errors.push(`${city}: cannot validate checked-out provenance (${(error as Error).message})`);
    }
  }
  return errors;
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invoked) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  try {
    const errors = checkProvenance(root);
    if (errors.length) { errors.forEach(x=>console.error("provenance error: "+x)); process.exitCode=1; }
    else console.log("provenance: OK (all registered pinned upstream snapshots, licenses and gitlinks agree)");
  } catch (error) { console.error("provenance: fatal",error); process.exitCode=1; }
}
