/**
 * Mashhad importer: a pinned, untouched ODbL snapshot plus explicitly
 * curated ordered routes and evidence-backed corrections. Never infer
 * operational service, line topology or facility availability from relations[].
 * Unverified facilities stay null. Do not consume before PR review.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { slugifyEnglishName, namespacedId } from "./lib/slug.js";
import { toCoordinate } from "./lib/coords.js";
import type { Agency, Amenities, City, CityGraph, Connection, Line, Network, Route, Station } from "../schema/v1/types.js";

type RawStation = {
  name?: string; translations?: { fa?: string }; lines?: number[];
  colors?: string[]; latitude?: string | number; longitude?: string | number;
  relations?: string[]; [key: string]: unknown;
};
type Correction = {
  upstreamKey: string;
  location?: { lat: number; lng: number };
  names?: { fa?: string; en?: string };
  source: { id: string; url: string; license: string; checkedAt: string; note: string };
};
const AMENITIES: Amenities = {
  wc: null, elevator: null, atm: null, coffeeShop: null, fastFood: null,
  groceryStore: null, freeWifi: null, prayerRoom: null, parking: null, police: null,
};
const CITY = "mashhad";
const AGENCY = "mashhad:agency:mashhad-metro";
const NETWORK = "mashhad:network:metro";

export function buildMashhad(repoRoot: string) {
  const sourcePath = join(repoRoot, "upstream-mashhad-metro", "data", "stations.json");
  const raw = JSON.parse(readFileSync(sourcePath, "utf8")) as Record<string, RawStation>;
  const sources = JSON.parse(readFileSync(join(repoRoot, "sources.json"), "utf8")) as Record<string, { stationCount: number }>;
  const expected = sources.mashhad.stationCount;
  const upstreamKeys = Object.keys(raw);
  if (upstreamKeys.length !== expected) throw new Error(`mashhad: expected ${expected} upstream stations, found ${upstreamKeys.length}`);
  const fixes = JSON.parse(readFileSync(join(repoRoot, "overrides", "mashhad.overrides.json"), "utf8")) as { corrections: Correction[] };
  const corrected = new Map<string, Correction>();
  for (const fix of fixes.corrections) {
    if (!raw[fix.upstreamKey] || corrected.has(fix.upstreamKey)) throw new Error(`mashhad: invalid/duplicate correction for ${fix.upstreamKey}`);
    if (!fix.source?.url || !fix.source?.id || !fix.source?.license || !fix.source?.checkedAt) throw new Error(`mashhad: missing evidence for ${fix.upstreamKey}`);
    corrected.set(fix.upstreamKey, fix);
  }
  const lineColors = new Map<number, string>();
  const stations: Station[] = upstreamKeys.map((key) => {
    const s = raw[key];
    if (!s || !Array.isArray(s.lines) || !Array.isArray(s.colors) || !s.lines.length || s.lines.length !== s.colors.length) {
      throw new Error(`mashhad: invalid line/color membership for ${key}`);
    }
    s.lines.forEach((n, i) => {
      const color = s.colors![i];
      if (!Number.isInteger(n) || !/^#[0-9A-Fa-f]{6}$/.test(color)) throw new Error(`mashhad: invalid line/color for ${key}`);
      if (lineColors.has(n) && lineColors.get(n)!.toLowerCase() !== color.toLowerCase()) throw new Error(`mashhad: inconsistent color for line ${n}`);
      lineColors.set(n, color);
    });
    const fix = corrected.get(key);
    const en = fix?.names?.en ?? s.name ?? key;
    const lat = toCoordinate(fix?.location?.lat ?? s.latitude, "lat");
    const lng = toCoordinate(fix?.location?.lng ?? s.longitude, "lng");
    return {
      id: namespacedId(CITY, "station", slugifyEnglishName(key)), cityId: CITY,
      names: { fa: fix?.names?.fa ?? s.translations?.fa ?? "", en },
      location: { lat, lng }, amenities: { ...AMENITIES }, amenitiesVerified: false,
      status: "operational" as const, sourceKeys: { upstreamKey: key },
    };
  });
  const byId = new Map(stations.map(s => [s.id, s]));
  if (byId.size !== stations.length) throw new Error("mashhad: station ID collisions");
  const seenCoordinates = new Map<string, string>();
  const englishNames = new Map<string, string>();
  for (const s of stations) {
    if (s.location.lat < 36.2 || s.location.lat > 36.4 || s.location.lng < 59.4 || s.location.lng > 59.8) throw new Error(`mashhad: implausible station location ${s.id}`);
    const xy = `${s.location.lat.toFixed(5)}:${s.location.lng.toFixed(5)}`;
    if (seenCoordinates.has(xy)) throw new Error(`mashhad: duplicate station coordinates ${seenCoordinates.get(xy)} and ${s.id}`);
    seenCoordinates.set(xy, s.id);
    const english = s.names.en.trim().toLowerCase();
    if (englishNames.has(english)) throw new Error(`mashhad: duplicate English station name ${english}: ${englishNames.get(english)} and ${s.id}`);
    englishNames.set(english, s.id);
  }
  const routes = JSON.parse(readFileSync(join(repoRoot, "topology", "mashhad.routes.json"), "utf8")) as Route[];
  const segments: Connection[] = [];
  const allRouted = new Set<string>();
  for (const route of routes) {
    if (!route.stops || route.stops.length < 2) throw new Error(`mashhad: short route ${route.id}`);
    const lineNo = Number(route.lineId.split(":").at(-1));
    if (!lineColors.has(lineNo)) throw new Error(`mashhad: unknown line for route ${route.id}`);
    const visited = new Set<string>();
    route.stops.forEach(({stationId}) => {
      const record = byId.get(stationId);
      if (!record) throw new Error(`mashhad: unknown route station ${stationId}`);
      const sourceRecord = raw[record.sourceKeys.upstreamKey];
      if (!sourceRecord.lines?.includes(lineNo)) throw new Error(`mashhad: station ${stationId} not on line ${lineNo}`);
      if (visited.has(stationId)) throw new Error(`mashhad: repeated station on route ${route.id}`);
      visited.add(stationId); allRouted.add(stationId);
    });
    for (let i = 1; i < route.stops.length; i++) {
      const a = route.stops[i-1].stationId, b = route.stops[i].stationId;
      segments.push({
        id: namespacedId(CITY, "segment", `line-${lineNo}-${a.split(":").at(-1)}-${b.split(":").at(-1)}`),
        cityId: CITY, lineId: route.lineId, routeId: route.id, from: a, to: b, status: "operational",
      });
    }
  }
  if (allRouted.size !== stations.length) throw new Error(`mashhad: ${stations.length - allRouted.size} orphan source stations`);
  if (routes.length !== lineColors.size) throw new Error("mashhad: expected one reviewed route per line");
  const city: City = { id: CITY, names: { fa: "مشهد", en: "Mashhad" }, country: "IR", timezone: "Asia/Tehran" };
  const agencies: Agency[] = [{ id: AGENCY, cityId: CITY, names: { fa: "قطار شهری مشهد", en: "Mashhad Urban Railway" } }];
  const networks: Network[] = [{ id: NETWORK, cityId: CITY, agencyId: AGENCY, mode: "metro" }];
  const lines: Line[] = [...lineColors.entries()].sort(([a],[b]) => a-b).map(([no,color]) => ({
    id: namespacedId(CITY,"line",String(no)), cityId: CITY, agencyId: AGENCY, networkId: NETWORK,
    mode:"metro", code:String(no), names:{ fa:`خط ${no}`, en:`Line ${no}` }, color,
  }));
  const aliases: Record<string,string> = {};
  for (const key of upstreamKeys) {
    const id = namespacedId(CITY,"station",slugifyEnglishName(key));
    aliases[key] = id;
    // Do not use a demonstrably incorrect upstream display name as an alias.
    const canonicalName = byId.get(id)!.names.en;
    if (canonicalName !== key) aliases[canonicalName] = id;
  }
  // Review gate: exact walk times are unknown; never invent transfer times.
  const graph: CityGraph = { routes, segments, transfers: [], aliases };
  return { city, agencies, networks, stations, lines, graph, warnings: [
    "Mashhad: timetable, entrance points and line colors not independently verified",
    "Mashhad: transfer walking seconds require measurement before routing release",
  ] };
}
