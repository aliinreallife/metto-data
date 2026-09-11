import type { BuiltDataset } from "../validate.js";

function dupes(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) out.push(id);
    seen.add(id);
  }
  return [...new Set(out)];
}

/** Duplicate ids across every entity kind. */
export function checkDuplicateIds(ds: BuiltDataset): string[] {
  const errors: string[] = [];
  for (const id of dupes(ds.stations.map((s) => s.id))) errors.push(`duplicate station id ${id}`);
  for (const id of dupes(ds.lines.map((l) => l.id))) errors.push(`duplicate line id ${id}`);
  for (const id of dupes(ds.graph.routes.map((r) => r.id))) errors.push(`duplicate route id ${id}`);
  for (const id of dupes(ds.graph.segments.map((s) => s.id))) errors.push(`duplicate segment id ${id}`);
  for (const id of dupes(ds.graph.transfers.map((t) => t.id))) errors.push(`duplicate transfer id ${id}`);
  for (const id of dupes(ds.agencies.map((a) => a.id))) errors.push(`duplicate agency id ${id}`);
  for (const id of dupes(ds.networks.map((n) => n.id))) errors.push(`duplicate network id ${id}`);
  return errors;
}
