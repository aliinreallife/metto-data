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
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { slugifyEnglishName, namespacedId } from "./lib/slug.js";
import { toCoordinate } from "./lib/coords.js";
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

  // --- 5. fold approved contributions ---
  const stationsById = new Map(stations.map((s) => [s.id, s]));
  const linesById = new Map(lines.map((l) => [l.id, l]));
  const transfersById = new Map(transfersRaw.map((t) => [t.id, t]));
  const segmentsById = new Map(segmentsRaw.map((s) => [s.id, s]));
  let approved: Array<{
    id?: string;
    city?: string;
    entityType?: string;
    entityId?: string;
    status?: string;
    operations?: Array<{ op?: string; path?: string; value?: unknown }>;
  }> = [];
  try {
    const files = readdirSync(join(repoRoot, "contributions", "approved"));
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const doc = JSON.parse(readFileSync(join(repoRoot, "contributions", "approved", file), "utf8"));
      approved.push(doc);
    }
  } catch {
    approved = [];
  }
  approved.sort((a, b) => String(a.id ?? "").localeCompare(String(b.id ?? "")));
  for (const doc of approved) {
    if (doc.city !== CITY_ID || doc.status !== "approved") continue;
    if (!doc.entityId || !Array.isArray(doc.operations)) continue;
    for (const op of doc.operations) {
      if (!op.path) continue;
      applyOperation(
        { stationsById, linesById, transfersById, segmentsById },
        doc.entityType ?? "",
        doc.entityId,
        op.op ?? "set",
        op.path,
        op.value,
      );
    }
  }

  return { city, agencies, networks, stations, lines, graph, warnings };
}

function applyOperation(
  idx: {
    stationsById: Map<string, Station>;
    linesById: Map<string, Line>;
    transfersById: Map<string, TransferRule>;
    segmentsById: Map<string, Connection>;
  },
  entityType: string,
  entityId: string,
  op: string,
  path: string,
  value: unknown,
): void {
  if (op !== "set" && op !== "add") return;
  if (entityType === "station") {
    const st = idx.stationsById.get(entityId);
    if (!st) throw new Error(`tehran importer: contribution targets unknown station ${entityId}`);
    applyStationPath(st, path, value);
    return;
  }
  if (entityType === "line") {
    const line = idx.linesById.get(entityId);
    if (!line) throw new Error(`tehran importer: contribution targets unknown line ${entityId}`);
    if (path === "/color" && typeof value === "string") line.color = value;
    else if ((path === "/name/en" || path === "/names/en") && typeof value === "string") line.names.en = value;
    else if ((path === "/name/fa" || path === "/names/fa") && typeof value === "string") line.names.fa = value;
    return;
  }
  if (entityType === "transfer") {
    const t = idx.transfersById.get(entityId);
    if (!t) throw new Error(`tehran importer: contribution targets unknown transfer ${entityId}`);
    if (path === "/walkSeconds" && typeof value === "number") t.walkSeconds = value;
    return;
  }
  if (entityType === "connection") {
    const c = idx.segmentsById.get(entityId);
    if (!c) throw new Error(`tehran importer: contribution targets unknown connection ${entityId}`);
    if (path === "/status" && typeof value === "string") c.status = value as Connection["status"];
  }
}

function applyStationPath(st: Station, path: string, value: unknown): void {
  if (path.startsWith("/amenities/")) {
    const key = path.slice("/amenities/".length) as AmenityKey;
    if (!(["wc", "elevator", "atm", "coffeeShop", "fastFood", "groceryStore", "freeWifi", "prayerRoom", "parking", "police"] as string[]).includes(key)) {
      throw new Error(`tehran importer: contribution has disallowed amenity path ${path}`);
    }
    if (value !== true && value !== false && value !== null) {
      throw new Error(`tehran importer: contribution amenity value must be true|false|null (${path})`);
    }
    st.amenities[key] = value;
    return;
  }
  if (path === "/location/lat" && typeof value === "number") {
    st.location.lat = value;
    return;
  }
  if (path === "/location/lng" && typeof value === "number") {
    st.location.lng = value;
    return;
  }
  if ((path === "/name/fa" || path === "/names/fa") && typeof value === "string") {
    st.names.fa = value;
    return;
  }
  if ((path === "/name/en" || path === "/names/en") && typeof value === "string") {
    st.names.en = value;
    return;
  }
  if (path === "/status" && typeof value === "string") {
    st.status = value as InfrastructureStatus;
  }
}
