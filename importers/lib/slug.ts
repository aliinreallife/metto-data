// Stable kebab-case slug — the frozen suffix of tehran:station:<slug>.
// Ported from metto/scripts/generate-stations.ts. Renames change names.*, never the slug.
/**
 * Lowercase, strip Arabic/Persian quote variants, replace non [a-z0-9] runs
 * with "-", collapse, trim. E.g. "Shahed - BagherShahr" -> "shahed-baghershahr".
 */
export function slugifyEnglishName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’‘'‛`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Prefix a slug into a namespaced id: namespacedId("tehran", "station", "tajrish"). */
export function namespacedId(city: string, kind: string, slug: string): string {
  return `${city}:${kind}:${slug}`;
}
