import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";

describe("explicit Overpass snapshot acquisition, network-free tests", () => {
  const cli = (args: string[]) => execFileSync(process.execPath,
    ["scripts/fetch-osm-review.mjs", ...args], { encoding: "utf8", stdio: "pipe" });

  it("builds bounded station-and-platform queries and requests version metadata", () => {
    for (const city of ["isfahan", "shiraz"]) {
      const q = cli(["--city", city, "--dry-run"]);
      expect(q).toContain("out center meta;");
      expect(q).toContain('"public_transport"="station"');
      expect(q).toContain('"public_transport"="platform"');
      expect(q).not.toContain("area[");
      expect(q).not.toContain("http:");
    }
    expect(() => cli(["--city", "tehran", "--dry-run"])).toThrow();
    expect(() => cli(["--city", "shiraz", "--endpoint", "https://evil.invalid", "--dry-run"])).toThrow();
  });

  it("preserves original export bytes and computes a reproducible SHA-256", () => {
    const dir = mkdtempSync(join(tmpdir(), "metto-osm-raw-"));
    try {
      const input = join(dir, "osm.json");
      const doc = {
        version: 0.6,
        osm3s: { timestamp_osm_base: "2026-10-28T00:00:00Z" },
        elements: [
          { type: "node", id: 17, version: 2, lat: 32.6, lon: 51.6,
            tags: { name: "نمونه", railway: "station", station: "subway" } },
        ],
      };
      const bytes = Buffer.from(JSON.stringify(doc, null, 2));
      writeFileSync(input, bytes);
      cli(["--city", "isfahan", "--validate", input]);
      const saved = readFileSync(".quality-report/isfahan-overpass-raw.json");
      const manifest = JSON.parse(readFileSync(".quality-report/isfahan-overpass-raw.provenance.json", "utf8"));
      expect(saved.equals(bytes)).toBe(true);
      expect(manifest.rawSha256).toBe(createHash("sha256").update(bytes).digest("hex"));
      expect(manifest.source.kind).toBe("manual-supplied-export");
      expect(manifest.source.endpoint).toBeNull();
      expect(manifest.count).toBe(1);
      expect(manifest.snapshotBase).toBe(doc.osm3s.timestamp_osm_base);
      expect(manifest.reviewOnly).toBe(true);
      expect(manifest.readyForProduction).toBe(false);
      expect(manifest.routesApproved).toBe(false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it("fails closed when objects are unversioned, duplicated or source metadata is incomplete", () => {
    const dir = mkdtempSync(join(tmpdir(), "metto-osm-invalid-"));
    try {
      const input = join(dir, "bad.json");
      const run = (body: unknown) => {
        writeFileSync(input, JSON.stringify(body));
        expect(() => cli(["--city", "shiraz", "--validate", input])).toThrow();
      };
      run({ elements: [] });
      const base = { osm3s: { timestamp_osm_base: "2026-10-28T00:00:00Z" },
        elements: [{ type: "node", id: 17, tags: {station: "subway"} }] };
      run(base);
      run({ ...base, elements: [
        { type: "node", id: 17, version: 1 },
        { type: "node", id: 17, version: 2 },
      ]});
      run({ ...base, remark: "runtime error: timeout", elements: [
        { type: "node", id: 17, version: 1 },
      ]});
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
