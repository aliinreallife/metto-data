import { beforeAll, describe, expect, it } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildTehran } from "../importers/tehran.js";
import { validateDataset, validateCityDir, type BuiltDataset } from "../validators/validate.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");

let baseline: BuiltDataset;

beforeAll(() => {
  const result = buildTehran(repoRoot);
  baseline = {
    city: result.city,
    agencies: result.agencies,
    networks: result.networks,
    stations: result.stations,
    lines: result.lines,
    graph: result.graph,
  };
});

function clone(): BuiltDataset {
  return structuredClone(baseline);
}

describe("validators", () => {
  it("accepts the built Tehran dataset", () => {
    expect(validateDataset(clone())).toEqual([]);
  });

  it("accepts the dataset on disk (requires a fresh pnpm build)", () => {
    expect(validateCityDir(join(repoRoot, "data", "cities", "tehran"), "tehran")).toEqual([]);
  });

  it("fails on duplicate station ids", () => {
    const ds = clone();
    ds.stations.push(structuredClone(ds.stations[0]));
    expect(validateDataset(ds).join("\n")).toMatch(/duplicate station id/);
  });

  it("fails on duplicate segment ids", () => {
    const ds = clone();
    ds.graph.segments.push(structuredClone(ds.graph.segments[0]));
    expect(validateDataset(ds).join("\n")).toMatch(/duplicate segment id/);
  });

  it("fails on orphan stations (in no route)", () => {
    const ds = clone();
    ds.stations.push({
      id: "tehran:station:ghost",
      cityId: "tehran",
      names: { fa: "شبح", en: "Ghost" },
      location: { lat: 35.7, lng: 51.4 },
      amenities: {
        wc: null, elevator: null, atm: null, coffeeShop: null, fastFood: null,
        groceryStore: null, freeWifi: null, prayerRoom: null, parking: null, police: null,
      },
      status: "operational",
      sourceKeys: { upstreamKey: "Ghost" },
    });
    expect(validateDataset(ds).join("\n")).toMatch(/orphan/);
  });

  it("fails on self-loop segments", () => {
    const ds = clone();
    ds.graph.segments[0] = { ...ds.graph.segments[0], to: ds.graph.segments[0].from };
    // Repair route consecutiveness so the self-loop is the reported fault.
    const route = ds.graph.routes.find((r) => r.id === ds.graph.segments[0].routeId);
    if (route && route.stops.length > 1) {
      route.stops[1] = { ...route.stops[1], stationId: route.stops[0].stationId };
    }
    expect(validateDataset(ds).join("\n")).toMatch(/self-loop/);
  });

  it("fails on segments that are not consecutive route pairs", () => {
    const ds = clone();
    ds.graph.segments[0] = { ...ds.graph.segments[0], to: "tehran:station:kahrizak" };
    expect(validateDataset(ds).join("\n")).toMatch(/not a consecutive pair/);
  });

  it("fails on missing route segments", () => {
    const ds = clone();
    const victim = ds.graph.routes[0];
    const a = victim.stops[0].stationId;
    const b = victim.stops[1].stationId;
    ds.graph.segments = ds.graph.segments.filter(
      (s) =>
        !(
          s.routeId === victim.id &&
          ((s.from === a && s.to === b) || (s.from === b && s.to === a))
        ),
    );
    expect(validateDataset(ds).join("\n")).toMatch(/missing segment/);
  });

  it("fails on transfers with non-positive walks or identical lines", () => {
    const zero = clone();
    zero.graph.transfers[0] = { ...zero.graph.transfers[0], walkSeconds: 0 };
    expect(validateDataset(zero).join("\n")).toMatch(/walkSeconds/);

    const same = clone();
    same.graph.transfers[0] = { ...same.graph.transfers[0], toLineId: same.graph.transfers[0].fromLineId };
    expect(validateDataset(same).join("\n")).toMatch(/different lines/);
  });

  it("fails on transfers that are not stable namespaced ids", () => {
    const ds = clone();
    ds.graph.transfers[0] = { ...ds.graph.transfers[0], id: "tehran:transfer:wrong" };
    expect(validateDataset(ds).join("\n")).toMatch(/not stable/);
  });

  it("fails on unknown line references", () => {
    const ds = clone();
    ds.lines[0] = { ...ds.lines[0], agencyId: "tehran:agency:ghost" };
    expect(validateDataset(ds).join("\n")).toMatch(/unknown agency/);
  });

  it("fails on out-of-bounds coordinates", () => {
    const ds = clone();
    ds.stations[0] = { ...ds.stations[0], location: { lat: 0, lng: 0 } };
    expect(validateDataset(ds).join("\n")).toMatch(/outside Iran bounds/);
  });

  it("fails on non-tri-state amenities", () => {
    const ds = clone();
    (ds.stations[0].amenities as Record<string, unknown>)["wc"] = undefined;
    expect(validateDataset(ds).join("\n")).toMatch(/true\|false\|null/);
  });

  it("fails on disconnected operational stations", () => {
    const ds = clone();
    // Isolate an operational terminal by closing its only operational edge.
    const last = ds.graph.routes.find((r) => r.id === "tehran:route:line-2-main");
    const seg = ds.graph.segments.find(
      (s) => s.routeId === "tehran:route:line-2-main" && s.to === "tehran:station:tehran-sadeghiyeh",
    );
    expect(last && seg).toBeTruthy();
    seg!.status = "under_construction";
    // Sadeghiyeh is still reachable via line 5, so also close its line-5 edge.
    const seg5 = ds.graph.segments.find(
      (s) => s.routeId === "tehran:route:line-5-main" && s.from === "tehran:station:tehran-sadeghiyeh",
    );
    seg5!.status = "under_construction";
    expect(validateDataset(ds).join("\n")).toMatch(/disconnected/);
  });
});
