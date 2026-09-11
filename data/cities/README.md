# Generated dataset (do not edit)

`data/cities/<city>/` is the **product** of `pnpm build`:

* `city.json` — `City` (schema/v1, id `<city>`)
* `agencies.json` — `Agency[]` (e.g. `tehran:agency:tehran-metro`)
* `networks.json` — `Network[]` (e.g. `tehran:network:metro`, mode `metro`)
* `stations.json` — `Station[]` (schema/v1, namespaced ids)
* `lines.json` — `Line[]`
* `graph.json` — `{ routes, segments, transfers, aliases }` (transfers carry stable `tehran:transfer:<slug>:<from>:<to>` ids)
* `meta.json` — `{ cityId, datasetVersion, generatedAt, importer, upstream{repository,commit,file}, counts, contributorIds }`

`datasetVersion` is a manually-maintained CalVer (`YYYY.MM.N`) set per city in
`sources.json` and copied verbatim into `meta.json` — it is never
auto-incremented. `generatedAt` is the build timestamp, so it changes on every
build by design; compare dataset files with `generatedAt` stripped when checking
reproducibility (all other files must be byte-identical).

Regenerate with `pnpm build --city <city>` after changing the importer,
`overrides/`, `topology/`, or `contributions/approved/`. The `.gitkeep` files
keep empty city dirs tracked before their first build.
