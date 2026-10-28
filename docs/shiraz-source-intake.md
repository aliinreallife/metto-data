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

## Station-by-station service evidence (28 Oct 2026)

`sources/shiraz/station-evidence.json` contains 27 **line memberships**
for 26 distinct named physical-station leads. The only individually
operator-quoted station opening here is **Esteghlal (19 Farvardin 1405)**;
that dated event is not a live service API.

**Line 2 order is disputed.** Lastsecond and Reylo order Esteghlal before
Imam Hossein, but Saadatrent presents Imam Hossein before Esteghlal.
Lastsecond also reports unopened **15 Khordad** between them; it is
not part of the seven boardable-stop list. Do not join those stations with
an invented direct track edge until the physical line pattern is verified.

- Dated operator-quoted opening: https://www.tasnimnews.ir/fa/news/1405/01/19/3560870/
- Alternative published order: https://www.saadatrent.com/mag/iran/shiraz-metro-guide/
- Construction gap / alternative order: https://lastsecond.ir/blog/11175-shiraz-metro-guide
- Secondary planner: https://reylo.ir/line/shiraz-metro-line-2/

The Mayor's release additionally describes **Esteghlal as a future interchange
with Line 4**: it must NOT become a passenger-accessible Line 4 connection.
The Line 1/2 interchange at Imam Hossein also needs explicit directed
platform connectivity review; no walk time is claimed.

Source-linked claims are deliberately separate from canonical production
station IDs, coordinates and topology; release gates stay false.

### Independent OSM network-count cross-check

The [OSM-derived subway validator](https://maps.mail.ru/osm/tools/subways/latest/iran.html)
reports 2 mapped subway line(s), 27 station records and 1
interchange(s) for shiraz, generated 2026-10-11 10:11 UTC.
This **corroborates only a network-level inventory**, NOT that the records
match current boardable stations or represent distinct physical buildings.
Exact raw OSM entity IDs/versions, live boarding status and access still
require manual verification and a pinned ODbL-compatible extract.

## Raw OpenStreetMap data still required (2026-10-28)

Wikidata lists **Shiraz Metro Line 2 → OSM relation 15510494**:
https://www.wikidata.org/wiki/Q97218492

This is a lead for an original ODbL-compatible extract, **not** an
audited set of current platforms or track directions. The OSM relation
version, stop/platform members, role ordering and geometry remain
uncollected. Raw relation and child objects must be saved with immutable
versions, provenance and hashes before an importer consumes them.
ODbL attribution and license obligations:
https://www.openstreetmap.org/copyright

The April 2026 dated opening of Esteghlal as seventh Line 2 station
does not establish its physical order relative to Imam Hossein. The
published secondary guides disagree. In particular, 15 Khordad may
be *nonboarding track infrastructure*; representing it as another
boardable platform or building direct edges without verification
would change passenger routes. Remain candidate and do not publish
schedule estimates, map markers or transfers from this lead.
