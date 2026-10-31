import { isolatedOSMScripts } from "./osm-review-fixture.js";
import { afterAll } from "vitest";
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";

describe("explicit Overpass snapshot acquisition, network-free tests", () => {
  const root = mkdtempSync(join(tmpdir(), "metto-osm-cli-"));
  const script = isolatedOSMScripts(root);
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  const cli = (args: string[]) =>
    execFileSync(process.execPath, [script("fetch-osm-review.mjs"), ...args], {
      encoding: "utf8",
      stdio: "pipe",
    });

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
    expect(() =>
      cli([
        "--city",
        "shiraz",
        "--endpoint",
        "https://evil.invalid",
        "--dry-run",
      ]),
    ).toThrow();
  });

  it("preserves original export bytes and computes a reproducible SHA-256", () => {
    const dir = mkdtempSync(join(tmpdir(), "metto-osm-raw-"));
    try {
      const input = join(dir, "osm.json");
      const doc = {
        version: 0.6,
        osm3s: { timestamp_osm_base: "2026-10-28T00:00:00Z" },
        elements: [
          {
            type: "node",
            id: 17,
            version: 2,
            lat: 32.6,
            lon: 51.6,
            tags: { name: "نمونه", railway: "station", station: "subway" },
          },
        ],
      };
      const bytes = Buffer.from(JSON.stringify(doc, null, 2));
      writeFileSync(input, bytes);
      cli(["--city", "isfahan", "--validate", input]);
      const saved = readFileSync(
        join(root, ".quality-report/isfahan-overpass-raw.json"),
      );
      const manifest = JSON.parse(
        readFileSync(
          join(root, ".quality-report/isfahan-overpass-raw.provenance.json"),
          "utf8",
        ),
      );
      expect(saved.equals(bytes)).toBe(true);
      expect(manifest.rawSha256).toBe(
        createHash("sha256").update(bytes).digest("hex"),
      );
      expect(manifest.source.kind).toBe("manual-supplied-export");
      expect(manifest.source.endpoint).toBeNull();
      expect(manifest.count).toBe(1);
      expect(manifest.snapshotBase).toBe(doc.osm3s.timestamp_osm_base);
      expect(manifest.reviewOnly).toBe(true);
      expect(manifest.readyForProduction).toBe(false);
      expect(manifest.routesApproved).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
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
      const base = {
        osm3s: { timestamp_osm_base: "2026-10-28T00:00:00Z" },
        elements: [{ type: "node", id: 17, tags: { station: "subway" } }],
      };
      run(base);
      run({
        ...base,
        elements: [
          { type: "node", id: 17, version: 1 },
          { type: "node", id: 17, version: 2 },
        ],
      });
      run({
        ...base,
        remark: "runtime error: timeout",
        elements: [{ type: "node", id: 17, version: 1 }],
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("preserves relation member references without approving Shiraz Line 2 topology", () => {
    const query = cli([
      "--city",
      "shiraz",
      "--scope",
      "shiraz-line2-relation",
      "--dry-run",
    ]);
    expect(query).toContain("relation(15510494)");
    expect(query).toContain("out center meta;");
    expect(() =>
      cli([
        "--city",
        "isfahan",
        "--scope",
        "shiraz-line2-relation",
        "--dry-run",
      ]),
    ).toThrow();
    const dir = mkdtempSync(join(tmpdir(), "metto-shiraz-rel-"));
    try {
      const f = join(dir, "relation.json");
      writeFileSync(
        f,
        JSON.stringify({
          osm3s: { timestamp_osm_base: "2026-10-28T00:00:00Z" },
          elements: [
            {
              type: "relation",
              id: 15510494,
              version: 11,
              members: [{ type: "node", ref: 117, role: "stop" }],
              tags: { type: "route", route: "subway" },
            },
            { type: "node", id: 117, version: 3, lat: 29.6, lon: 52.6 },
          ],
        }),
      );
      cli([
        "--city",
        "shiraz",
        "--scope",
        "shiraz-line2-relation",
        "--validate",
        f,
      ]);
      const report = JSON.parse(
        readFileSync(
          join(
            root,
            ".quality-report/shiraz-line2-relation-overpass-raw.provenance.json",
          ),
          "utf8",
        ),
      );
      expect(report.sourceRelation).toEqual({
        type: "relation",
        id: 15510494,
        version: 11,
        referencedObjectsPresent: true,
        observedMembers: 1,
        routeTopologyVerified: false,
        boardingStationsVerified: false,
        directionVerified: false,
      });
      expect(report.readyForProduction).toBe(false);
      writeFileSync(
        f,
        JSON.stringify({
          osm3s: { timestamp_osm_base: "2026-10-28T00:00:00Z" },
          elements: [{ type: "relation", id: 999, version: 1, members: [] }],
        }),
      );
      expect(() =>
        cli([
          "--city",
          "shiraz",
          "--scope",
          "shiraz-line2-relation",
          "--validate",
          f,
        ]),
      ).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
