# metto-data — canonical transit data layer for Metto

> **Help improve Metto transit data:** [send a source report](https://github.com/aliinreallife/metto-data/issues/new).
>
> Non-developers welcome — fix facilities, names, locations, and transfers.
> Start at [`contributions/README.md`](contributions/README.md), or read
> [## Contributing Data](#contributing-data) below.

`metto-data` is owned and maintained by Metto. It turns third-party transit
datasets (kept as **untouched git submodules**) into a normalized,
versioned, validated dataset that the Metto app consumes. Metto never reads
upstream repositories directly.

The contribution UI from `metto-data-prev` now lives in
[`apps/data-portal/`](apps/data-portal/README.md). The combined repository uses
Vercel for the UI/API and the existing Neon database for private intake, with GitHub Actions for data
validation, upstream checks and queued issue publication. See its guide for the
existing Vercel project. Hosting configuration and live delivery remain pending.

```text
upstream-tehran-metro/   (git submodule — source material only, never edited)
        |
        v
importers/tehran.ts      (normalize to schema/v1)
        |
        v
overrides/ + contributions/approved/   (Metto corrections + reviewed community fixes)
        |
        v
validators/              (fail-closed checks)
        |
        v
data/cities/tehran/{city.json, agencies.json, networks.json, stations.json, lines.json, graph.json, meta.json}  (the product)
        |
        v
Metto app                (consumes normalized data only)
```

## Repository layout

```text
metto-data/
  upstream-tehran-metro/   # submodule: https://github.com/mostafa-kheibary/tehran-metro-data
  upstream-<city>/          # future submodules (e.g. upstream-mashhad-metro)
  importers/               # tehran.ts + lib/ (slug, coords) + future-city-importers
  overrides/               # Metto-maintained corrections per city
  topology/                # canonical ordered routes / segments / transfers per city
  data/cities/<city>/      # GENERATED product: city.json, agencies.json, networks.json, stations.json, lines.json, graph.json, meta.json
  schema/v1/               # canonical TypeScript types + JSON Schemas
  validators/              # dataset integrity checks
  contributions/           # community proposals + review queue (pending/approved/rejected)
  contributors.json        # contributor attribution registry
  sources.json             # provenance: repo URL, submodule path, license, pinned commit
  scripts/                 # build.ts, validate.ts, contributions-*.ts, new-contribution.ts
  apps/data-portal/        # Vercel contribution UI/API, backed by the same data
  docs/data-platform.md    # future platform API contract
```

## Quickstart

Prerequisites: Node 22 (`nvm use`), pnpm 12, git with submodule support.

```bash
# 1. Clone with submodules (required — upstream data lives in submodules)
git clone --recurse-submodules <metto-data-remote-url>
cd metto-data

# Already cloned without --recurse-submodules?
git submodule update --init --recursive

# 2. Install + build Tehran dataset
pnpm install
pnpm build --city tehran
pnpm validate
```

Generated output lands in `data/cities/tehran/`. Never edit those files by hand —
they are rebuilt by `pnpm build`.

## Schema v1

Entities: `City`, `Agency`, `Network`, `Mode`, `Line`, `Station`, `Connection`
(route-ordered stops + track segments + transfers). See [`schema/v1/README.md`](schema/v1/README.md)
and [`schema/v1/types.ts`](schema/v1/types.ts).

Stable namespaced IDs — never display names:

```text
tehran:station:tajrish
tehran:line:1
tehran:route:line-1-main
tehran:segment:line-1-tajrish-gheytariyeh
tehran:transfer:eram-e-sabz:4:5
mashhad:station:...
```

Modes supported from day one: `metro`, `bus`, `tram`, `rail`.

## Upstream sources

| city   | repository | path | license | type |
|--------|-----------|------|---------|------|
| tehran | https://github.com/mostafa-kheibary/tehran-metro-data | `upstream-tehran-metro` (`data/stations.json`, 150 stations @ `bcf474e`) | ODbL-1.0 | git-submodule |

## Supported cities

| city | modes | stations | lines | datasetVersion | status |
|------|-------|----------|-------|----------------|--------|
| tehran | metro | 151 | 7 | 2026.09.11 | existing validated baseline |
| mashhad | metro | 38 | 3 | 2026.10.1 | **DRAFT / verification required** — see [source review](docs/mashhad-source-review.md) |

Mashhad is a candidate dataset with unverified entrances, timetable, transfer walks and line colors; never treat it as service-ready merely because the JSON passes schema validation. Run `pnpm build` to build all registered cities, or `pnpm build --city mashhad` to build only Mashhad.

Full provenance (pinned commit, sync date) lives in [`sources.json`](sources.json)
and per-build in `data/cities/<city>/meta.json`. License details in
[`DATA_LICENSE.md`](DATA_LICENSE.md) and [`ATTRIBUTION.md`](ATTRIBUTION.md).

### Updating an upstream dataset

Submodules are pinned — updates are deliberate, reviewable commits:

```bash
cd upstream-tehran-metro
git fetch origin
git checkout <new-sha>          # or: git pull origin main
cd ..
git add upstream-tehran-metro   # records the new gitlink
pnpm build --city tehran        # regenerate normalized data
pnpm validate                   # must pass before commit
# update sources.json pinnedCommit/lastSyncedAt/stationCount in the same commit
git commit -m "chore(data): bump upstream-tehran-metro to <short-sha>"
```

Rules: never commit inside `upstream-*/` (no Metto files there, no fixes there —
upstream fixes go upstream as PRs; Metto corrections go in `overrides/`).
CI fails if the submodule is dirty or `sources.json` disagrees with the gitlink.

## Adding a new city

1. `pnpm tsx scripts/add-city.ts --city mashhad --mode metro` (scaffolds
   `data/cities/mashhad/`, `overrides/mashhad.overrides.json`, importer stub).
2. Add the source: preferably a new submodule `upstream-mashhad-metro/`
   (or document a non-git source in `sources.json`).
3. Write `importers/mashhad.ts` following `importers/tehran.ts`:
   read only from the upstream path, map to `schema/v1`, apply overrides.
4. Add ordered topology in `topology/mashhad.*.json` (adjacency lists alone are
   not enough — routes need verified station order).
5. Register the city in `sources.json`, build, validate, commit generated
   `data/cities/mashhad/*` in the same PR.

## Contributing Data

**Riders:** use the contribution portal once its
[Vercel setup](apps/data-portal/README.md) is complete, or
[open an issue](https://github.com/aliinreallife/metto-data/issues/new) with your
information and evidence. No-login form submissions create source reports for
maintainer review; optional contact fields stay private.

**Structured edits:** add one JSON file to `contributions/pending/` in a PR.
Copy an example from `contributions/examples/`, or generate a template with
`pnpm contributions:new --city tehran --entity tehran:station:tajrish`.

You can propose: facility toggles (elevator, toilets, parking, prayer room,
Wi-Fi, shops, accessibility), coordinate fixes, name/translation fixes, status
fixes, missing connections, wrong transfer walks. Evidence (photo URL, note)
helps reviewers.

**Maintainers:** `pnpm contributions:validate` checks schema + references without
touching the dataset. Review by moving
`contributions/pending/<uuid>.json` → `approved/` (fill `review.*`) or
`rejected/` (fill `review.reason`), then `pnpm build` folds approved proposals
into the next generated dataset and updates `contributors.json`. Details in
[`contributions/README.md`](contributions/README.md).

**Attribution:** contributors are credited in [`contributors.json`](contributors.json)
and per-build `meta.json`. Approved data becomes part of the ODbL-1.0 normalized
dataset (share-alike applies) — see [`ATTRIBUTION.md`](ATTRIBUTION.md).

## Validation

`pnpm validate` checks, at minimum: duplicate IDs, missing references
(station/line/route/segment), invalid coordinates (NaN, out of Iran bounds
25–40N / 44–64E), broken graph edges (self-loop, non-consecutive segment),
missing line references, orphan/disconnected stations (BFS), transfer-rule
integrity, and contribution schema conformance. It exits non-zero on any error
and runs in CI.

## License

* **Importer / validator / script code:** AGPL-3.0-only — see `LICENSE`.
* **Normalized transit data** (`data/cities/*`, `overrides/*`, `topology/*`,
  community-approved changes): ODbL-1.0 — see `DATA_LICENSE.md` and
  `LICENSES/ODbL-1.0.txt`.
* **Upstream datasets:** their own licenses (Tehran: ODbL-1.0) — see
  `ATTRIBUTION.md`. Files inside `upstream-*/` are never modified.

## Mashhad candidate source review

Mashhad uses an immutable [ODbL-licensed upstream dataset](https://github.com/shahriaarrr/mashhad-metro-data) pinned as a git submodule, explicit ordered service routes, and an OSM-referenced Fajr coordinate correction. See [the audit](docs/mashhad-source-review.md) and [machine-readable review record](sources/mashhad/review.json). Current generated JSON is **not yet approved for production routing**. No timetable is bundled.

The first delivery scope under review is **Lines 1/2: stations and route paths,
without arrival or travel-time estimates**. `pnpm quality:report` produces
`.quality-report/mashhad-path-review.json` for its 36 stations, 37 boarding
assertions and two untimed Shariati directions. [Dated service evidence](sources/mashhad/service-evidence.json)
corroborates line operation, terminal reopenings and interchange connectivity;
station-level operator review and approval of the exact projection remain
outstanding. Line 3, measured walking times, official colors, entrances and
amenities are separate scope. The packet never grants release approval.
