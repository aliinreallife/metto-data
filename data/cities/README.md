# Generated dataset (do not edit)

`data/cities/<city>/` is the **product** of `pnpm build`:

* `stations.json` — `Station[]` (schema/v1, namespaced ids)
* `lines.json` — `Line[]`
* `graph.json` — `{ routes, segments, transfers, aliases }`
* `meta.json` — `{ cityId, generatedAt, importer, upstream{repository,commit,file}, counts, contributorIds }`

Regenerate with `pnpm build --city <city>` after changing the importer,
`overrides/`, `topology/`, or `contributions/approved/`. The `.gitkeep` files
keep empty city dirs tracked before their first build.
