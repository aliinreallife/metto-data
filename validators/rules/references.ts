import type { BuiltDataset } from "../validate.js";

/**
 * Referential integrity: every id reference resolves.
 * No hardcoded exceptions — city/agency/network files must exist and
 * line.cityId/agencyId/networkId, network.agencyId/cityId must resolve.
 */
export function checkReferences(ds: BuiltDataset): string[] {
  const errors: string[] = [];
  const cityIds = new Set([ds.city.id]);
  const agencyIds = new Set(ds.agencies.map((a) => a.id));
  const networkIds = new Set(ds.networks.map((n) => n.id));
  const stationIds = new Set(ds.stations.map((s) => s.id));
  const lineIds = new Set(ds.lines.map((l) => l.id));
  const routeIds = new Set(ds.graph.routes.map((r) => r.id));
  const routeById = new Map(ds.graph.routes.map((r) => [r.id, r]));

  for (const a of ds.agencies) {
    if (!cityIds.has(a.cityId)) errors.push(`agency ${a.id} references unknown city ${a.cityId}`);
  }
  for (const n of ds.networks) {
    if (!cityIds.has(n.cityId)) errors.push(`network ${n.id} references unknown city ${n.cityId}`);
    if (!agencyIds.has(n.agencyId)) errors.push(`network ${n.id} references unknown agency ${n.agencyId}`);
  }
  for (const l of ds.lines) {
    if (!cityIds.has(l.cityId)) errors.push(`line ${l.id} references unknown city ${l.cityId}`);
    if (!agencyIds.has(l.agencyId)) errors.push(`line ${l.id} references unknown agency ${l.agencyId}`);
    if (!networkIds.has(l.networkId)) errors.push(`line ${l.id} references unknown network ${l.networkId}`);
  }
  for (const s of ds.stations) {
    if (!cityIds.has(s.cityId)) errors.push(`station ${s.id} references unknown city ${s.cityId}`);
  }
  for (const r of ds.graph.routes) {
    if (!cityIds.has(r.cityId)) errors.push(`route ${r.id} references unknown city ${r.cityId}`);
    if (!lineIds.has(r.lineId)) errors.push(`route ${r.id} references unknown line ${r.lineId}`);
    for (const stop of r.stops) {
      if (!stationIds.has(stop.stationId)) {
        errors.push(`route ${r.id} references unknown station ${stop.stationId}`);
      }
    }
  }
  for (const s of ds.graph.segments) {
    if (!cityIds.has(s.cityId)) errors.push(`segment ${s.id} references unknown city ${s.cityId}`);
    if (!lineIds.has(s.lineId)) errors.push(`segment ${s.id} references unknown line ${s.lineId}`);
    if (!routeIds.has(s.routeId)) errors.push(`segment ${s.id} references unknown route ${s.routeId}`);
    if (!stationIds.has(s.from)) errors.push(`segment ${s.id} references unknown station ${s.from}`);
    if (!stationIds.has(s.to)) errors.push(`segment ${s.id} references unknown station ${s.to}`);
    const route = routeById.get(s.routeId);
    if (route && s.lineId !== route.lineId) {
      errors.push(`segment ${s.id} lineId ${s.lineId} disagrees with route ${s.routeId} lineId ${route.lineId}`);
    }
  }
  for (const t of ds.graph.transfers) {
    if (!stationIds.has(t.stationId)) errors.push(`transfer ${t.id} references unknown station ${t.stationId}`);
    if (!lineIds.has(t.fromLineId)) errors.push(`transfer ${t.id} references unknown fromLine ${t.fromLineId}`);
    if (!lineIds.has(t.toLineId)) errors.push(`transfer ${t.id} references unknown toLine ${t.toLineId}`);
    if (t.fromRouteId && !routeIds.has(t.fromRouteId)) {
      errors.push(`transfer ${t.id} references unknown fromRoute ${t.fromRouteId}`);
    }
    if (t.toRouteId && !routeIds.has(t.toRouteId)) {
      errors.push(`transfer ${t.id} references unknown toRoute ${t.toRouteId}`);
    }
  }
  for (const [alias, target] of Object.entries(ds.graph.aliases)) {
    if (!stationIds.has(target)) errors.push(`alias ${JSON.stringify(alias)} targets unknown station ${target}`);
  }
  return errors;
}
