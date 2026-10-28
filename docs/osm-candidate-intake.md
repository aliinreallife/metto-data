# OpenStreetMap research for Isfahan and Shiraz — NOT a publication tool

`pnpm source:osm:candidates --city isfahan --input /path/to/overpass.json`

This command reads a **locally saved** Overpass JSON export and writes a
review-only file to `.quality-report/isfahan-osm-candidates.json` (or
`shiraz-osm-candidates.json`). It never updates `sources.json`,
`data/cities/*`, `overrides/*`, `topology/*`, or public app data.
No network access is required for the command or CI.

## Obtain a snapshot

Use https://overpass-turbo.eu/ in a normal browser. The example queries
below are **discovery** queries, not authoritative route graphs. Choose a
reasonable bounding box; include node/way/relation entities and their
version and center information. Avoid huge countrywide requests.

**Isfahan** (broad screening box, not a completeness guarantee):

```overpass
[out:json][timeout:90];
(
 nwr["station"="subway"](32.51,51.46,32.81,51.87);
 nwr["railway"="station"](32.51,51.46,32.81,51.87);
 nwr["public_transport"="platform"]["subway"="yes"](32.51,51.46,32.81,51.87);
);
out center meta;
```

**Shiraz** (broad screening box, not a completeness guarantee):

```overpass
[out:json][timeout:90];
(
 nwr["station"="subway"](29.48,52.38,29.78,52.76);
 nwr["railway"="station"](29.48,52.38,29.78,52.76);
 nwr["public_transport"="platform"]["subway"="yes"](29.48,52.38,29.78,52.76);
);
out center meta;
```

Save the API response **as JSON**, including the `osm3s` metadata and
`elements[]`. It is not enough to save a map screenshot or a reduced CSV.
The script records the raw file SHA-256 so the extraction is repeatable,
and each OSM entity's **type, ID, version, tag clues and representative point**.
A way/relation center is NOT a station entrance; it can be far from a
boarding platform. Bounding-box matches may include other rail services.

## Review gate before importing any coordinate

1. Match each prospective station by **physical identity**, not by fuzzy
   name alone; confirm Persian and English aliases and distinguish
   two platforms/lines from one interchange.
2. Manually inspect the OSM element version, lifecycle tags, geometry,
   station access point and relation membership; cross-check an independent
   dated operator map or station source.
3. Verify per-line **boarding** and through-running track statuses
   separately. Do not infer a boardable stop from a rail node or an
   advertised future line, especially Isfahan Line 2 or Shiraz Line 4.
4. Validate actual order and track traversal. For Shiraz Line 2, 15 Khordad
   may represent nonboarding infrastructure between two boardable
   stations; do not create a direct edge by filtering stop names.
5. Record a pinned, attribution-compliant ODbL source extract and
   manual review evidence in the city PR before writing its importer.
   Keep unknown facility values `null`, and never invent timetable/ETA
   estimates.

## Copyright and provenance

OpenStreetMap data is licensed under **ODbL 1.0**.
Attribution: **© OpenStreetMap contributors**.
See https://www.openstreetmap.org/copyright and
https://osmfoundation.org/wiki/Attribution_Guidelines .

This extractor preserves a precise OSM **snapshot hash** and entity version,
but it cannot independently authenticate the user's exported file.
No OSM geometries are copied into the canonical dataset by this script,
and the generated report is intentionally gitignored until explicit review.

## Match review-only candidates against a city's station inventory

When the city research matrix from [Isfahan PR #31](https://github.com/aliinreallife/metto-data/pull/31)
or [Shiraz PR #32](https://github.com/aliinreallife/metto-data/pull/32)
is available locally, run this **offline** cross-reference:

```sh
pnpm source:osm:candidates --city isfahan --input /tmp/isfahan-overpass.json
pnpm source:osm:name-review --city isfahan \
  --candidates .quality-report/isfahan-osm-candidates.json \
  --matrix sources/isfahan/station-evidence.json

pnpm source:osm:candidates --city shiraz --input /tmp/shiraz-overpass.json
pnpm source:osm:name-review --city shiraz \
  --candidates .quality-report/shiraz-osm-candidates.json \
  --matrix sources/shiraz/station-evidence.json
```

This produces a second **gitignored** artifact,
`.quality-report/<city>-osm-name-review.json`. It proposes only exact
normalized Persian-name matches. Arabic ي/ك versus Persian ی/ک,
the half-space, punctuation and the "ایستگاه مترو" prefix are normalized.
There is no fuzzy guessing or implicit platform merge. Shiraz's shared
Imam Hossein name is one physical *name lead* with two line memberships;
multiple same-named OSM objects are flagged **ambiguous**, not automatically
chosen. Unknown names remain unmatched.

All match entries retain false fields for station identity, coordinates,
boarding, topology and production approval. The candidate export's SHA
and the actual research matrix's SHA are recorded; this is a review queue,
not an immutable verification of the original upstream OSM response.

## Explicit live snapshot fetch (manual only; never CI or build)

The optional command below downloads and retains the **unaltered**, versioned
OSM export in gitignored `.quality-report/`, with a source/provenance sidecar.
It uses a small bounded Overpass query, allowlisted public server endpoints,
90-second timeout and a 20 MB response cap. It **cannot** be used to change
`sources.json`, import or publish a city automatically.

```sh
pnpm source:osm:fetch --city isfahan
pnpm source:osm:fetch --city shiraz

# Inspect the exact query offline:
pnpm source:osm:fetch --city isfahan --dry-run

# Accept an already saved raw export, without any HTTP request:
pnpm source:osm:fetch --city isfahan --validate /tmp/isfahan-export.json

# Parse to unverified candidate points, then compare with the review matrix:
pnpm source:osm:candidates --city isfahan --input .quality-report/isfahan-overpass-raw.json
pnpm source:osm:name-review --city isfahan \
  --candidates .quality-report/isfahan-osm-candidates.json \
  --matrix sources/isfahan/station-evidence.json
```

Run the same three-stage process for Shiraz. The candidate and matrix
review commands exist only after the reviewed draft branches are checked
out together or the dependencies are merged. **Never use the report as
an automatic station/boarding approval.** Record OSM object type, ID,
version and a second station-level operator source before admission to
the city importer. Public Overpass servers are best-effort services and
may fail/rate-limit; prefer a saved manual export rather than retries.
