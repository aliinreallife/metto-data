/**
 * Tehran importer: upstream-tehran-metro/data/stations.json → data/cities/tehran/*.
 *
 * Pipeline (nothing here writes inside upstream-tehran-metro/):
 *   1. read upstream map (Record<EnName, station>), assert 150 keys (sources.json)
 *   2. coerce lat/lng (string|number), assert lines.length === colors.length
 *   3. slug → tehran:station:<slug>; map amenities allowlist
 *      (wc,elevator,atm,coffeeShop,fastFood,groceryStore,freeWifi,prayerRoom,
 *       bicycleParking→parking,metroPolice→police); true→true, false→false,
 *       null/missing→null; quarantine unknown keys (fastFoodn typo etc.) as warnings
 *   4. apply overrides/tehran.overrides.json (Soleimani pin, status overrides,
 *      Fakhrizadeh insert after Golshahr)
 *   5. fold contributions/approved/ (tehran, status approved) as operations
 *   6. join topology/tehran.*.json → graph.json; write stations/lines/graph/meta.json
 *
 * Status: scaffold for the build milestone. Step 6 refuses to emit graph.json
 * until topology/*.json are ported (see topology/README.md) so partial topology
 * can never ship silently.
 */
export {};
