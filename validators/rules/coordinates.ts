import type { BuiltDataset } from "../validate.js";

/** Coordinates must be finite numbers inside Iran bounds (validators never coerce). */
export function checkCoordinates(ds: BuiltDataset): string[] {
  const errors: string[] = [];
  for (const s of ds.stations) {
    const { lat, lng } = s.location ?? ({} as { lat: unknown; lng: unknown });
    if (typeof lat !== "number" || !Number.isFinite(lat)) {
      errors.push(`station ${s.id} has invalid lat ${JSON.stringify(lat)}`);
    } else if (lat < 25 || lat > 40) {
      errors.push(`station ${s.id} lat=${lat} outside Iran bounds [25, 40]`);
    }
    if (typeof lng !== "number" || !Number.isFinite(lng)) {
      errors.push(`station ${s.id} has invalid lng ${JSON.stringify(lng)}`);
    } else if (lng < 44 || lng > 64) {
      errors.push(`station ${s.id} lng=${lng} outside Iran bounds [44, 64]`);
    }
  }
  return errors;
}
