# Release v2026.09.11

First public release of metto-data: Tehran Metro canonical dataset
(`datasetVersion: 2026.09.11`, 151 stations, 7 lines, 9 routes,
163 segments, 2 transfers).

## Release

v2026.09.11 (`git tag v2026.09.11` after the release commit).

## Commit requirements (all verified before tagging)

- [x] `pnpm typecheck` passes
- [x] `pnpm build --city tehran` passes
- [x] `pnpm validate` passes
- [x] `pnpm contributions:validate` passes
- [x] `pnpm test` passes (25/25)
- [x] `pnpm check-release` passes
- [x] submodules clean (`upstream-tehran-metro` at `bcf474e`, matching
  `sources.json` pinned commit)
- [x] `datasetVersion: 2026.09.11` in `sources.json` and generated `meta.json`
- [x] `CHANGELOG.md` entries moved from `Unreleased` to `2026.09.11`
