/** Rebuild the map-only reference layer from the reviewed, pinned OSM snapshot. */
import { readFileSync, writeFileSync } from "node:fs";
const root = new URL("../", import.meta.url);
const snapshot = JSON.parse(
  readFileSync(
    new URL("sources/mashhad/construction-map-snapshot.json", root),
    "utf8",
  ),
);
const review = JSON.parse(
  readFileSync(
    new URL("sources/mashhad/construction-map-review.json", root),
    "utf8",
  ),
);
const artifact = JSON.parse(
  readFileSync(
    new URL("data/reference/mashhad-construction.json", root),
    "utf8",
  ),
);
artifact.retrievedAt = snapshot.retrievedAt;
artifact.rendering = "straight-between-mapped-stops";
const futureStops = new Map();
artifact.segments = snapshot.ways.map((way: any) => {
  const source = review.sources.find(
    (entry: any) => entry.type === "way" && entry.id === way.id,
  );
  if (
    !source ||
    source.version !== way.version ||
    way.tags.railway !== "construction" ||
    way.tags.construction !== "subway"
  )
    throw Error(`Unreviewed construction way: ${way.id}`);
  const line =
    way.tags["name:en"] === "Line 4 Mashhad Metro"
      ? "4"
      : way.tags["name:en"] === "Line 3 Mashhad Metro"
        ? "3"
        : null;
  if (!line) throw Error(`Unidentified line: ${way.id}`);
  const stops = way.geometry.filter(
    (point: any, index: number) =>
      index === 0 || index === way.geometry.length - 1 || point.tags?.name,
  );
  for (const point of stops) {
    const tags = point.tags ?? {};
    if (
      tags.name &&
      (tags.railway === "proposed" || tags["proposed:railway"] === "station")
    ) {
      const id = `osm:node:${point.id}`;
      const old = futureStops.get(id);
      futureStops.set(id, {
        id,
        names: { fa: tags.name, en: tags["name:en"] || tags.name },
        location: { lat: point.lat, lng: point.lon },
        status: "planned",
        lineIds: [
          ...new Set([...(old?.lineIds ?? []), `mashhad:line:${line}`]),
        ],
      });
    }
  }
  return {
    id: `osm:way:${way.id}`,
    lineId: `mashhad:line:${line}`,
    names: { fa: `خط ${line === "4" ? "۴" : "۳"}`, en: `Line ${line}` },
    status: "under_construction",
    displayColor: line === "4" ? "#a78bfa" : "#FA9702",
    coordinates: stops.map((point: any) => [point.lat, point.lon]),
  };
});
artifact.futureStops = [...futureStops.values()];
const result = JSON.stringify(artifact, null, 2) + "\n";
const target = new URL("data/reference/mashhad-construction.json", root);
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== result)
    throw Error(
      "Construction reference differs from its pinned snapshot. Run pnpm map-reference:build.",
    );
} else writeFileSync(target, result);
console.log("Construction map reference matches reviewed OSM snapshot.");
