# Validators

Fail-closed checks run by `pnpm validate` and in CI. Dataset validators operate
on built `data/cities/*` (never on `upstream-*/` directly); contribution
validators operate on `contributions/pending/*.json` without mutating anything.

## Dataset rules (`validate.ts` + `rules/`)

* duplicate ids (station / segment / route / line)
* missing references (stop → station, segment from/to → station, segment →
  route, line → network/agency/city)
* invalid coordinates (NaN, non-number after coercion, outside Iran
  25–40N / 44–64E; per-city bbox mismatch is a warning)
* broken graph edges (self-loop, segment not a consecutive route pair,
  route pair missing its segment)
* missing line references (station in no route → orphan; BFS from first
  operational station must reach all operational stations → disconnected)
* transfer integrity (unknown station, not an interchange, `walkSeconds <= 0`,
  `from === to`)
* enum + amenity tri-state conformance (`true|false|null`, never undefined)

## Contribution rules (`../scripts/contributions-validate.ts`)

* conforms to `contributions/schema.json`
* `city` exists in `sources.json`, `entityId` exists in built dataset (or is a
  well-formed `add` proposal), `path` allowlisted for `entityType`, value types
  match (amenities tri-state, coords numeric, status enum), `evidence` is
  http(s) when present.

Exit non-zero with `file:line`-style messages on any error.
