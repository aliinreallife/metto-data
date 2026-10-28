# اصفهان (isfahan): candidate-only source intake

This is a **research packet, not a public city launch**. The repo main branch
already serves Tehran and carries Mashhad's candidate dataset. اصفهان is not
registered in `sources.json`, because the current builder and validators
expect complete pinned datasets with actual coordinates, route edges,
license-provenance and stable IDs.

## What has been assembled

Line 1's twenty ordered stop names are recorded for comparison with the current station list. Isfahan Line 2 is construction-only in this intake, even where a future interchange is represented.

The `sources/isfahan/review.json` file holds candidate ordered stop-name
inventories, source URLs, source ambiguities, exclusions and an explicit
blocked release policy. These are **names**, not a validated route graph or a
claim of every individual platform being open. No copyrighted images, maps,
unknown-license coordinates, schedules or third-party raw data have been
copied. All amenities remain undefined pending evidence.

Line 1: **20 proposed names**; Line 2/3: **no passenger routing**.

## Production gating

1. Obtain a redistribution-compatible immutable dataset, ideally ODbL-licensed
   OpenStreetMap elements (with element IDs/versions) or approved operator data.
2. Pin independent coordinates for every station and audit boarding
   availability, non-stopping pass-through tracks, route order and
   interchange access.
3. Add `upstream-isfahan-metro` only when there is an actual pinned source.
   Alternatively register a pinned, original, source-backed collection after
   validating its license. Do not register a speculative source.
4. Implement `importers/isfahan.ts` and
   `topology/isfahan.*.json` with schema v1 IDs and explicit route statuses.
   Preserve unknown amenities as `null` and transfer duration as unknown;
   do not invent timetables or ETAs.
5. Pass source review, independent graph tests, exact source hash checks and
   `pnpm build --city isfahan` before publishing generated data.
6. Get a separately recorded release authorization for a bounded *path-only*
   city preview before wiring app routes, maps, station counts, SEO or sitemap.

## Sources to examine

- https://www.tasnimnews.ir/fa/news/1404/10/08/3483056/ — 2025-12 operator-reported 20-station Line 1 and service state
- https://www.mysafar.com/mag/iran-tourism/isfahan/isfahan-metro-map/ — 2026 ordered 20-stop Line 1 secondary inventory; not audited current service
- https://www.tasnimnews.ir/fa/news/1405/06/14/3689088/ — September 2026 city administration statement about Line 2 progress and carriages
- https://github.com/miladvlp/esfahan-metro-data — Potential data-source discovery only; license not established, no data copied or coordinates admitted

Review entries are intentionally conservative. A source reporting a currently
operational **line** does not certify that every proposed stop can board.

## Source matrix / outstanding contradiction (28 Oct 2026)

`sources/isfahan/station-evidence.json` now records **20 source-listed station
names**, one review record per item, with references. Individual boarding
is *not confirmed* at any of these stops. In particular, **Daneshgah** and
**Kargar** are disputed: the operator-quoted 8 Dey 1404 report says Line 1
has 20 active stations, while a guide published 27 Mehr 1405 says those
two are not yet operational. The correct boardable count is NOT 18 or 20
until individual checks resolve this.
- Report: https://www.tasnimnews.ir/fa/news/1404/10/08/3483056/
- Newer secondary caveat: https://www.wikiparvaz.com/8029/مترو-اصفهان-1405/

A later 18 Mehr 1405 official-quoted account says Line 2 has completed
infrastructure but **cannot start public service due to missing trains**.
Keep Line 2 out of passenger routing until operator-confirmed launch:
https://www.tasnimnews.ir/fa/news/1405/07/18/3719021/

All geographic points and OpenStreetMap entity IDs intentionally remain
`null` pending an immutable licensed extract. No copied external map.

### Independent OSM network-count cross-check

The [OSM-derived subway validator](https://maps.mail.ru/osm/tools/subways/latest/iran.html)
reports 1 mapped subway line(s), 20 station records and 0
interchange(s) for isfahan, generated 2026-10-11 10:11 UTC.
This **corroborates only a network-level inventory**, NOT that the records
match current boardable stations or represent distinct physical buildings.
Exact raw OSM entity IDs/versions, live boarding status and access still
require manual verification and a pinned ODbL-compatible extract.

## Historical opening is not current station service

A dated 27 Esfand 1396 report records the **trial opening of six southern
stations** on Line 1 between Azadi and Soffeh:
https://www.tasnimnews.ir/fa/news/1396/12/27/1684108/

This supports an historical opening, not current boarding status. The
October 2026 secondary guide claims Daneshgah/Kargar are inactive. Both
are kept as `conflicting-reports`; none is silently marked operational
or closed. Verify with a dated station-specific operator report.

For future geographic intake use raw, immutable OSM elements with object
type, ID, version and legal attribution (ODbL), NOT copied coordinates
from an unlicensed third-party map. https://www.openstreetmap.org/copyright
