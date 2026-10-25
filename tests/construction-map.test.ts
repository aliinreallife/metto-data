import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
const read = (path: string) =>
  JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
it("shows only reviewed source-reported construction geometry without adding passenger stops or edges", () => {
  const reference = read("data/reference/mashhad-construction.json");
  const review = read("sources/mashhad/construction-map-review.json");
  const snapshot = read("sources/mashhad/construction-map-snapshot.json");
  expect(reference.purpose).toBe("map-reference-only");
  expect(reference.license).toBe("ODbL-1.0");
  expect(new Set(reference.segments.map((s: any) => s.lineId))).toEqual(
    new Set(["mashhad:line:3", "mashhad:line:4"]),
  );
  for (const section of reference.segments) {
    const id = Number(section.id.split(":").at(-1));
    const way = snapshot.ways.find((w: any) => w.id === id);
    expect(way.tags.railway).toBe("construction");
    expect(way.tags.construction).toBe("subway");
    expect(section.status).toBe("under_construction");
    expect(section.coordinates).toEqual(
      way.geometry.map((p: any) => [p.lat, p.lon]),
    );
    for (const [lat, lng] of section.coordinates) {
      expect(lat).toBeGreaterThan(36);
      expect(lat).toBeLessThan(36.6);
      expect(lng).toBeGreaterThan(59.3);
      expect(lng).toBeLessThan(59.9);
    }
  }
  expect(
    reference.segments.some((s: any) => s.id === "osm:way:1388754301"),
  ).toBe(false);
  const relation = review.sources.find(
    (s: any) => s.type === "relation" && s.id === 5692274,
  );
  expect(relation.ways.find((w: any) => w.ref === 276449885).role).toBe(
    "inactive",
  );
  expect(relation.ways.find((w: any) => w.ref === 1388754302).role).toBe(
    "inactive",
  );
  const stations = read("data/cities/mashhad/stations.json");
  expect(stations).toHaveLength(38);
  expect(stations.some((s: any) => s.id.startsWith("osm:"))).toBe(false);
  const graph = read("data/cities/mashhad/graph.json");
  expect(graph.routes.some((r: any) => r.lineId === "mashhad:line:4")).toBe(
    false,
  );
});
