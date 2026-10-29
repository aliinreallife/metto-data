import { cpSync, mkdirSync } from "node:fs";
import { join } from "node:path";
// CLI scripts resolve their output root relative to their own module location.
// Run copies in a scratch repository so tests never replace real research files.
export function isolatedOSMScripts(root: string) {
  const scripts = join(root, "scripts");
  mkdirSync(scripts, { recursive: true });
  for (const name of [
    "osm-export.mjs",
    "fetch-osm-review.mjs",
    "osm-candidate-intake.mjs",
    "osm-name-review.mjs",
  ])
    cpSync(join("scripts", name), join(scripts, name));
  return (name: string) => join(scripts, name);
}
