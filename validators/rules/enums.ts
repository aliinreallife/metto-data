import type { BuiltDataset } from "../validate.js";

const STATION_STATUSES = new Set(["operational", "under_construction", "planned", "temporarily_closed", "permanently_closed"]);
const STOP_STATUSES = new Set(["operational", "under_construction", "planned"]);
const SEGMENT_STATUSES = new Set(["operational", "under_construction", "planned", "temporarily_closed"]);
const MODES = new Set(["metro", "bus", "tram", "rail"]);
const AMENITY_KEYS = [
  "wc",
  "elevator",
  "atm",
  "coffeeShop",
  "fastFood",
  "groceryStore",
  "freeWifi",
  "prayerRoom",
  "parking",
  "police",
] as const;

/** Enum + amenity tri-state conformance (true|false|null, never undefined). */
export function checkEnums(ds: BuiltDataset): string[] {
  const errors: string[] = [];

  for (const s of ds.stations) {
    if (!STATION_STATUSES.has(s.status)) errors.push(`station ${s.id} has invalid status ${JSON.stringify(s.status)}`);
    for (const k of AMENITY_KEYS) {
      const v = (s.amenities as Record<string, unknown>)[k];
      if (v !== true && v !== false && v !== null) {
        errors.push(`station ${s.id} amenity ${k} must be true|false|null (got ${JSON.stringify(v)})`);
      }
    }
    if (s.amenitiesVerified !== undefined && typeof s.amenitiesVerified !== "boolean") {
      errors.push(`station ${s.id} has invalid amenitiesVerified ${JSON.stringify(s.amenitiesVerified)}`);
    }
    if (!s.names || typeof s.names.fa !== "string" || typeof s.names.en !== "string" || s.names.en.length === 0) {
      errors.push(`station ${s.id} has invalid names`);
    }
    if (!s.sourceKeys || typeof s.sourceKeys.upstreamKey !== "string" || s.sourceKeys.upstreamKey.length === 0) {
      errors.push(`station ${s.id} is missing sourceKeys.upstreamKey`);
    }
  }

  for (const l of ds.lines) {
    if (!MODES.has(l.mode)) errors.push(`line ${l.id} has invalid mode ${JSON.stringify(l.mode)}`);
    if (typeof l.color !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(l.color)) {
      errors.push(`line ${l.id} has invalid color ${JSON.stringify(l.color)}`);
    }
    if (!l.names || typeof l.names.en !== "string" || typeof l.names.fa !== "string") {
      errors.push(`line ${l.id} has invalid names`);
    }
  }

  for (const n of ds.networks) {
    if (!MODES.has(n.mode)) errors.push(`network ${n.id} has invalid mode ${JSON.stringify(n.mode)}`);
  }

  for (const r of ds.graph.routes) {
    for (const stop of r.stops) {
      if (!STOP_STATUSES.has(stop.status)) {
        errors.push(`route ${r.id} stop ${stop.stationId} has invalid status ${JSON.stringify(stop.status)}`);
      }
    }
  }

  for (const s of ds.graph.segments) {
    if (!SEGMENT_STATUSES.has(s.status)) {
      errors.push(`segment ${s.id} has invalid status ${JSON.stringify(s.status)}`);
    }
  }

  return errors;
}
