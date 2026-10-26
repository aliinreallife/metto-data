import { afterAll, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  buildCatalog,
  searchStations,
} from "../apps/data-portal/lib/catalog.js";
import {
  createIntakeHandler,
  evidence,
  publicBody,
  reserveQuota,
  type IntakeConfig,
  type PrivateStore,
  type StoredReport,
} from "../apps/data-portal/lib/intake.js";
import { reconcile } from "../apps/data-portal/lib/reconcile.js";
import { buildMashhad } from "../importers/mashhad.js";
import { buildTehran } from "../importers/tehran.js";
import {
  createFixture,
  cleanupFixtures,
  repoRoot,
  createMashhadFixture,
} from "./fixtures.js";
afterAll(cleanupFixtures);
const data = (city: string, file: string) =>
  JSON.parse(
    readFileSync(
      new URL(`../data/cities/${city}/${file}.json`, import.meta.url),
      "utf8",
    ),
  );
const catalog = buildCatalog(
  ["tehran", "mashhad"].map((id) => ({
    id,
    names: { fa: id === "tehran" ? "تهران" : "مشهد", en: id },
    candidate: id === "mashhad",
    stations: data(id, "stations"),
    lines: data(id, "lines"),
    graph: data(id, "graph"),
    ...(id === "mashhad"
      ? { allowedLineIds: ["mashhad:line:1", "mashhad:line:2"] }
      : {}),
  })),
);
class MemoryStore implements PrivateStore {
  rows = new Map<string, { value: unknown; etag: string }>();
  version = 0;
  async read<T>(path: string) {
    const row = this.rows.get(path);
    return row
      ? { value: structuredClone(row.value) as T, etag: row.etag }
      : null;
  }
  async write(path: string, value: unknown, expected: string | null) {
    const row = this.rows.get(path);
    if (
      (expected === null && row) ||
      (expected !== null && row?.etag !== expected)
    )
      return false;
    this.rows.set(path, {
      value: structuredClone(value),
      etag: String(++this.version),
    });
    return true;
  }
  async remove(path: string, expected: string) {
    if (this.rows.get(path)?.etag !== expected) return false;
    this.rows.delete(path);
    return true;
  }
  async paths(prefix: string) {
    return {
      paths: [...this.rows.keys()].filter((path) => path.startsWith(prefix)),
    };
  }
}
const ID = "12345678-1234-4123-8123-123456789abc";
const PHOTO = JSON.parse(
  readFileSync(
    new URL("./fixtures/report-photo.json", import.meta.url),
    "utf8",
  ),
).jpeg as string;
const payload = {
  id: ID,
  cityId: "mashhad",
  stationId: "mashhad:station:basij",
  kind: "timetable",
  subject: "Line 1 direction",
  details: "Observed board, weekday service, dated source",
};
const origin = "https://data.example.org";
function request(body: unknown = payload) {
  return new Request(origin + "/api/reports", {
    method: "POST",
    headers: {
      origin,
      "Content-Type": "application/json",
      "x-vercel-forwarded-for": "203.0.113.10",
    },
    body: JSON.stringify(body),
  });
}
function fixture() {
  const store = new MemoryStore(),
    calls: { url: string; body: any; method: string }[] = [];
  let githubStatus = 201,
    networkFailure = false,
    searchFound = false;
  const config: IntakeConfig = {
    store,
    githubToken: "server-only-issue-token",
    publicOrigin: origin,
    cityStations: Object.fromEntries([
      ["other", []],
      ...catalog.cities.map((city) => [
        city.id,
        city.stations.map((station) => station.id),
      ]),
    ]),
    now: () => new Date("2026-10-24T09:00:00Z"),
    fetch: async (input, init = {}) => {
      const url = String(input);
      calls.push({
        url,
        method: init.method ?? "GET",
        body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
      });
      if (url.includes("/search/issues"))
        return Response.json({
          items: searchFound
            ? [
                {
                  html_url:
                    "https://github.com/aliinreallife/metto-data/issues/101",
                  body: `Submission reference: ${ID}`,
                },
              ]
            : [],
        });
      if (networkFailure) throw Error("network");
      return githubStatus === 201
        ? Response.json(
            {
              html_url:
                "https://github.com/aliinreallife/metto-data/issues/101",
            },
            { status: 201 },
          )
        : new Response(null, { status: githubStatus });
    },
  };
  return {
    store,
    config,
    calls,
    handle: createIntakeHandler(config),
    setStatus: (status: number) => {
      githubStatus = status;
    },
    failNetwork: () => {
      networkFailure = true;
    },
    findPublished: () => {
      searchFound = true;
    },
  };
}
describe("real portal catalog", () => {
  it("distinguishes the open Line 7 platform at 17 Shahrivar from Line 6 through-tracks", () => {
    const station = catalog.stations.find(
      (s) => s.id === "tehran:station:shohada-ye-hefdah-e-shahrivar",
    )!;
    expect(station.lines.map((l) => l.id)).toEqual([
      "tehran:line:6",
      "tehran:line:7",
    ]);
    expect(station.operationalLineIds).toEqual(["tehran:line:7"]);
    const line6 = catalog.cities[0].routes.find(
      (r) => r.id === "tehran:route:line-6-main",
    )!;
    expect(line6.stationIds).toContain(station.id);
    expect(line6.boardableStationIds).not.toContain(station.id);
  });

  it("serves Metto’s actual 187 scoped stations in two cities and nine lines", () => {
    expect(catalog.stationCount).toBe(187);
    expect(catalog.lineCount).toBe(9);
    expect(catalog.cities.map((c) => c.stations.length)).toEqual([151, 36]);
  });
  it("preserves the cleaned Metto Tehran baseline byte for byte", () => {
    const expected: Record<string, string> = {
      stations: "ae8e0dc489728f9bcfff010471469a3bfdadf1f2",
      lines: "da687ea48c12c64c88d37117c837bc6519d67eb7",
      graph: "8d24868fdf39b0009e5160768fdb20fbd040b258",
    };
    const baseline = buildTehran(createFixture());
    for (const [file, hash] of Object.entries(expected)) {
      const bytes = Buffer.from(
        JSON.stringify(
          baseline[file as "stations" | "lines" | "graph"],
          null,
          2,
        ) + "\n",
      );
      expect(
        createHash("sha1")
          .update(`blob ${bytes.length}\0`)
          .update(bytes)
          .digest("hex"),
      ).toBe(hash);
    }
  });
  it("serves exactly the current pinned inputs plus explicitly approved Tehran corrections", () => {
    const built = buildTehran(repoRoot);
    for (const key of ["stations", "lines", "graph"] as const)
      expect(data("tehran", key)).toEqual(built[key]);
  });
  it("keeps shared names in distinct cities and supports Persian text normalization", () => {
    expect(
      searchStations(catalog, "", "basij").map((station) => station.id),
    ).toEqual(
      expect.arrayContaining(["tehran:station:basij", "mashhad:station:basij"]),
    );
    expect(searchStations(catalog, "mashhad", "basij")).toHaveLength(1);
    expect(searchStations(catalog, "tehran", "تجريش")).toHaveLength(1);
  });
  it("keeps Mashhad provisional, with no Line 3 or invented amenities", () => {
    const city = catalog.cities[1];
    expect(city.candidate).toBe(true);
    expect(city.lines.map((line) => line.id)).toEqual([
      "mashhad:line:1",
      "mashhad:line:2",
    ]);
    expect(
      buildMashhad(createMashhadFixture()).stations.every((station) =>
        Object.values(station.amenities).every((value) => value === null),
      ),
    ).toBe(true);
  });
});
describe("Vercel anonymous intake", () => {
  it("accepts a new-city suggestion without inventing a station", async () => {
    const f = fixture();
    const r = await f.handle(
      request({
        ...payload,
        cityId: "other",
        stationId: "",
        kind: "other",
        subject: "Add my city",
      }),
    );
    expect(r.status).toBe(201);
    expect(f.calls[0].body.title).toContain("شهر دیگر");
  });
  it("creates an issue without visitor authentication or contact fields", async () => {
    const f = fixture(),
      r = await f.handle(request());
    expect(r.status).toBe(201);
    expect(((await r.json()) as { id: string }).id).toBe(ID);
    expect(f.calls).toHaveLength(1);
    expect(f.store.rows.has(`outbox/${ID}.json`)).toBe(false);
  });
  it("keeps name and contact private, excludes them from issues and receipt", async () => {
    const f = fixture(),
      r = await f.handle(
        request({
          ...payload,
          name: "Private person",
          contact: "private@example.org",
        }),
      );
    expect(r.status).toBe(201);
    const row = await f.store.read<StoredReport>(`submissions/${ID}.json`);
    expect(row?.value.report.contact).toBe("private@example.org");
    expect(JSON.stringify(f.calls)).not.toMatch(
      /Private person|private@example/,
    );
    expect(await r.text()).not.toContain("private@example");
  });
  it("serves only the JPEG bytes through the public evidence endpoint", async () => {
    const f = fixture();
    await f.handle(
      request({
        ...payload,
        details: "",
        photo: PHOTO,
        contact: "private@example.org",
      }),
    );
    const r = await evidence(f.config, ID);
    expect(r.headers.get("content-type")).toBe("image/jpeg");
    const bytes = Buffer.from(await r.arrayBuffer());
    expect([...bytes.subarray(0, 2)]).toEqual([255, 216]);
    expect([...bytes.subarray(-2)]).toEqual([255, 217]);
    expect(bytes.includes(Buffer.from("private-photo-metadata"))).toBe(false);
    expect(bytes.length).toBeLessThanOrEqual(524288);
    expect(f.calls[0].body.body).toContain(`${origin}/api/evidence/${ID}`);
  });
  it("keeps queued and ambiguous uploads private until their public issue is confirmed", async () => {
    const f = fixture();
    f.config.githubToken = "";
    expect((await f.handle(request({ ...payload, photo: PHOTO }))).status).toBe(
      202,
    );
    expect((await evidence(f.config, ID)).status).toBe(404);
    const saved = await f.store.read<StoredReport>(`submissions/${ID}.json`);
    await f.store.write(
      `submissions/${ID}.json`,
      { ...saved!.value, state: "publishing" },
      saved!.etag,
    );
    const response = await evidence(f.config, ID);
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("rejects files with JPEG markers that cannot actually be decoded before queueing", async () => {
    const f = fixture();
    for (let attempt = 0; attempt < 4; attempt++)
      expect(
        (await f.handle(request({ ...payload, photo: "/9j/2Q==" }))).status,
      ).toBe(400);
    expect(
      (await f.handle(request({ ...payload, photo: "/9j/2Q==" }))).status,
    ).toBe(429);
    expect(
      [...f.store.rows.keys()].every((path) => path.startsWith("limits/")),
    ).toBe(true);
    expect(f.calls).toHaveLength(0);
  });
  it("preserves text-report intake when photo capacity is unavailable", async () => {
    const f = fixture();
    f.config.store.canStorePhoto = async () => false;
    const response = await f.handle(request({ ...payload, photo: PHOTO }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "photo_capacity" });
    expect(f.store.rows.size).toBe(0);
    expect(f.calls).toHaveLength(0);
    expect((await f.handle(request())).status).toBe(201);
  });
  it("has no evidence endpoint for missing or invalid IDs", async () => {
    const f = fixture();
    expect((await evidence(f.config, "../../private")).status).toBe(404);
    expect((await evidence(f.config, ID)).status).toBe(404);
  });
  it("keeps contributed Markdown, CR line endings and mentions literal", () => {
    const body = publicBody(
      {
        ...payload,
        kind: "timetable",
        source: "",
        name: "Private",
        contact: "private@example.org",
        details: "@someone\r```\n<img src=x>",
      },
      origin,
    );
    expect(body).toContain("    @someone\n    ```\n    <img src=x>");
    expect(body).not.toContain("private@example");
  });
  it("acknowledges matching retries without another GitHub POST", async () => {
    const f = fixture();
    await f.handle(request());
    expect((await f.handle(request())).status).toBe(200);
    expect(f.calls).toHaveLength(1);
  });
  it("rejects ID reuse with different content", async () => {
    const f = fixture();
    await f.handle(request());
    expect(
      (await f.handle(request({ ...payload, details: "changed" }))).status,
    ).toBe(409);
    expect(f.calls).toHaveLength(1);
  });
  it("publishes only once when identical requests race", async () => {
    const f = fixture();
    const results = await Promise.all([
      f.handle(request()),
      f.handle(request()),
    ]);
    expect(
      results
        .map((r) => r.status)
        .every((status) => [200, 201, 202].includes(status)),
    ).toBe(true);
    expect(f.calls.filter((call) => call.method === "POST")).toHaveLength(1);
  });
  it("rejects foreign stations, unscoped stations, malformed photos and unsafe links before side effects", async () => {
    for (const body of [
      { ...payload, cityId: "__proto__" },
      { ...payload, stationId: "tehran:station:basij" },
      { ...payload, stationId: "mashhad:station:bab-al-javad" },
      { ...payload, photo: "PHN2Zy8+" },
      { ...payload, source: "javascript:alert(1)" },
      { ...payload, details: "" },
    ]) {
      const f = fixture();
      expect((await f.handle(request(body))).status).toBe(400);
      expect(f.store.rows.size).toBe(0);
      expect(f.calls).toHaveLength(0);
    }
  });
  it("bounds the input body", async () => {
    const f = fixture();
    expect(
      (await f.handle(request({ ...payload, details: "x".repeat(800000) })))
        .status,
    ).toBe(413);
    expect(f.store.rows.size).toBe(0);
  });
  it("rejects an unrelated browser origin", async () => {
    const f = fixture(),
      r = request();
    r.headers.set("origin", "https://unrelated.example");
    expect((await f.handle(r)).status).toBe(403);
    expect(f.store.rows.size).toBe(0);
  });
  it("does not store honeypot submissions", async () => {
    const f = fixture();
    expect(
      (await f.handle(request({ ...payload, website: "spam" }))).status,
    ).toBe(201);
    expect(f.store.rows.size).toBe(0);
  });
  it("does not report success when durable storage is unavailable", async () => {
    const f = fixture();
    f.store.write = async () => {
      throw Error("offline");
    };
    expect((await f.handle(request())).status).toBe(503);
    expect(f.calls).toHaveLength(0);
  });
  it("acknowledges a durable write even when its response was lost", async () => {
    const f = fixture(),
      write = f.store.write.bind(f.store);
    f.store.write = async (path, value, expected) => {
      const result = await write(path, value, expected);
      if (path.startsWith("submissions/")) throw Error("lost response");
      return result;
    };
    expect((await f.handle(request())).status).toBe(202);
    expect(f.store.rows.has(`outbox/${ID}.json`)).toBe(true);
  });
  it("retries explicit GitHub denials through the durable outbox", async () => {
    const f = fixture();
    f.setStatus(429);
    expect((await f.handle(request())).status).toBe(202);
    expect(
      (await f.store.read<StoredReport>(`submissions/${ID}.json`))?.value.state,
    ).toBe("pending");
    f.setStatus(201);
    const summary = await reconcile(f.config);
    expect(summary.published).toBe(1);
    expect(f.store.rows.has(`outbox/${ID}.json`)).toBe(false);
  });
  it("reconciles a lost successful response without another issue creation", async () => {
    const f = fixture();
    f.failNetwork();
    expect((await f.handle(request())).status).toBe(202);
    f.findPublished();
    const summary = await reconcile(f.config);
    expect(summary.published).toBe(1);
    expect(f.calls.filter((call) => call.method === "POST")).toHaveLength(1);
    const search = f.calls.find((call) => call.url.includes("/search/issues"));
    expect(search).toBeDefined();
    const query = new URL(search!.url).searchParams.get("q");
    // GitHub rejects this endpoint with 422 without an explicit issue/PR type.
    expect(query).toBe(
      `repo:aliinreallife/metto-data is:issue in:body "Submission reference: ${ID}"`,
    );
  });
  it("keeps ambiguous HTTP 5xx and empty searches for human review", async () => {
    const f = fixture();
    f.setStatus(503);
    expect((await f.handle(request())).status).toBe(202);
    expect((await reconcile(f.config)).needsReview).toBe(1);
    expect(f.calls.filter((call) => call.method === "POST")).toHaveLength(1);
  });
});
describe("durable atomic quotas", () => {
  it("permits four reports per hour under concurrent requests", async () => {
    const f = fixture();
    const results = await Promise.all(
      Array.from({ length: 12 }, () => reserveQuota(f.config, "203.0.113.10")),
    );
    expect(results.filter(Boolean)).toHaveLength(4);
    expect(JSON.stringify([...f.store.rows.values()])).not.toContain(
      "203.0.113.10",
    );
  });
  it("limits ten reports per day across hours", async () => {
    const f = fixture();
    for (let i = 0; i < 10; i++) {
      f.config.now = () =>
        new Date(
          `2026-10-24T${String(9 + Math.floor(i / 4)).padStart(2, "0")}:00:00Z`,
        );
      expect(await reserveQuota(f.config, "same")).toBe(true);
    }
    f.config.now = () => new Date("2026-10-24T20:00:00Z");
    expect(await reserveQuota(f.config, "same")).toBe(false);
  });
  it("caps all IPs together at 100 per day and resets next day", async () => {
    const f = fixture();
    for (let i = 0; i < 100; i++)
      expect(await reserveQuota(f.config, `ip-${i}`)).toBe(true);
    expect(await reserveQuota(f.config, "another")).toBe(false);
    f.config.now = () => new Date("2026-10-25T09:00:00Z");
    expect(await reserveQuota(f.config, "another")).toBe(true);
  });
});
