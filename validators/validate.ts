// Dataset integrity checks (see validators/README.md for the rule list).
// Operates on built data/cities/* output only — never reads upstream-* directly.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Agency, City, CityGraph, Line, Network, Station } from "../schema/v1/types.js";
import { checkDuplicateIds } from "./rules/ids.js";
import { checkReferences } from "./rules/references.js";
import { checkCoordinates } from "./rules/coordinates.js";
import { checkGraph } from "./rules/graph.js";
import { checkTransfers } from "./rules/transfers.js";
import { checkEnums } from "./rules/enums.js";

export interface BuiltDataset {
  city: City;
  agencies: Agency[];
  networks: Network[];
  stations: Station[];
  lines: Line[];
  graph: CityGraph;
}

/** Fail-closed checks over an in-memory built dataset. Returns error strings. */
export function validateDataset(ds: BuiltDataset): string[] {
  return [
    ...checkDuplicateIds(ds),
    ...checkReferences(ds),
    ...checkCoordinates(ds),
    ...checkEnums(ds),
    ...checkGraph(ds),
    ...checkTransfers(ds),
  ];
}

/** Load data/cities/<city>/*.json from disk and validate. Returns error strings. */
export function validateCityDir(cityDir: string, cityId: string): string[] {
  const errors: string[] = [];
  const required = ["city.json", "agencies.json", "networks.json", "stations.json", "lines.json", "graph.json", "meta.json"];
  for (const f of required) {
    if (!existsSync(join(cityDir, f))) errors.push(`${cityId}/${f}: missing file (run pnpm build --city ${cityId})`);
  }
  if (errors.length > 0) return errors;

  let city: City;
  let agencies: Agency[];
  let networks: Network[];
  let stations: Station[];
  let lines: Line[];
  let graph: CityGraph;
  let meta: {
    cityId?: string;
    datasetVersion?: unknown;
    counts?: Record<string, number>;
    upstream?: { commit?: string };
    contributorIds?: unknown;
  };
  try {
    city = JSON.parse(readFileSync(join(cityDir, "city.json"), "utf8"));
    agencies = JSON.parse(readFileSync(join(cityDir, "agencies.json"), "utf8"));
    networks = JSON.parse(readFileSync(join(cityDir, "networks.json"), "utf8"));
    stations = JSON.parse(readFileSync(join(cityDir, "stations.json"), "utf8"));
    lines = JSON.parse(readFileSync(join(cityDir, "lines.json"), "utf8"));
    graph = JSON.parse(readFileSync(join(cityDir, "graph.json"), "utf8"));
    meta = JSON.parse(readFileSync(join(cityDir, "meta.json"), "utf8"));
  } catch (e) {
    return [`${cityId}: failed to parse generated JSON: ${(e as Error).message}`];
  }

  if (!Array.isArray(agencies)) errors.push(`${cityId}/agencies.json: expected an array`);
  if (!Array.isArray(networks)) errors.push(`${cityId}/networks.json: expected an array`);
  if (!Array.isArray(stations)) errors.push(`${cityId}/stations.json: expected an array`);
  if (!Array.isArray(lines)) errors.push(`${cityId}/lines.json: expected an array`);
  if (errors.length > 0) return errors;

  errors.push(
    ...validateDataset({ city, agencies, networks, stations, lines, graph }).map((e) => `${cityId}: ${e}`),
  );

  // meta.json consistency (counts must match the built files).
  const counts = meta.counts ?? {};
  const expect: Record<string, number> = {
    stations: stations.length,
    lines: lines.length,
    routes: graph.routes.length,
    segments: graph.segments.length,
    transfers: graph.transfers.length,
    cities: 1,
    agencies: agencies.length,
    networks: networks.length,
  };
  for (const [k, v] of Object.entries(expect)) {
    if (counts[k] !== v) errors.push(`${cityId}/meta.json: counts.${k}=${counts[k]} but built ${v}`);
  }
  if (meta.cityId !== cityId) errors.push(`${cityId}/meta.json: cityId=${JSON.stringify(meta.cityId)}`);
  if (typeof meta.datasetVersion !== "string" || !/^\d{4}\.\d{2}\.\d+$/.test(meta.datasetVersion)) {
    errors.push(`${cityId}/meta.json: datasetVersion=${JSON.stringify(meta.datasetVersion)} (expected CalVer YYYY.MM.N)`);
  }
  if (city.id !== cityId) errors.push(`${cityId}/city.json: id=${JSON.stringify(city.id)}`);
  if (!meta.upstream || typeof meta.upstream.commit !== "string" || meta.upstream.commit.length < 7) {
    errors.push(`${cityId}/meta.json: missing upstream.commit`);
  }
  if (meta.contributorIds !== undefined && !Array.isArray(meta.contributorIds)) {
    errors.push(`${cityId}/meta.json: contributorIds must be an array`);
  }
  return errors;
}
