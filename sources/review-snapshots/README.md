# Versioned research snapshots — not production city data

Original Overpass JSON bytes, © OpenStreetMap contributors, licensed under
[ODbL-1.0](../../LICENSES/ODbL-1.0.txt). Attribution and license obligations:
https://www.openstreetmap.org/copyright . These files are manual research inputs,
not operator feeds or released Metto datasets. They are not in `sources.json`
and are not consumed by the application or the city builder.

Each original file has a SHA-256 in its provenance sidecar. The sidecar records
the Overpass endpoint, exact query, source base timestamp, retrieval time and
false production/boarding/coordinate/route approvals. The index summarizes
review counts without treating OSM elements as distinct boardable stations.
Never edit a saved raw file; collect a new snapshot and record its hash instead.

The 2026-10-29 name review used the evidence matrices at commits
`6b94c07c82ca50dad2da76c21c14362af016f839` (Isfahan PR #31) and
`911612b38e7725a7b1b48edd3e45b0a62fbe30f7` (Shiraz PR #32). Their byte hashes
are in `index.json`. Copy those matrices from the pinned commits into a scratch
file and pass that file to `source:osm:name-review`; those sibling PRs need not
be merged to reproduce the review.

Reproduce offline, for example:

```sh
pnpm source:osm:candidates --city isfahan --input sources/review-snapshots/2026-10-29/isfahan-14113bdeb953.json
# The matrix file must be the exact evidence matrix from the pinned commit above.
pnpm source:osm:name-review --city isfahan --candidates .quality-report/isfahan-osm-candidates.json --matrix /tmp/isfahan-station-evidence.json
```

The station exports do not establish a complete track graph. Shiraz Line 2's
full relation export was not obtained (one HTTP 504, one bounded timeout); no
partial relation or invented track geometry is included. No current boarding,
interchange access, amenities or travel times are approved by these snapshots.
