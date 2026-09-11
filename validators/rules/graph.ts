import type { BuiltDataset } from "../validate.js";

/**
 * Graph edges: no self-loops, every segment is a consecutive route pair,
 * every consecutive route pair has its segment, branch junctions are
 * same-line, every station is in ≥1 route, and all operational stations
 * are connected via operational segments (BFS from the first operational
 * station — trains pass through non-boardable stations when the track
 * itself is operational, so BFS ignores boarding status).
 */
export function checkGraph(ds: BuiltDataset): string[] {
  const errors: string[] = [];
  const stationIds = new Set(ds.stations.map((s) => s.id));
  void stationIds;
  const routeById = new Map(ds.graph.routes.map((r) => [r.id, r]));

  // Route continuity + segment coverage.
  for (const r of ds.graph.routes) {
    if (r.stops.length < 2) {
      errors.push(`route ${r.id} has fewer than 2 stops`);
      continue;
    }
    for (let i = 0; i < r.stops.length - 1; i++) {
      const a = r.stops[i].stationId;
      const b = r.stops[i + 1].stationId;
      if (a === b) {
        errors.push(`route ${r.id} has self-loop at ${a}`);
        continue;
      }
      const seg = ds.graph.segments.find(
        (s) =>
          s.routeId === r.id && ((s.from === a && s.to === b) || (s.from === b && s.to === a)),
      );
      if (!seg) errors.push(`route ${r.id} missing segment for ${a} <-> ${b}`);
    }
  }

  // Segment integrity.
  const edgeKeys = new Set<string>();
  for (const s of ds.graph.segments) {
    if (s.from === s.to) errors.push(`segment ${s.id} is a self-loop`);
    const k = [s.from, s.to].sort().join("|") + "|" + s.routeId;
    if (edgeKeys.has(k)) errors.push(`duplicate segment edge for ${k} (${s.id})`);
    edgeKeys.add(k);
    const route = routeById.get(s.routeId);
    if (route) {
      const ids = route.stops.map((stop) => stop.stationId);
      const adjacent = ids.some(
        (sid, i) => (sid === s.from && ids[i + 1] === s.to) || (sid === s.to && ids[i + 1] === s.from),
      );
      if (!adjacent) errors.push(`segment ${s.id} is not a consecutive pair in ${s.routeId}`);
    }
  }

  // Branch rule: a branch route must join another route of the SAME line.
  for (const r of ds.graph.routes) {
    if (!r.branchId) continue;
    const junction = r.stops[0]?.stationId;
    const shared = ds.graph.routes.some(
      (o) => o.id !== r.id && o.lineId === r.lineId && o.stops.some((stop) => stop.stationId === junction),
    );
    if (!shared) {
      errors.push(`branch route ${r.id} junction ${junction} not shared with same-line route`);
    }
  }

  // Orphans: every station must appear in ≥1 route.
  const routed = new Set<string>();
  for (const r of ds.graph.routes) for (const stop of r.stops) routed.add(stop.stationId);
  for (const s of ds.stations) {
    if (!routed.has(s.id)) errors.push(`station ${s.id} appears in no route (orphan)`);
  }

  // Connectivity: BFS over operational segments must reach all operational stations.
  const operational = new Map(ds.stations.map((s) => [s.id, s.status === "operational"]));
  const firstOp = ds.stations.find((s) => s.status === "operational");
  if (firstOp) {
    const adj = new Map<string, string[]>();
    for (const s of ds.graph.segments) {
      if (s.status !== "operational") continue;
      if (!adj.has(s.from)) adj.set(s.from, []);
      if (!adj.has(s.to)) adj.set(s.to, []);
      adj.get(s.from)?.push(s.to);
      adj.get(s.to)?.push(s.from);
    }
    const seen = new Set<string>([firstOp.id]);
    const queue = [firstOp.id];
    while (queue.length > 0) {
      const cur = queue.pop() as string;
      for (const nb of adj.get(cur) ?? []) {
        if (!seen.has(nb)) {
          seen.add(nb);
          queue.push(nb);
        }
      }
    }
    for (const s of ds.stations) {
      if (operational.get(s.id) && !seen.has(s.id)) {
        errors.push(`station ${s.id} is disconnected (BFS from ${firstOp.id} cannot reach it)`);
      }
    }
  }

  return errors;
}
