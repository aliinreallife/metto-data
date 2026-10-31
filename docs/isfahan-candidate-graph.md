# Isfahan Line 1: offline candidate graph

This follow-up moves beyond the initial name inventory. It reconciles the 20
core station objects, preserves explicit aliases and checks both mapped rail
directions against original licensed geometry. **It is not a passenger launch.**

```sh
pnpm candidate:isfahan
```

The command reads committed, hash-pinned source bytes and writes only
`.quality-report/isfahan-candidate-graph.json`. No network or credentials are
needed. CI also runs this offline command and includes the review JSON in its
`metto-data-quality` artifact. The normal `pnpm build` still builds Tehran/Mashhad only; Isfahan is not
registered in `sources.json`, does not appear in `data/cities`, and is not loaded
by either passenger or data-portal city selectors.

## What is now established in the mapped source

- 20 unique namespaced candidate identities, from Qods to Defa-e Moghaddas.
- A specific versioned station object and track-stop object for each identity.
  Station objects are distinguished from platforms and stop positions.
- The explicit aliases for Si-o-se-pol, Shariati and Defa-e Moghaddas/Soffeh are
  reconciled against object names. No broad fuzzy-name merging is used.
- Two mapped directions with reverse-consistent sequences of the same 20 stops.
- 38 directed physical links, traced through original way nodes. Their geometry
  comes from metro ways, never a street router or straight-line fallback.
- All amenities remain null; no timetable, travel time or arrival estimates.

A [user-shared facility table](isfahan-facility-evidence.md) was transcribed on
2026-10-31 as separate, unverified evidence. Its original source/date and
asterisk legend are still unknown. It does not change canonical amenities,
wheelchair-accessibility claims, boarding gates or the candidate graph.

`checks.osmIdentityMappingComplete` and `mappedRailContinuityChecked` describe
these **OSM-only checks**. They do not certify operator topology, entrances,
independent coordinate accuracy, or current passenger boarding.

## Original route sources

The route IDs were discovered from Qods stop-position node 3690028835 and
corroborated by the bounded Overpass relation discovery query. Original full
OSM API exports were then collected directly:

| Direction | OSM relation | Version | Original export |
| --- | --- | --- | --- |
| Southbound | 5587340 | 33 | https://www.openstreetmap.org/api/0.6/relation/5587340/full.json |
| Northbound | 7705632 | 18 | https://www.openstreetmap.org/api/0.6/relation/7705632/full.json |

Pinned source bytes, SHA-256 hashes and the source object versions live in
`sources/review-snapshots/2026-10-29/`. These are original API 0.6 JSON documents,
not reformatted Overpass responses. They have no invented `osm3s` timestamp.
Their provenance sidecars preserve the response Date and license. The existing
station snapshot's hash is also checked before any coordinate is used.

Copyright © OpenStreetMap contributors, ODbL-1.0:
https://www.openstreetmap.org/copyright .

## Construction and inactive extensions are excluded

Both route relations include six construction ways. Only these three
non-construction subway ways participate in the candidate core corridor:

- way 364976148
- way 399299024
- way 917553488

The candidate verifies complete references, one unbranched connected corridor,
correct terminal positions, and strictly monotonic stop order along that
corridor. Missing geometry, mixed street/construction tracks, branches or
unreviewed one-way assumptions fail instead of producing partial links.

Northbound additionally contains five `stop_inactive` members: Baharestan,
railway station, Sepahan Shahr, Resalat and Amir Kabir extension leads. Their
IDs and roles remain in `omittedInfrastructure`; they are not candidate
boarding stations. The inactive southern **Baharestan node 7694192090** is
not the northern core **Baharestan stop node 3787736361**. A name alone must
never combine them.

No Line 2/3 route or interchange is generated, including the future Line 2
infrastructure near Imam Hossein.

## Remaining evidence and publication gates

The operator-quoted [8 Dey 1404 report](https://www.tasnimnews.ir/fa/news/1404/10/08/3483056/)
describes a running, 20-station Line 1. That remains a dated line-wide claim.
The historical 2018 trial-opening report and mapped OSM stop roles do not
independently settle the later secondary guide's Daneshgah/Kargar contradiction.
The attempted direct operator-site access was blocked, and the accessible
references did not yield a new station-specific confirmation. No false
confirmation is recorded.

The original station evidence matrix now points at the pinned candidate OSM
objects instead of saying the source objects are missing. Approved coordinates
remain null; its current-service flags and release gates remain false. That is
separate from the completed research mappings in `sourceProgress`.

This graph deliberately uses a **review format**, not schema-v1 operational
station/segment statuses. Marking unknown boarding as either `operational` or
`planned` would be misleading. Each physical link has
`passengerRoutingApproved: false`; the top-level `readyForProduction` and all
release gates are false. A future canonical importer needs an explicit reviewed
boarding scope and independent coordinate/operator topology review before
converting this packet to application data.

Next: resolve the two station-specific boarding questions, check the selected
representative points (four are station-area bounding-box centers, not
entrances), then prepare the bounded untimed passenger dataset/preview. The
passenger app's generic-city integration remains a separate task. Timetables
and amenities are not prerequisites for this initial path-only scope.
