# Isfahan and Shiraz review — 2026-10-29

**Verdict: useful research; neither city is ready for passenger release.**
There is no new-city importer, generated station/track dataset, or app
integration in the reviewed PRs. Passing their CI means the research does not
break the existing app, not that the new cities can be routed safely.

Reviewed commits:

- Isfahan [PR #31](https://github.com/aliinreallife/metto-data/pull/31),
  `6b94c07c82ca50dad2da76c21c14362af016f839`.
- Shiraz [PR #32](https://github.com/aliinreallife/metto-data/pull/32),
  `911612b38e7725a7b1b48edd3e45b0a62fbe30f7`.
- Research tools [PR #33](https://github.com/aliinreallife/metto-data/pull/33),
  `b4aab5602a67338022fff59f8ad0298cb4ae6f5c`.
- Passenger app `02f5f6aa411f881ca1226143f437092119774d97`.

The conversation preview contained placeholders; this review is based on the
actual PRs, source files, downloaded OSM snapshots and linked news references.

## Findings fixed in this follow-up

1. **Partial exports could look complete.** The candidate parser accepted
   Overpass error remarks and silently skipped unversioned records even though
   the fetch command rejected them. Both paths now use one strict validator.
   A good station followed by an unversioned object or a timeout remark fails
   the entire export. Duplicate IDs and malformed source timestamps fail too.
2. **A relation member list was not proof that its referenced objects existed.**
   The old relation check only required a nonempty array. A missing platform,
   nested relation, or way node could pass the source-acquisition check. The
   fetch scope now recurses through descendants and checks every reference;
   the manifest records the root relation version. This is structural source
   completeness, not proof of a connected rail graph or current service.
3. **Tests could overwrite real research.** The original CLI tests wrote fake
   exports to the checkout's normal `.quality-report/` download paths. The CLI
   regression tests now run copied scripts in isolated temporary repositories.
   Real downloaded files retain their hashes after the full test suite.
4. **Name review accepted malformed or approval-bearing candidate reports.**
   It now rejects invalid/missing object versions, duplicate objects and true
   candidate/report approval flags. Results project explicit identity fields
   and link to the specific OSM object version. All output approvals stay false.

These are research-quality issues, not evidence that invalid new-city routes
were published: the drafts never register the cities or generate those routes.

## Real source collection and what it establishes

Original, versioned station exports were obtained from Overpass and saved under
[`sources/review-snapshots/`](../sources/review-snapshots/README.md), with exact
bytes, SHA-256 hashes, source base times, queries and ODbL attribution.

| Review result | Isfahan | Shiraz |
| --- | --- | --- |
| Proposed memberships in city matrix | 20 on Line 1 | 20 on Line 1 + 7 on Line 2 |
| Distinct name leads | 20 | 26, including shared Imam Hossein |
| Raw mapped objects downloaded | 79 | 68 |
| Name leads with multiple exact matching objects | 17 | 24 |
| Name leads without an exact normalized match | 3 | 2 |
| Individually approved identities, boarding statuses or route edges | 0 | 0 |

Raw object counts include station/platform/stop representations and unrelated
rail stations; they are **not passenger-station counts**. Multiple matching
objects often describe a station and its platforms. Preserve those roles and
resolve physical identities manually; do not deduplicate by display name alone.
An OSM operational-looking tag does not settle the boarding-status questions.

The alias gaps are concrete:

- Isfahan: `سی‌وسه‌پل` vs `سی و سه پل`, `دکتر شریعتی` vs `شریعتی`, and
  `دفاع مقدس` vs `دفاع مقدس (صفه)` after stripping the station prefix.
- Shiraz: `قصر دشت` vs `قصردشت`, and `میدان ولیعصر` vs `ولیعصر`.

These are manual alias-review leads, not an instruction to merge similarly
named stations automatically. Coordinates are still only representative points,
not verified entrances or independent evidence of current boarding.

Shiraz's complete Line 2 relation was **not obtained**: the main endpoint
returned HTTP 504 and one alternative endpoint reached the bounded timeout.
Neither failure produced an admitted partial relation. No route order has been
inferred from station coordinates or from the chronology of openings.

## Evidence independently checked

The linked Tasnim pages returned the expected articles on 2026-10-29:

- [Shiraz, 19 Farvardin 1405](https://www.tasnimnews.ir/fa/news/1405/01/19/3560870/)
  supports the dated Esteghlal opening as the seventh Line 2 station. It does
  not establish the full stop sequence or live Line 4 boarding.
- [Isfahan, 8 Dey 1404](https://www.tasnimnews.ir/fa/news/1404/10/08/3483056/)
  quotes the operator describing Line 1 with 20 active stations, from Qods to
  Defa-e Moghaddas. That is stronger evidence than an undated/stale guide, but
  not a station-specific resolution of the newer guide's contradictory claims.
- [Isfahan, 18 Mehr 1405](https://www.tasnimnews.ir/fa/news/1405/07/18/3719021/)
  reports Line 2 infrastructure awaiting trains. Construction readiness does
  not authorize passenger routing.
- [Isfahan, 27 Esfand 1396](https://www.tasnimnews.ir/fa/news/1396/12/27/1684108/)
  supports a historical trial opening, not today's access at Daneshgah/Kargar.

Publication/update dates on commercial guides should not be treated as proof
that each station claim was recently checked. Seek dated operator station lists,
network maps, opening/closure notices or documented field observations; a live
service API is not required to document an explicitly dated operating scope.

## Passenger app work is also outstanding

The app still has a two-city `CityId` and several Tehran/Mashhad-specific paths.
Changing a selector or adding JSON alone would not finish city integration.
Before enabling either city, review at least:

- `lib/cities.ts`, `lib/city-availability.ts`, `app/layout.tsx`: city registry,
  availability and provider loading.
- `lib/geocoding.ts`: a non-Mashhad city currently falls back to Tehran's search
  box. Use explicit per-city geographic bounds and city-specific suggestions.
- `components/city-map.tsx`: untimed path selection dispatches specifically to
  Mashhad; a new city must use its own approved graph, never a Tehran fallback.
- `app/nav.tsx`, `app/(landing)/components/Hero.tsx`: namespaced endpoint state,
  correct city counts, source attribution and route examples.
- APIs, combined station search, map endpoint selection, city URLs, sitemap,
  offline behavior and failure states: verify same-name stations stay separated
  by city ID and unsupported cities fail explicitly.

Keep Tehran's timetable planner intact. Reuse the simple untimed passenger
experience for new cities only after their graphs pass review. No made-up
arrival estimates, amenities, transfer durations or road-routed metro geometry.

## Recommended next delivery

1. Resolve physical station objects and the five alias gaps against the pinned
   OSM snapshots; retain a source pointer per coordinate and separate platforms.
2. Resolve Isfahan's Daneshgah/Kargar evidence and Shiraz Line 2's
   Esteghlal/15 Khordad/Imam Hossein sequence and directed Line 1/2 transfer.
3. Build **candidate** schema-v1 importers/graphs while keeping publication
   blocked. Use explicit track/interchange edges, independent topology tests,
   null unknown amenities and source timestamps. Timetables are not required
   for the initial path-only delivery.
4. Prepare one bounded city preview at a time, starting with Isfahan's simpler
   single-line network if its boarding questions are resolved first. Review the
   actual generated graph and passenger flows before changing availability.

No production dataset, city availability flag, station count, route, timetable,
map or deployment is changed by this follow-up. Existing draft PRs remain open.
