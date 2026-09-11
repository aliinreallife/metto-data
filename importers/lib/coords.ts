// Coordinate coercion + bounds. Upstream mixes number and numeric-string lat/lng
// across revisions — accept both, reject everything else loudly.

export const IRAN_BOUNDS = {
  lat: { min: 25, max: 40 },
  lng: { min: 44, max: 64 },
} as const;

/** Coerce upstream latitude/longitude (number | numeric string) to number. */
export function toCoordinate(value: unknown, field: "lat" | "lng"): number {
  const n = typeof value === "string" ? Number(value.trim()) : (value as number);
  if (typeof n !== "number" || !Number.isFinite(n)) {
    throw new Error(`invalid coordinate ${field}: ${JSON.stringify(value)}`);
  }
  const b = IRAN_BOUNDS[field];
  if (n < b.min || n > b.max) {
    throw new Error(`coordinate ${field}=${n} outside Iran bounds [${b.min}, ${b.max}]`);
  }
  return n;
}
