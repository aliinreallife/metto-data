#!/usr/bin/env node
/**
 * Called AFTER pnpm build. Compare generated JSON with committed artifacts,
 * excluding only non-deterministic meta.generatedAt. No auto-commit.
 */
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
const files = ["city.json","agencies.json","networks.json","stations.json","lines.json","graph.json","meta.json"] as const;

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string,unknown>)
      .sort(([a],[b]) => a.localeCompare(b,"en"))
      .map(([key,item]) => [key,canonical(item)]));
  }
  return value;
}
export function normalizeGenerated(name: string, value: unknown): string {
  const clone = structuredClone(value) as Record<string,unknown>;
  if (name === "meta.json" && clone && typeof clone === "object" && !Array.isArray(clone)) {
    delete clone.generatedAt;
  }
  return JSON.stringify(canonical(clone));
}

export function checkGenerated(root: string): string[] {
  const sources = JSON.parse(readFileSync(join(root,"sources.json"),"utf8")) as Record<string,unknown>;
  const errors: string[] = [];
  for (const city of Object.keys(sources).sort()) {
    for (const name of files) {
      const path = `data/cities/${city}/${name}`;
      try {
        const tracked = JSON.parse(execFileSync("git",["show",`HEAD:${path}`],{cwd:root,encoding:"utf8"}));
        const built = JSON.parse(readFileSync(join(root,path),"utf8"));
        if (normalizeGenerated(name,tracked) !== normalizeGenerated(name,built)) {
          errors.push(`${path}: committed dataset differs from a fresh pinned-source build`);
        }
      } catch (error) {
        errors.push(`${path}: missing or malformed generated/committed JSON (${(error as Error).message})`);
      }
    }
  }
  return errors;
}
const invoked = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invoked) {
  const root = join(dirname(fileURLToPath(import.meta.url)),"..");
  try {
    const errors = checkGenerated(root);
    if (errors.length) { errors.forEach(x=>console.error("generated error: "+x)); process.exitCode=1; }
    else console.log("generated: OK (tracked JSON matches fresh build, ignoring only generatedAt)");
  } catch (error) { console.error("generated: fatal",error); process.exitCode=1; }
}
