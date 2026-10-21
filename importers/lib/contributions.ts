/**
 * Shared fail-closed merge of human-approved field patches for every city.
 * Approved data cannot silently go unapplied; conflicts reject the build.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { CityGraph, Line, Station, AmenityKey, InfrastructureStatus } from "../../schema/v1/types.js";
import { validateContributionsDir } from "../../validators/contributions.js";

type Patch = { entityType: string; entityId: string; operations: Array<{op: string; path: string; value: unknown}> };
type Dataset = { stations: Station[]; lines: Line[]; graph: CityGraph };

export function applyApprovedContributions(root: string, city: string, dataset: Dataset): void {
  const cityIds = new Set<string>(Object.keys(JSON.parse(readFileSync(join(root, "sources.json"), "utf8"))));
  const errors = validateContributionsDir(root, "approved", cityIds);
  if (errors.length) throw new Error("invalid approved contributions: " + errors.join("; "));
  const path = join(root, "contributions", "approved");
  let files: string[] = [];
  try { files = readdirSync(path).filter(f => f.endsWith(".json")).sort(); } catch { return; }
  const stationById = new Map(dataset.stations.map(s => [s.id, s]));
  const lineById = new Map(dataset.lines.map(s => [s.id, s]));
  const segById = new Map(dataset.graph.segments.map(s => [s.id, s]));
  const transferById = new Map(dataset.graph.transfers.map(s => [s.id, s]));
  const written = new Map<string, string>();
  for (const file of files) {
    const d = JSON.parse(readFileSync(join(path, file), "utf8")) as Patch & {city: string; status: string};
    if (d.city !== city) continue;
    if (d.status !== "approved") throw new Error(`proposal ${file} was not approved`);
    for (const operation of d.operations) {
      if (operation.op !== "set" && operation.op !== "add") throw new Error(`unimplemented approved operation ${operation.op}`);
      const key = `${d.entityType}:${d.entityId}:${operation.path}`;
      const serialized = JSON.stringify(operation.value);
      if (written.has(key) && written.get(key) !== serialized) {
        throw new Error(`conflicting approved contributions for ${key}`);
      }
      written.set(key, serialized);
      const value = operation.value;
      if (d.entityType === "station") {
        const station = stationById.get(d.entityId);
        if (!station) throw new Error(`unknown approved station ${d.entityId}`);
        if (operation.path.startsWith("/amenities/")) {
          const prop = operation.path.slice("/amenities/".length) as AmenityKey;
          if (!(prop in station.amenities)) throw new Error(`unknown amenity ${prop}`);
          station.amenities[prop] = value as boolean | null;
        } else if (operation.path === "/location/lat") station.location.lat = value as number;
        else if (operation.path === "/location/lng") station.location.lng = value as number;
        else if (operation.path === "/names/fa" || operation.path === "/name/fa") station.names.fa = value as string;
        else if (operation.path === "/names/en" || operation.path === "/name/en") station.names.en = value as string;
        else if (operation.path === "/status") station.status = value as InfrastructureStatus;
        else throw new Error(`unhandled approved station field ${operation.path}`);
      } else if (d.entityType === "line") {
        const line = lineById.get(d.entityId);
        if (!line) throw new Error(`unknown approved line ${d.entityId}`);
        if (operation.path === "/color") line.color = value as string;
        else if (operation.path === "/names/fa" || operation.path === "/name/fa") line.names.fa = value as string;
        else if (operation.path === "/names/en" || operation.path === "/name/en") line.names.en = value as string;
        else throw new Error(`unhandled approved line field ${operation.path}`);
      } else if (d.entityType === "transfer") {
        const transfer = transferById.get(d.entityId);
        if (!transfer) throw new Error(`unknown approved transfer ${d.entityId}`);
        if (operation.path !== "/walkSeconds") throw new Error(`unhandled approved transfer field ${operation.path}`);
        transfer.walkSeconds = value as number;
      } else if (d.entityType === "connection") {
        const segment = segById.get(d.entityId);
        if (!segment) throw new Error(`unknown approved segment ${d.entityId}`);
        if (operation.path !== "/status") throw new Error(`unhandled approved connection field ${operation.path}`);
        segment.status = value as typeof segment.status;
      } else {
        throw new Error(`unhandled approved entity type ${d.entityType}`);
      }
    }
  }
}
