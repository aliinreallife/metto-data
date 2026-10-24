/**
 * Tehran importer: upstream-tehran-metro/data/stations.json → data/cities/tehran/*.
 *
 * Pipeline (nothing here writes inside upstream-tehran-metro/):
 *   1. read upstream map (Record<EnName, station>), assert 150 keys (sources.json)
 *   2. coerce lat/lng (string|number), assert lines.length === colors.length
 *   3. slug → tehran:station:<slug>; map amenities allowlist
 *      (wc,elevator,atm,coffeeShop,fastFood,groceryStore,freeWifi,prayerRoom,
 *       bicycleParking→parking,metroPolice→police); true→true, false→false,
 *       null/missing→null; quarantine unknown keys (fastFoodn typo etc.) as warnings
 *   4. apply overrides/tehran.overrides.json (Soleimani pin, status overrides,
 *      Fakhrizadeh insert after Golshahr)
 *   5. fold contributions/approved/ (tehran, status approved) as operations
 *   6. join topology/tehran.*.json → graph.json; emit stations/lines/graph +
 *      city/agencies/networks.
 *
 * Lines are derived PURELY from upstream lines[]/colors[] (never from the Metto
 * LINES table): distinct line numbers, one consistent color per line (abort on
 * conflict), names synthesized as `Line N` / `خط N`.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { slugifyEnglishName, namespacedId } from "./lib/slug.js";
import { toCoordinate } from "./lib/coords.js";
import { applyApprovedContributions } from "./lib/contributions.js";
import type {
  Agency,
  Amenities,
  AmenityKey,
  City,
  CityGraph,
  Connection,
  InfrastructureStatus,
  Line,
  Network,
  Route,
  Station,
  TransferRule,
} from "../schema/v1/types.js";

const CITY_ID = "tehran";
const AGENCY_ID = "tehran:agency:tehran-metro";
const NETWORK_ID = "tehran:network:metro";

export interface TehranBuildResult {
  city: City;
  agencies: Agency[];
  networks: Network[];
  stations: Station[];
  lines: Line[];
  graph: CityGraph;
  warnings: string[];
}

type UpstreamStation = {
  name?: string;
  translations?: { fa?: string };
  latitude: unknown;
  longitude: unknown;
  lines?: unknown;
  colors?: unknown;
  wc?: unknown;
  elevator?: unknown;
  atm?: unknown;
  coffeeShop?: unknown;
  fastFood?: unknown;
  groceryStore?: unknown;
  freeWifi?: unknown;
  prayerRoom?: unknown;
  bicycleParking?: unknown;
  metroPolice?: unknown;
  [k: string]: unknown;
};

type Overrides = {
  soleimaniOverride: { en: string; location: { lat: number; lng: number } };
  statusOverrides: Record<string, string>;
  /** Metto's source-of-truth exception for a route's boarding status. */
  routeStopStatusOverrides: Array<{
    routeId: string;
    stationId: string;
    expectedStatus: "operational" | "under_construction" | "planned";
    status: "operational" | "under_construction" | "planned";
    source: string;
    reason: string;
  }>;
  fakhrizadeh: {
    id: string;
    name: { fa: string; en: string };
    location: { lat: number; lng: number };
    amenities: Record<string, boolean | null>;
    amenitiesVerified: boolean;
    status: string;
    insertAfterUpstreamKey: string;
  };
};

const KNOWN_UPSTREAM_KEYS = new Set([
  "name",
  "translations",
  "latitude",
  "longitude",
  "lines",
  "colors",
  "address",
  "disabled",
  "relations",
  "wc",
  "elevator",
  "atm",
  "coffeeShop",
  "fastFood",
  "groceryStore",
  "freeWifi",
  "prayerRoom",
  "bicycleParking",
  "metroPolice",
]);

function toNullableBool(v: unknown, upstreamKey: string, field: string): boolean | null {
  if (v === undefined || v === null) return null;
  if (v === true) return true;
  if (v === false) return false;
  throw new Error(`invalid amenity ${field} (upstream ${upstreamKey}): ${JSON.stringify(v)}`);
}

export function repoRootFromHere(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

export function buildTehran(repoRoot: string = repoRootFromHere()): TehranBuildResult {
  const warnings: string[] = [];

  // --- 1. upstream + sources.json ---
  const sources = JSON.parse(readFileSync(join(repoRoot, "sources.json"), "utf8")) as Record<
    string,
    { stationCount?: number }
  >;
  const expectedCount = sources[CITY_ID]?.stationCount ?? 150;
  const upstreamPath = join(repoRoot, "upstream-tehran-metro", "data", "stations.json");
  const upstream = JSON.parse(readFileSync(upstreamPath, "utf8")) as Record<string, UpstreamStation>;
  const upstreamKeys = Object.keys(upstream);
  if (upstreamKeys.length !== expectedCount) {
    throw new Error(
      `tehran importer: expected ${expectedCount} upstream stations (sources.json), found ${upstreamKeys.length}`,
    );
  }

  // --- 2+3. coerce + slug + amenities; derive line colors ---
  const lineColor = new Map<number, string>();
  const stations: Station[] = [];

  for (const upstreamKey of upstreamKeys) {
    const u = upstream[upstreamKey];
    const en = typeof u.name === "string" && u.name.length > 0 ? u.name : upstreamKey;
    const fa = u.translations?.fa ?? "";
    const slug = slugifyEnglishName(en);
    if (!slug) throw new Error(`tehran importer: empty slug for upstream key ${JSON.stringify(upstreamKey)}`);
    const id = namespacedId(CITY_ID, "station", slug);

    const lat = toCoordinate(u.latitude, "lat");
    const lng = toCoordinate(u.longitude, "lng");

    const lines = u.lines;
    const colors = u.colors;
    if (!Array.isArray(lines) || !Array.isArray(colors)) {
      throw new Error(`tehran importer: ${upstreamKey} lines/colors must be arrays`);
    }
    if (lines.length !== colors.length) {
      throw new Error(
        `tehran importer: ${upstreamKey} lines.length (${lines.length}) !== colors.length (${colors.length})`,
      );
    }
    for (let i = 0; i < lines.length; i++) {
      const lineNo = lines[i];
      const color = colors[i];
      if (typeof lineNo !== "number" || !Number.isInteger(lineNo)) {
        throw new Error(`tehran importer: ${upstreamKey} invalid line number ${JSON.stringify(lineNo)}`);
      }
      if (typeof color !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
        throw new Error(`tehran importer: ${upstreamKey} invalid color ${JSON.stringify(color)}`);
      }
      const prev = lineColor.get(lineNo);
      if (prev === undefined) lineColor.set(lineNo, color);
      else if (prev.toLowerCase() !== color.toLowerCase()) {
        throw new Error(
          `tehran importer: conflicting colors for line ${lineNo}: ${prev} vs ${color} (at ${upstreamKey})`,
        );
      }
    }

    const amenities: Amenities = {
      wc: toNullableBool(u.wc, upstreamKey, "wc"),
      elevator: toNullableBool(u.elevator, upstreamKey, "elevator"),
      atm: toNullableBool(u.atm, upstreamKey, "atm"),
      coffeeShop: toNullableBool(u.coffeeShop, upstreamKey, "coffeeShop"),
      fastFood: toNullableBool(u.fastFood, upstreamKey, "fastFood"),
      groceryStore: toNullableBool(u.groceryStore, upstreamKey, "groceryStore"),
      freeWifi: toNullableBool(u.freeWifi, upstreamKey, "freeWifi"),
      prayerRoom: toNullableBool(u.prayerRoom, upstreamKey, "prayerRoom"),
      parking: toNullableBool(u.bicycleParking, upstreamKey, "parking"),
      police: toNullableBool(u.metroPolice, upstreamKey, "police"),
    };

    for (const k of Object.keys(u)) {
      if (!KNOWN_UPSTREAM_KEYS.has(k)) {
        warnings.push(`upstream ${upstreamKey}: quarantined unknown key ${JSON.stringify(k)}`);
      }
    }

    stations.push({
      id,
      cityId: CITY_ID,
      names: { fa, en },
      location: { lat, lng },
      amenities,
      status: "operational",
      sourceKeys: { upstreamKey },
    });
  }

  // --- 4. overrides ---
  const overrides = JSON.parse(
    readFileSync(join(repoRoot, "overrides", "tehran.overrides.json"), "utf8"),
  ) as Overrides;

  const byUpstreamKey = new Map(stations.map((s) => [s.sourceKeys.upstreamKey, s]));
  const soleimani = byUpstreamKey.get(overrides.soleimaniOverride.en);
  if (!soleimani) {
    throw new Error(`tehran importer: soleimaniOverride target missing: ${overrides.soleimaniOverride.en}`);
  }
  soleimani.location = {
    lat: overrides.soleimaniOverride.location.lat,
    lng: overrides.soleimaniOverride.location.lng,
  };

  for (const [stationId, status] of Object.entries(overrides.statusOverrides)) {
    const st = stations.find((s) => s.id === stationId);
    if (!st) throw new Error(`tehran importer: statusOverrides target missing: ${stationId}`);
    st.status = status as InfrastructureStatus;
  }

  const f = overrides.fakhrizadeh;
  if (stations.some((s) => s.id === f.id)) {
    throw new Error(`tehran importer: fakhrizadeh id collision: ${f.id}`);
  }
  const fakhrizadeh: Station = {
    id: f.id,
    cityId: CITY_ID,
    names: { fa: f.name.fa, en: f.name.en },
    location: { lat: f.location.lat, lng: f.location.lng },
    amenities: {
      wc: f.amenities.wc,
      elevator: f.amenities.elevator,
      atm: f.amenities.atm,
      coffeeShop: f.amenities.coffeeShop,
      fastFood: f.amenities.fastFood,
      groceryStore: f.amenities.groceryStore,
      freeWifi: f.amenities.freeWifi,
      prayerRoom: f.amenities.prayerRoom,
      parking: f.amenities.parking,
      police: f.amenities.police,
    },
    amenitiesVerified: f.amenitiesVerified,
    status: f.status as InfrastructureStatus,
    sourceKeys: { upstreamKey: "__metto__:shahid-fakhrizadeh" },
  };
  const anchorIdx = stations.findIndex((s) => s.sourceKeys.upstreamKey === f.insertAfterUpstreamKey);
  if (anchorIdx < 0) {
    throw new Error(`tehran importer: fakhrizadeh anchor missing: ${f.insertAfterUpstreamKey}`);
  }
  stations.splice(anchorIdx + 1, 0, fakhrizadeh);

  // --- lines (purely upstream) ---
  const lineNos = [...lineColor.keys()].sort((a, b) => a - b);
  const lines: Line[] = lineNos.map((n) => ({
    id: namespacedId(CITY_ID, "line", String(n)),
    cityId: CITY_ID,
    agencyId: AGENCY_ID,
    networkId: NETWORK_ID,
    mode: "metro",
    code: String(n),
    names: { fa: `خط ${n}`, en: `Line ${n}` },
    color: lineColor.get(n) as string,
  }));

  // --- city / agency / network (canonical published entities) ---
  const city: City = {
    id: CITY_ID,
    names: { fa: "تهران", en: "Tehran" },
    country: "IR",
    timezone: "Asia/Tehran",
  };
  const agencies: Agency[] = [
    { id: AGENCY_ID, cityId: CITY_ID, names: { fa: "متروی تهران", en: "Tehran Metro" } },
  ];
  const networks: Network[] = [{ id: NETWORK_ID, cityId: CITY_ID, agencyId: AGENCY_ID, mode: "metro" }];

  // --- 6. topology join (fail closed when missing) ---
  const routesRaw = JSON.parse(
    readFileSync(join(repoRoot, "topology", "tehran.routes.json"), "utf8"),
  ) as Route[];
  const segmentsRaw = JSON.parse(
    readFileSync(join(repoRoot, "topology", "tehran.segments.json"), "utf8"),
  ) as Connection[];
  const transfersRaw = JSON.parse(
    readFileSync(join(repoRoot, "topology", "tehran.transfers.json"), "utf8"),
  ) as TransferRule[];
  const aliases = JSON.parse(
    readFileSync(join(repoRoot, "topology", "tehran.aliases.json"), "utf8"),
  ) as Record<string, string>;
  if (!Array.isArray(routesRaw) || routesRaw.length === 0) {
    throw new Error("tehran importer: topology/tehran.routes.json missing or empty — refusing to emit graph.json");
  }
  if (!Array.isArray(segmentsRaw) || segmentsRaw.length === 0) {
    throw new Error("tehran importer: topology/tehran.segments.json missing or empty — refusing to emit graph.json");
  }
  const graph: CityGraph = { routes: routesRaw, segments: segmentsRaw, transfers: transfersRaw, aliases };

  // --- 5. fold independently reviewed community corrections ---
  applyApprovedContributions(repoRoot, CITY_ID, { stations, lines, graph });

  // --- final: protect the one explicitly approved Metto boarding override ---
  // Station/track statuses and other line stops are intentionally untouched.
  const seenOverrides = new Set<string>();
  for (const rule of overrides.routeStopStatusOverrides ?? []) {
    if (typeof rule.routeId !== "string" || typeof rule.stationId !== "string" ||
        !["operational", "under_construction", "planned"].includes(rule.status) ||
        !["operational", "under_construction", "planned"].includes(rule.expectedStatus) ||
        typeof rule.source !== "string" || !rule.source.startsWith("metto/") ||
        typeof rule.reason !== "string" || !rule.reason.trim()) {
      throw new Error("tehran importer: malformed Metto route stop override");
    }
    const key = `${rule.routeId}:${rule.stationId}`;
    if (seenOverrides.has(key)) throw new Error(`tehran importer: duplicate route stop override ${key}`);
    seenOverrides.add(key);
    const route = graph.routes.find((r) => r.id === rule.routeId);
    const stop = route?.stops.find((s) => s.stationId === rule.stationId);
    if (!stop) throw new Error(`tehran importer: missing route stop override target ${key}`);
    // A changed topology or a new review of the canonical status must cause
    // a visible failed build instead of applying a stale instruction blindly.
    if (stop.status !== rule.expectedStatus && stop.status !== rule.status) {
      throw new Error(`tehran importer: route stop override ${key} expected ${rule.expectedStatus}, got ${stop.status}`);
    }
    stop.status = rule.status;
  }
  return { city, agencies, networks, stations, lines, graph, warnings };
}
