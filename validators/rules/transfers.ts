import type { BuiltDataset } from "../validate.js";

function stationSlug(stationId: string): string {
  return stationId.split(":").at(-1) ?? stationId;
}

function lineCode(lineId: string): string {
  return lineId.split(":").at(-1) ?? lineId;
}

/**
 * Transfer integrity: stable namespaced ids, known interchange stations,
 * positive walks, distinct lines, valid confidence, route refs consistent.
 */
export function checkTransfers(ds: BuiltDataset): string[] {
  const errors: string[] = [];
  const stationIds = new Set(ds.stations.map((s) => s.id));
  const routeById = new Map(ds.graph.routes.map((r) => [r.id, r]));

  // Lines serving each station (any status).
  const linesByStation = new Map<string, Set<string>>();
  for (const r of ds.graph.routes) {
    for (const stop of r.stops) {
      if (!linesByStation.has(stop.stationId)) linesByStation.set(stop.stationId, new Set());
      linesByStation.get(stop.stationId)?.add(r.lineId);
    }
  }

  const seen = new Set<string>();
  for (const t of ds.graph.transfers) {
    // Stable id: <city>:transfer:<slug>:<fromCode>:<toCode>
    const slug = stationSlug(t.stationId);
    const fromCode = lineCode(t.fromLineId);
    const toCode = lineCode(t.toLineId);
    const city = t.stationId.split(":")[0] ?? "tehran";
    const expectedId = `${city}:transfer:${slug}:${fromCode}:${toCode}`;
    if (t.id !== expectedId) {
      errors.push(`transfer ${t.id} is not stable (expected ${expectedId})`);
    }
    if (!/^([a-z0-9-]+):transfer:.+:[^:]+:[^:]+$/.test(t.id)) {
      errors.push(`transfer ${t.id} is not a namespaced transfer id`);
    }
    if (seen.has(t.id)) errors.push(`duplicate transfer rule for ${t.id}`);
    seen.add(t.id);

    if (!stationIds.has(t.stationId)) continue; // already reported by references
    if (!Number.isInteger(t.walkSeconds) || t.walkSeconds <= 0) {
      errors.push(`transfer ${t.id} has invalid walkSeconds ${JSON.stringify(t.walkSeconds)}`);
    }
    if (t.fromLineId === t.toLineId) {
      errors.push(`transfer ${t.id} must span two different lines`);
    }
    const serving = linesByStation.get(t.stationId) ?? new Set();
    if (!serving.has(t.fromLineId) || !serving.has(t.toLineId)) {
      errors.push(
        `transfer ${t.id} is not served by both lines (served: ${[...serving].join(",") || "none"})`,
      );
    }
    if (serving.size < 2) {
      errors.push(`transfer ${t.id} station ${t.stationId} is not an interchange`);
    }
    if (t.confidence !== undefined && t.confidence !== "verified" && t.confidence !== "estimated") {
      errors.push(`transfer ${t.id} has invalid confidence ${JSON.stringify(t.confidence)}`);
    }
    for (const [routeId, label, expectedLine] of [
      [t.fromRouteId, "fromRouteId", t.fromLineId],
      [t.toRouteId, "toRouteId", t.toLineId],
    ] as const) {
      if (routeId === undefined) continue;
      const route = routeById.get(routeId);
      if (!route) continue; // already reported by references
      if (route.lineId !== expectedLine) {
        errors.push(`transfer ${t.id} ${label} ${routeId} belongs to ${route.lineId}, expected ${expectedLine}`);
      }
      if (!route.stops.some((s) => s.stationId === t.stationId)) {
        errors.push(`transfer ${t.id} ${label} ${routeId} does not serve ${t.stationId}`);
      }
    }
  }
  return errors;
}
