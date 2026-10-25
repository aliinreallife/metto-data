import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { buildCatalog } from "../apps/data-portal/lib/catalog.js";
import {
  resolveTrainProfile,
  trainProfiles,
} from "../apps/data-portal/lib/train-layouts.js";
import { trainDirections } from "../apps/data-portal/lib/train-directions.js";
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
    names: { fa: id, en: id },
    candidate: false,
    stations: data(id, "stations"),
    lines: data(id, "lines"),
    graph: data(id, "graph"),
    ...(id === "mashhad"
      ? { allowedLineIds: ["mashhad:line:1", "mashhad:line:2"] }
      : {}),
  })),
);
const city = (id: string) => catalog.cities.find((city) => city.id === id);
it("maps every selectable layout to existing boarding routes on its own lines", () => {
  for (const profile of trainProfiles) {
    expect(profile.routeIds.length).toBeGreaterThan(0);
    for (const id of profile.routeIds) {
      const route = city(profile.cityId)?.routes.find(
        (route) => route.id === id,
      );
      expect(route).toBeDefined();
      expect(profile.lineIds).toContain(route?.lineId);
    }
  }
});
it("offers the two sourced terminal directions for the selected Mashhad line", () => {
  const line1 = trainDirections(
    city("mashhad"),
    resolveTrainProfile("mashhad"),
    "mashhad:station:basij",
  );
  expect(line1.map((d) => d.destinationId)).toEqual([
    "mashhad:station:vakilabad",
    "mashhad:station:airport",
  ]);
  expect(line1[1].oppositeId).toBe("mashhad:station:vakilabad");
  const line2 = trainDirections(
    city("mashhad"),
    resolveTrainProfile("mashhad", ["mashhad:line:2"]),
  );
  expect(line2.map((d) => d.destinationId)).toEqual([
    "mashhad:station:tabarsi",
    "mashhad:station:shahid-fakouri",
  ]);
  expect(
    trainDirections(
      city("mashhad"),
      resolveTrainProfile("mashhad"),
      "mashhad:station:tabarsi",
    ),
  ).toEqual([]);
});
it("keeps the airport shuttle's terminals separate from the main line at Bimeh", () => {
  const shuttle = resolveTrainProfile(
    "tehran",
    ["tehran:line:4"],
    "tehran:mehrabad:4",
  );
  expect(
    trainDirections(city("tehran"), shuttle, "tehran:station:bimeh").map(
      (d) => d.destinationId,
    ),
  ).toEqual([
    "tehran:station:bimeh",
    "tehran:station:mehrabad-airport-terminal-4-6",
  ]);
  const urban = trainDirections(
    city("tehran"),
    resolveTrainProfile("tehran"),
    "tehran:station:bimeh",
  );
  expect(urban).toHaveLength(2);
  expect(urban.every((d) => d.routeId === "tehran:route:line-4-main")).toBe(
    true,
  );
});
it("filters interchanges and branches to routes serving the actual station", () => {
  const directions = trainDirections(
    city("tehran"),
    resolveTrainProfile("tehran"),
    "tehran:station:tajrish",
  );
  expect(directions.map((d) => d.destinationId)).toEqual([
    "tehran:station:tajrish",
    "tehran:station:kahrizak",
  ]);
  expect(directions.some((d) => d.routeId.includes("parand"))).toBe(false);
  const mehrabad = resolveTrainProfile(
    "tehran",
    ["tehran:line:4"],
    "",
    "tehran:station:mehrabad-airport-terminal-1-2",
  );
  expect(
    trainDirections(
      city("tehran"),
      mehrabad,
      "tehran:station:mehrabad-airport-terminal-1-2",
    ),
  ).toHaveLength(2);
});
it("keeps both arrival directions at terminals and never invents cross-city or future services", () => {
  const profile = resolveTrainProfile("mashhad");
  expect(
    trainDirections(city("mashhad"), profile, "mashhad:station:airport"),
  ).toHaveLength(2);
  expect(trainDirections(city("tehran"), profile)).toEqual([]);
  expect(trainDirections(undefined, profile)).toEqual([]);
  expect(
    trainDirections(city("mashhad"), profile, "mashhad:station:future"),
  ).toEqual([]);
  expect(
    trainDirections(city("mashhad"), profile).every(
      (d) => d.lineId === "mashhad:line:1",
    ),
  ).toBe(true);
});
