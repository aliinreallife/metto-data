# Release checklist

## Before release

Run, in order, from a clean checkout with submodules:

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm validate
pnpm test
pnpm check-release
```

Each step must pass. Then confirm:

- [ ] `git submodule status` shows every `upstream-*/` submodule clean and
  matching the `pinnedCommit` in `sources.json`
  (`git submodule foreach --quiet 'git status --porcelain'` prints nothing).
- [ ] Attribution files updated: `ATTRIBUTION.md`, `DATA_LICENSE.md`,
  `contributors.json`, and per-build `contributorIds` in
  `data/cities/<city>/meta.json`.
- [ ] `datasetVersion` bumped in `sources.json` for every city shipping new
  data (CalVer `YYYY.MM.N`, e.g. `2026.09.11`).

Dataset versions are manually maintained by maintainers. There is no
automatic version bumping: the value in `sources.json` is copied verbatim
into `meta.json` by `pnpm build`, and `pnpm validate` rejects anything that
is not CalVer. `generatedAt` always reflects the build time, so it changes
on every build by design — compare dataset files with `generatedAt`
stripped when checking reproducibility.

## Release

- [ ] `CHANGELOG.md`: move the shipped entries out of `Unreleased` under a
  `## <datasetVersion> — <date>` heading.
- [ ] Commit the release, including regenerated `data/cities/*`.
- [ ] Tag it: `git tag v<datasetVersion>` (e.g. `git tag v2026.09.11`).
- [ ] Publish: push the commit and the tag so the versioned dataset
  (`data/cities/*` at that tag) is publicly fetchable.
