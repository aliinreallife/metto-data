import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildTehran } from "../importers/tehran.js";
import { createFixture, cleanupFixtures } from "./fixtures.js";

const LINE_COLORS: Record<string, string> = {
  "tehran:line:1": "#E0001F",
  "tehran:line:2": "#2F4389",
  "tehran:line:3": "#67C5F5",
  "tehran:line:4": "#F8E100",
  "tehran:line:5": "#007E46",
  "tehran:line:6": "#EF639F",
  "tehran:line:7": "#7F0B74",
};

describe("tehran importer", () => {
  // Each test builds from its own temp-dir fixture (see fixtures.ts), so
  // parallel workers never share mutable state. No test writes into the repo.
  let fx: string;
  beforeEach(() => {
    fx = createFixture();
  });
  afterEach(() => {
    cleanupFixtures();
  });

  it("produces the expected entity counts (150 upstream + Fakhrizadeh)", () => {
    const result = buildTehran(fx);
    expect(result.stations).toHaveLength(151);
    expect(result.lines).toHaveLength(7);
    expect(result.graph.routes).toHaveLength(9);
    expect(result.graph.segments).toHaveLength(163);
    expect(result.graph.transfers).toHaveLength(2);
  });

  it("derives lines purely from upstream with one consistent color each", () => {
    const { lines } = buildTehran(fx);
    const ids = lines.map((l) => l.id).sort();
    expect(ids).toEqual(Object.keys(LINE_COLORS).sort());
    for (const line of lines) {
      expect(line.color).toBe(LINE_COLORS[line.id]);
      expect(line.cityId).toBe("tehran");
      expect(line.agencyId).toBe("tehran:agency:tehran-metro");
      expect(line.networkId).toBe("tehran:network:metro");
      expect(line.mode).toBe("metro");
      const code = line.id.split(":").at(-1) as string;
      expect(line.code).toBe(code);
      expect(line.names.en).toBe(`Line ${code}`);
    }
  });

  it("emits stable namespaced transfer IDs", () => {
    const { graph } = buildTehran(fx);
    const ids = graph.transfers.map((t) => t.id).sort();
    expect(ids).toEqual([
      "tehran:transfer:eram-e-sabz:4:5",
      "tehran:transfer:eram-e-sabz:5:4",
    ]);
    for (const t of graph.transfers) {
      expect(t.stationId).toBe("tehran:station:eram-e-sabz");
      expect(t.walkSeconds).toBe(480);
      expect(t.confidence).toBe("estimated");
      expect(t.fromLineId).toMatch(/^tehran:line:\d+$/);
      expect(t.toLineId).toMatch(/^tehran:line:\d+$/);
    }
  });

  it("generates aliases that all resolve to built stations", () => {
    const { stations, graph } = buildTehran(fx);
    const stationIds = new Set(stations.map((s) => s.id));
    expect(graph.aliases["Tajrish"]).toBe("tehran:station:tajrish");
    expect(graph.aliases["Shahed - BagherShahr"]).toBe("tehran:station:shahed-baghershahr");
    expect(Object.keys(graph.aliases).length).toBeGreaterThan(150);
    for (const [alias, target] of Object.entries(graph.aliases)) {
      expect(stationIds.has(target), `alias ${alias} -> ${target}`).toBe(true);
    }
  });

  it("applies overrides (Soleimani pin, UC statuses, Fakhrizadeh insert)", () => {
    const { stations } = buildTehran(fx);
    const byId = new Map(stations.map((s) => [s.id, s]));
    expect(byId.get("tehran:station:shahid-sepahbod-qasem-soleimani")?.location).toEqual({
      lat: 35.95882966952798,
      lng: 50.71920151458703,
    });
    for (const id of [
      "tehran:station:vavan",
      "tehran:station:chaharbagh",
      "tehran:station:haram-e-hazrat-e-abdol-azim",
      "tehran:station:meydan-e-hazrat-e-abdol-azim",
      "tehran:station:ebn-e-babviyeh",
      "tehran:station:cheshmeh-ali",
    ]) {
      expect(byId.get(id)?.status).toBe("under_construction");
    }
    const ids = stations.map((s) => s.id);
    const golshahr = ids.indexOf("tehran:station:golshahr");
    expect(ids[golshahr + 1]).toBe("tehran:station:shahid-fakhrizadeh");
  });

  describe("contribution folding", () => {
    it("folds approved proposals into stations and ignores non-approved ones", () => {
      const approvedId = randomUUID();
      const pendingId = randomUUID();
      const approvedDir = join(fx, "contributions", "approved");
      writeFileSync(
        join(approvedDir, `${approvedId}.json`),
        JSON.stringify({
          id: approvedId,
          city: "tehran",
          entityType: "station",
          entityId: "tehran:station:tajrish",
          changeType: "update",
          operations: [{ op: "set", path: "/amenities/elevator", value: true }],
          submittedBy: "test-contributor",
          submittedAt: "2026-09-11T00:00:00Z",
          status: "approved",
        }),
        "utf8",
      );
      // A pending-status file in approved/ must not be applied (defensive).
      writeFileSync(
        join(approvedDir, `${pendingId}.json`),
        JSON.stringify({
          id: pendingId,
          city: "tehran",
          entityType: "station",
          entityId: "tehran:station:tajrish",
          changeType: "update",
          operations: [{ op: "set", path: "/amenities/wc", value: true }],
          submittedBy: "test-contributor",
          submittedAt: "2026-09-11T00:00:00Z",
          status: "pending",
        }),
        "utf8",
      );

      const { stations } = buildTehran(fx);
      const tajrish = stations.find((s) => s.id === "tehran:station:tajrish");
      expect(tajrish?.amenities.elevator).toBe(true);
      expect(tajrish?.amenities.wc).toBe(false);
    });
  });
});
