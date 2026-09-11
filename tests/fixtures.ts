import { mkdtempSync, cpSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = join(here, "..");

const tracked: string[] = [];

/**
 * Create an isolated copy of the importer inputs (upstream snapshot,
 * overrides, topology, sources, empty approved queue) in a temp directory.
 * Tests that need to mutate inputs (e.g. contribution folding) must use a
 * fixture root instead of the shared repository, so `vitest` workers never
 * race on `contributions/approved/`. Callers pass the fixture root to
 * `buildTehran(fixtureRoot)`.
 */
export function createFixture(): string {
  const root = mkdtempSync(join(tmpdir(), "metto-data-test-"));
  tracked.push(root);
  mkdirSync(join(root, "upstream-tehran-metro", "data"), { recursive: true });
  mkdirSync(join(root, "overrides"), { recursive: true });
  mkdirSync(join(root, "topology"), { recursive: true });
  mkdirSync(join(root, "contributions", "approved"), { recursive: true });
  cpSync(join(repoRoot, "sources.json"), join(root, "sources.json"));
  cpSync(
    join(repoRoot, "upstream-tehran-metro", "data", "stations.json"),
    join(root, "upstream-tehran-metro", "data", "stations.json"),
  );
  cpSync(join(repoRoot, "overrides", "tehran.overrides.json"), join(root, "overrides", "tehran.overrides.json"));
  for (const file of ["tehran.routes.json", "tehran.segments.json", "tehran.transfers.json", "tehran.aliases.json"]) {
    cpSync(join(repoRoot, "topology", file), join(root, "topology", file));
  }
  return root;
}

/** Remove every fixture created so far. Register once per test file via `afterEach`/`afterAll`. */
export function cleanupFixtures(): void {
  for (const root of tracked.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
}
