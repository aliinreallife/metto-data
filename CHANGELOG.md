# Changelog

All notable changes to metto-data are documented here. Generated datasets
(`data/cities/*`) are versioned per city via `datasetVersion` in
`sources.json` (copied into `meta.json`); this file tracks repository-level
changes to pipeline, schema, and data.

## Unreleased

### Added
-

## 2026.09.11

### Added
- Initial Tehran Metro canonical dataset pipeline (`importers/tehran.ts` →
  `data/cities/tehran/` with `city.json`, `agencies.json`, `networks.json`,
  `stations.json`, `lines.json`, `graph.json`, `meta.json`)
- Upstream source tracking (`sources.json` with pinned commit, license, and
  `datasetVersion`; `meta.json` records repository, commit, and file per build)
- Schema v1 (`schema/v1/` TypeScript types + JSON Schemas, including stable
  namespaced transfer IDs and canonical City/Agency/Network entities)
- Topology conversion (`topology/tehran.{routes,segments,transfers,aliases}.json`
  ported from the battle-tested Metto tables with namespaced IDs)
- Validation pipeline (`validators/` fail-closed checks + `pnpm validate`,
  `scripts/check-release.ts` release readiness checks)
- Contribution workflow (`contributions/` proposal queue, examples, review flow,
  contributor attribution via `contributors.json` + `meta.json contributorIds`)
- CI checks (typecheck + build + validate on push to main and pull requests)
