# Mashhad construction map reference

The map-only reference includes five OSM construction ways for Line 3 extensions
and Line 4, retrieved 2026-10-25. It is rendered as dashed geometry on the data
portal and copied to the Metto passenger app as a versioned reference artifact.
The portal shows the source and retrieval date. Passenger maps label the dashed
sections and retain OSM attribution in both basemap modes.

Sources: OpenStreetMap contributors, ODbL-1.0; attribution and license:
https://www.openstreetmap.org/copyright . Existing ODbL license text is retained
under `LICENSES/ODbL-1.0.txt`. No commercial map images or unlicensed geometries
are copied.

- The source explicitly tags these ways `railway=construction` and
  `construction=subway`.
- Line 3 north/south ways 276449885 and 1388754302 have member role `inactive`
  in both directions of the route relation. The central service way 1388754301
  is omitted. Small outer continuation ways 1564056417 and 1564056418 keep the
  corresponding OSM construction tags.
- Line 4 way 381927098 belongs to relation 5692275, whose route type is
  `construction:subway`.
- These are source-reported infrastructure facts, not a current operator
  confirmation or opening announcement. Display colors are provisional UI
  colors. Regional Line 6/Golbahar, unlabeled construction and depot links are
  outside this scope.
- No proposed station nodes, boarding assertions, arrival times, opening dates,
  transfers or routing edges are imported. The public boarding catalog stays
  at 36 Mashhad stations on Lines 1/2. Proposed stop positions are not entrances.

Pinned geometry/node versions are stored in `sources/mashhad/construction-map-snapshot.json`.
The review stores source URLs, way/relation versions, timestamps and raw response
hashes without contributor account metadata. `pnpm map-reference:check` checks
that the derived artifact agrees with this snapshot. Canonical city builds do
not consume it. Tests keep its OSM identifiers and Line 4 out of the passenger
graph.
