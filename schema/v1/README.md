# Schema v1

Canonical entities for every city and mode. This is the contract between
importers, validators, the dataset (`data/cities/*`), community contributions,
and the future https://data.metto.ir editor.

## Entities

| entity | id pattern | example |
|--------|-----------|---------|
| City | `<city>` | `tehran` |
| Agency | `<city>:agency:<slug>` | `tehran:agency:tehran-metro` |
| Network | `<city>:network:<mode>` | `tehran:network:metro` |
| Line | `<city>:line:<code>` | `tehran:line:1` |
| Station | `<city>:station:<slug>` | `tehran:station:tajrish` |
| Route | `<city>:route:<slug>` | `tehran:route:line-1-main` |
| Connection (segment) | `<city>:segment:<slug>` | `tehran:segment:line-1-tajrish-gheytariyeh` |
| Transfer | `<city>:transfer:<station>:<from>:<to>` | `tehran:transfer:eram-e-sabz:4:5` |

## Rules

* **IDs are stable and namespaced.** Never use display names as IDs. The slug
  suffix is kebab-case derived once from the English name, then frozen — renames
  change `names.*`, never `id`. Legacy Metto kebab ids (`tajrish`) and upstream
  English keys (`Tajrish`) resolve via `graph.aliases`, they are not ids.
* **Modes:** `metro | bus | tram | rail`. A city can host several networks;
  every line points at exactly one `(agency, network, mode)`.
* **Amenities are tri-state:** `true` = confirmed available, `false` =
  confirmed absent, `null` = unknown. Never default unknown to `false`.
  v1 keys: `wc, elevator, atm, coffeeShop, fastFood, groceryStore, freeWifi,
  prayerRoom, parking, police`. New keys (`escalator`, `accessibilityStepFree`,
  `shop`, …) are additive in v1.x — importers warn, validators allow, Metto
  ignores until its UI adopts them.
* **Statuses are independent:** station infrastructure status, route-stop
  boarding status, and segment track status are three facts. Trains may pass a
  non-boardable station when the track is operational.
* **Coordinates:** WGS84 decimal degrees, `lat` 25–40 / `lng` 44–64 for Iran
  (validators enforce; per-city bbox warns). Upstream `string | number`
  coercion happens in importers, never in validators.
* **Evolution:** additive only within v1 (new optional fields). Breaking changes
  require `schema/v2/` + migration script. Contributions may only touch
  allowlisted paths (see `contributions/schema.json`).

## Files

* `types.ts` — canonical TypeScript types (source of truth for code).
* `city.schema.json`, `line.schema.json`, `station.schema.json`,
  `graph.schema.json` — JSON Schemas for generated `data/cities/*` files.
* `../../contributions/schema.json` — proposal envelope (not dataset shape).
