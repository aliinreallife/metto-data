# Mashhad metro data: source review (2026-10-21)

**Status: DRAFT, NOT APPROVED FOR PRODUCTION ROUTING.** This review record is part of the data release, and must be revisited at every source update.

The initial snapshot is `shahriaarrr/mashhad-metro-data@f5d5c78816a8cc360bb9ae00db8fb8bad23a29e0` (ODbL-1.0). We never modify the upstream submodule; importer output + curated topology + evidence-backed corrections are separate.

## Scope
- 38 unique station records, 3 lines, 41 line memberships; 24/13/4 service nodes per line and 38 consecutive edges.
- Line 4 is under construction; do not create operational route entries.
- Source metadata is pinned in `sources.json`. Station coordinates are WGS84 representative points, NOT train-platform doors.
- Source `relations[]` is directional and insufficient; curated order lives in `topology/mashhad.routes.json`.
- Original `Fajr` source coordinate duplicates `Velayat`. The reviewed corrective representative point `36.31281,59.65543` comes from [OpenStreetMap node 14133541209](https://www.openstreetmap.org/node/14133541209), cross-referenced with [Mapcarta's OSM-derived station object](https://mapcarta.com/N14133541209). This is not an entrance survey.
- Upstream amenities are **not independently verified**. Canonical output uses `null` for unknown facilities; never turn unknown into `false`.
- Line colors are **provisional upstream values**, not a verified official palette.
- Line 3 operating station list checked against [October 1405 Mashhad metro guide](https://www.saadatrent.com/mag/iran/mashhad-metro-map/) for the 4 boarding nodes. Other accounts differ; see review items.
- A second app [Istgah](https://github.com/MohsenDastaran/istgah-rn) lists extra intermediate Line 3 station records, but its LICENSE is not declared. It is comparison context only; do NOT copy its coordinates, names or records.

## Blockers for service-ready release
1. Confirm Line 3 track topology, non-boarding intermediate stops (e.g., پانزده خرداد, مصباح, خسروی), and dated passenger boardability for each with official operator. Source count disagreement is **not** proof those stations are operational.
2. Verify official line colors, interchange availability, and entry/exit entrances. In particular, `Shariati` (L1/L2), `Basij` (L1/L3), `Shohada` (L2/L3) need audited interchange pathways. No guessed walkSeconds.
3. Confirm station coordinates, aliases and operating statuses in a field/OSM review; test multi-station path routing on both directions.
4. Find and license official departures/GTFS separately; **no timetable data is included**.
5. Confirm upstream imagery/other media rights separately: only machine-readable stations are imported here, no third-party logos/fonts/images.

## Reproducibility
`git submodule update --init --recursive && pnpm build --city mashhad && pnpm validate --city mashhad && pnpm test`.
Source audit JSON: `sources/mashhad/review.json`. Attributions: `ATTRIBUTION.md` and `DATA_LICENSE.md`.

This is a foundation for human review, not a claim that every source assertion is correct. Refer to [issue #1](https://github.com/aliinreallife/metto-data/issues/1).
