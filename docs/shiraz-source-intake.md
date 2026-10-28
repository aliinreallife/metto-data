# Shiraz: candidate-only source intake

This is a **review packet only**, not a third publicly routable Metto city.
Mashhad is already included in the app; Shiraz is new and remains blocked from
production. No entries in `sources.json` or `data/cities/shiraz` exist.

## Source inventory

- Line 1: twenty candidate passenger-station names in published order.
- Line 2: seven reported passenger-station names. The proposed stop ordering
  differs across guides, including Imam Hossein / Esteghlal. Do not interpret
  this array as a validated ordered rail path.
- Imam Hossein appears in both line inventories; **a shared name does not
  create an automatically verified interchange**. No platform walking time
  or accessibility capability is asserted.
- Other lines under construction are outside initial passenger routing.
- The April 2026 opening of Esteghlal is documented by an operator-quoted
  report, not treated as an independent audit of the entire route.

`sources/shiraz/review.json` records provenance and missing evidence.
No external map, imagery, station coordinates, old schedule feeds or
unknown-license datasets are duplicated in the repository.

## Required next work

1. Find a pinned, redistribute-compatible official or OpenStreetMap dataset
   with individual station point IDs, versions and source licenses.
2. Reconcile stop order and distinguish Line 2 nonboarding track infrastructure
   from boardable stations.
3. Independently verify geographic coordinates, station names, and explicit
   Line 1/2 interchange connections. Keep unknown amenities as null.
4. Add a fail-closed `importers/shiraz.ts` and route/station validator with
   stable namespaced schema-v1 IDs.
5. Prohibit estimated arrival times and train schedules until source-backed.
6. Review the candidate graph, pass CI, and record explicit bounded release
   authorization before adding Shiraz to the app's selector, route API or SEO.

## Source references

- https://www.tasnimnews.ir/fa/news/1405/01/19/3560870/
- https://lastsecond.ir/blog/11175-shiraz-metro-guide
- https://reylo.ir/line/shiraz-metro-line-2/
- https://github.com/MaxEdison/ShirazMetro-API

Status: candidate; no public route claims, timetables, station coordinates,
facilities or service guarantees.
