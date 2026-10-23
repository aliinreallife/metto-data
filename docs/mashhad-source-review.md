# Mashhad metro data: source review (2026-10-21)

**Status: DRAFT, NOT APPROVED FOR PRODUCTION ROUTING.** This review record is part of the data release, and must be revisited at every source update.

The initial snapshot is `shahriaarrr/mashhad-metro-data@f5d5c78816a8cc360bb9ae00db8fb8bad23a29e0` (ODbL-1.0). We never modify the upstream submodule; importer output + curated topology + evidence-backed corrections are separate.

## Scope
- 38 unique station records, 3 lines, 41 line memberships; 24/13/4 service nodes per line and 38 consecutive edges.
- Line 4 is under construction; do not create operational route entries.
- Source metadata is pinned in `sources.json`. Station coordinates are WGS84 representative points, NOT train-platform doors.
- Source `relations[]` is directional and insufficient; curated order lives in `topology/mashhad.routes.json`.
- Original `Fajr` source coordinate duplicates `Velayat`. The reviewed corrective representative point `36.31281,59.65543` comes from [OpenStreetMap node 14133541209](https://www.openstreetmap.org/node/14133541209), cross-referenced with [Mapcarta's OSM-derived station object](https://mapcarta.com/N14133541209). This is not an entrance survey.
- Upstream `shahid mofatteh.name` incorrectly equals `Nabovvat` (a distinct station). We correct its canonical English name to `Shahid Mofatteh` with the cited [October 1405 station list](https://www.saadatrent.com/mag/iran/mashhad-metro-map/); the inaccurate upstream string must never become an alias.
- Upstream amenities are **not independently verified**. Canonical output uses `null` for unknown facilities; never turn unknown into `false`.
- Line colors are **provisional upstream values**, not a verified official palette.
- Line 3 candidate list follows a four-stop claim in the [October 1405 Mashhad metro guide](https://www.saadatrent.com/mag/iran/mashhad-metro-map/). Its embedded map and OSM disagree; see the retrieved evidence below. This is not verified boardability.
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

## Verification continuation (2026-10-23)

The pinned source and current candidate were inspected locally: all 38 source
records have `disabled: false`, but that is an upstream assertion, not dated
operator confirmation. The curated candidate contains 41 line-specific boarding
claims (24/13/4) and three shared-station interchanges. Its three Line 3 edges
connect the four candidate boarding points; they do not prove that no intermediate
infrastructure or non-boarding stops exist.

| Item | Current candidate | Evidence still needed |
|---|---|---|
| Line 1 | 24 boarding claims, Vakilabad to Airport | Dated operator map/order and stop availability |
| Line 2 | 13 boarding claims, Tabarsi to Shahid Fakouri | Dated operator map/order and stop availability |
| Line 3 | Imam Reza Terminal → Basij → Bab Al-javad → Shohada | Passenger boarding at each stop, service pattern and intermediate pass-through infrastructure |
| Shariati | Shared by Lines 1/2 | Usable interchange and walking time in both directions |
| Basij | Shared by Lines 1/3 | Usable interchange and walking time in both directions |
| Shohada | Shared by Lines 2/3 | Usable interchange and walking time in both directions |
| Schedules | No verified feed | Licensed departures/headways and service calendar; no precise ETA yet |
| Amenities/entrances | Unknown amenities; representative coordinates | Independent facilities and doorway evidence |

The operator, cited guide, OpenStreetMap and Wikipedia requests were denied by
the environment HTTPS proxy (CONNECT 403). This is an access limitation, not
evidence that an operator site or train service is down. No new service claims
were approved; the previous Fajr correction was not independently rechecked.
The attempt is recorded in `sources/mashhad/review.json` without changing the
previous `sourceCheckedAt` date.

`pnpm quality:report` now also emits `.quality-report/mashhad-release-review.json`:
all 41 boarding assertions, the three interchange-review targets, the exact
dataset SHA-256, and release blockers. This is the review packet to reconcile
against operator evidence once access is available. It contains no invented
transfer times, entrances or departure schedules.

`pnpm check-release --city mashhad` now enforces the same review requirements as
the quality report. Changing/removing `releaseStatus` alone cannot promote the
candidate. Approval requires an approved city review, an explicit empty blocker
list, the correct upstream pin, and a maintainer identity/time bound to the
current dataset SHA-256. That record documents human review; it does not perform
independent verification or cryptographically authenticate the reviewer.

## Retrieved evidence and first-release scope (2026-10-23)

After the network change, the guide, Wikipedia and OSM returned HTTP 200.
The operator returned HTTP 503 with an upstream connection timeout; no operator
content was read. At this stage, primary articles linked by Wikipedia on
`shahraranews.ir` and `www.isna.ir` were still blocked by the proxy; the
continuation below records the later successful access and content checks.

The user chose **stations and route paths first, without arrival estimates**.
The initial scope under review is Lines 1/2 (36 unique stations); Line 3 remains
withheld pending a separate complete service-pattern review. Exact departures, travel-time
estimates, street entrances and amenities are not promises of this scope.
This is a delivery plan, not production approval.

The retrieved OSM evidence is archived in `sources/mashhad/osm-review-snapshot.json`
with its SHA-256 recorded in `review.json`:

- Fajr node 14133541209 v2: 36.3128066, 59.6554285, consistent with our existing
  rounded correction. No coordinate change was necessary.
- Line 1 relation 154407 v35: 24 stops match the candidate's ordered route.
- Line 2 relation 5623319 v29: 13 stops match, including Shahid Fakouri.
  Its `to` label still says Shahid Kaveh; use actual members as evidence,
  and do not infer a truncation from that stale label.
- Line 3 relation 5692274 v15 (October 1, 2026) has three stop members and
  omits Basij. Basij's Line 3 stop node is still tagged proposed.
  The guide's October 21 text claims four active stops and a Basij opening
  in Mordad 1405, while its embedded network map shows three active Line 3
  stops. These observations conflict; neither establishes current boardability.
- The guide writes «قیام» where the candidate and OSM say «قائم». The existing
  Ghaem name is retained. Wikipedia oldid 1338460161 also has an inconsistent
  active-station aggregate; do not add records from that number alone.

OSM stop-position coordinates differ from candidate representative points by up
to about 125 m on Lines 1/2. These are different kinds of points, not verified
entrances; no walking directions or correction was inferred from those offsets.
No third-party map image, article body, station database from an unlicensed app,
or supposed timetable was copied into the dataset. Canonical data is unchanged.

## Dated service and interchange evidence retrieved (2026-10-23)

Shahrara article content is now accessible. Ten selected reports, their exact
publication metadata and response hashes are recorded in
`sources/mashhad/service-evidence.json`, with independently written factual
notes. Several quote the operator's directors or city council chair; field
reporting also describes passengers using the services. They are reports from
one publisher, not ten independent publishers. No article body, photograph,
video, map or purported timetable is redistributed. Response hashes record
the fetched bytes; news sidebars can change, so these are not immutable archives
or cryptographic authentication of the speakers.

| Question | Dated evidence | Interpretation for the first scope |
|---|---|---|
| Line 1 service | [October 19 operator interview](https://shahraranews.ir/fa/news/453536/), [October 11 operating-company response and field report](https://shahraranews.ir/fa/news/451549/) | Current service and 24-station line corroborated; not a live audit of each platform |
| Airport endpoint | [June 9 resumption notice](https://shahraranews.ir/fa/news/420784/) | Explicitly resumes Reyhaneh/Airport service after a temporary suspension; keep the candidate endpoint |
| Line 2/Fakouri endpoint | [October 19 interview](https://shahraranews.ir/fa/news/453536/), [August 4 reopening notice](https://shahraranews.ir/fa/news/435635/) | 13-station Tabarsi–Fakouri line and terminal service corroborated; the stale OSM `to` label must not remove Fakouri |
| Shariati interchange | [December 29, 2025 passenger report](https://shahraranews.ir/fa/news/382219/), [January 19, 2026 field report](https://shahraranews.ir/fa/news/386944/) | Both Line 2→1 and Line 1→2 passenger movement described; untimed connectivity supported, without platform/walking/accessibility claims |
| Basij Line 3 boarding | [August 9 opening report](https://shahraranews.ir/fa/news/436562/), [August 26 operator statement/field report](https://shahraranews.ir/fa/news/440642/), [October 22 council statement](https://shahraranews.ir/fa/news/454293/) | Passenger boarding and the Line 1/3 connection have stronger dated support than OSM's `proposed` tag; the initial scope still excludes Line 3 |
| Other Line 3 stops | [October 22 council statement](https://shahraranews.ir/fa/news/454293/) | 15 Khordad, Mesbah Yazdi and Sharestan are described as future additions; do not mark them operational or import new records from that statement |

The May 2025 three-stop launch report is historical. Its single-train pattern,
hours and headways must not be reused as current operating data. Similarly,
the 2026 news reports' generic hours/headways are not a licensed, verified
departures feed and are excluded from this scope.

ISNA returned HTTP 200 containing only a browser-check/transfer page, so its
article remains unread. The operator website still returned an origin
connection-timeout response. Neither response was counted as content evidence.

`pnpm quality:report` additionally produces
`.quality-report/mashhad-path-review.json`: **36 stations, 37 line-specific
boarding claims, 35 route edges, two directed untimed Shariati links**, dated
supporting claims and the remaining review items. It excludes Line 3 and
timing capabilities. Its fingerprint binds the candidate dataset, exact
evidence bytes, projection and directed links. Invalid references, timing
claims or an expanded scope fail; changed OSM order and missing line-service
support are reported as integrity gaps. This packet always says
`releaseReady: false`: evidence compilation does not grant approval.

Remaining work for public Lines 1/2 activation is the station-level boarding
review and approval of the exact projection/untimed links. A timetable,
measured walking duration, official palette, entrances and amenities are
separate capabilities and are **not required** for this first scope. Full-city
release checks remain blocked; no canonical data or public app scope changed.

Local validation of this continuation passed: 70 tests in 12 files, typecheck,
both city validators, pinned-source provenance, generated-data reproducibility,
and quality reporting (zero integrity errors, three existing manual-review
warnings). Tehran's release check passes; Mashhad's five review/approval
failures are expected. News retrieval and audit generation do not alter the
candidate's canonical dataset fingerprint.
