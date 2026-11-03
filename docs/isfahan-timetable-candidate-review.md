# Isfahan timetable candidate review

Last reviewed **2026-11-03**. The supplied workbook and CSV are now normalized
into a **review-only** candidate with **283 runs and 5,236 printed station times**.
Both missing Friday 22:00 departures have been read from their full source rows;
five weekday extra dispatches remain conditional. No production timetable or
passenger ETA capability is enabled.

## Sources and directions

The operator's [timetable page](https://metroisfahan.ir/post/9363/زمان-بندی-حرکت-قطارها)
and its original weekday/Friday posters explicitly show update **1405/07/11**.
HTTP Last-Modified dates (2026-10-03) agree. Exact input, page and image hashes,
the 20-station identity crosswalk and the original intake findings are in
[`timetable-candidate-review-2026-10-31.json`](../sources/isfahan/timetable-candidate-review-2026-10-31.json).

- `qods_to_defa`: **قدس → دفاع مقدس (صفه)**.
- `defa_to_qods`: **دفاع مقدس (صفه) → قدس**.
- Every train retains its direction, origin, destination, service days, source
  data-row number and all 20 stations in travel order, including black cells.
- Timezone is **Asia/Tehran**. Source station times continue to 22:39; a 22:00
  last-departure banner is not a last-arrival cutoff.

The original uploads contain 281 trips and 5,204 station-time records. Workbook
and CSV keys and all 12 shared fields agree. Names, station order, clocks,
metadata, duplicates and monotonic travel order were checked. The workbook
marks five runs `special_dispatch=True`; its CSV loses that distinction.

Original uploads are retained locally under
`.quality-report/isfahan-timetable-intake-2026-10-31/inputs/`. Operator originals
are local review evidence only. Their site asserts all rights reserved; images
and video are referenced by URL/hash, not redistributed or labelled as OSM data.

The user subsequently supplied both posters directly and selected them as the
timetable sources. Their visible headers agree with the retrieved operator
posters: Saturday–Thursday 06:00–22:00 and Friday 09:00–22:00. Neither header
mentions public holidays. The user's suggestion that holidays might use Friday
service remains a guess; it does not override the separate unconfirmed holiday
rule. Chat-rendered images are not claimed to be byte-identical to the pinned
operator originals. This source selection is recorded in the calendar evidence.

## Corrected candidate

| Day group | Direction | Regular runs | Conditional extras | Printed station times | Terminal departures |
| --- | --- | ---: | ---: | ---: | --- |
| Saturday–Thursday | قدس → دفاع مقدس | 86 | 3 | 1,780 | 06:00–22:00 |
| Saturday–Thursday | دفاع مقدس → قدس | 86 | 2 | 1,760 | 06:00–22:00 |
| Friday | قدس → دفاع مقدس | 53 | 0 | 848 | 09:00–22:00 |
| Friday | دفاع مقدس → قدس | 53 | 0 | 848 | 09:00–22:00 |

“Regular” means a published pattern, not confirmation of operation on every date.
The candidate separates `scheduledTrips` (278) and `conditionalTrips` (5).

The added Friday trips are native image **data row 53**, one per direction.
All **32 visible times** were manually read, including 22:00 departures and
22:39 opposite-terminal times. Each cell retains its original-image pixel box.
The eight black cells remain null. The upload's Friday row numbering has a
three-row offset; native image row numbers are explicit in normalized trips.
The source-row gaps in the weekday panels are annotation rows in the opposite
direction, not missing regular dispatches.

The conditional extra runs are:

- قدس → دفاع مقدس: **06:42, 06:53, 07:04**.
- دفاع مقدس → قدس: **13:07, 13:19**.

The source footnote is preserved verbatim:
**قطارهای فوق العاده حسب نیاز و در صورت امکان، اعزام خواهند شد**.
They must remain outside guaranteed next-train results. The correction evidence
is in [`timetable-reviewed-corrections.json`](../sources/isfahan/timetable-reviewed-corrections.json).

## Independent source-cell comparison

The upload reconstructed times using terminal departures plus first-run station
offsets. Agreement between workbook and CSV alone would not validate them.
A separate raster reader now reads the actual original pixels using glyph
templates labelled from visually read source cells. Uploaded later-row clocks
are joined **after** decoding; the decoder does not calculate station offsets
or extend a headway formula.

| Check | Result |
| --- | ---: |
| Original uploaded times agreeing with the pixel reader | 5,121 |
| Uploaded cells read visually after decoder disagreement/abstention | 83 |
| Added Friday times read visually | 32 |
| Remaining source-time differences | 0 |
| Remaining unreadable printed times | 0 |
| Black source cells retained without invented times | 424 |

The decoder initially disagreed on 30 cells and abstained on 53. Enlarged source
crops labelled only with native row/direction/station were read separately;
all 83 readings agreed with the upload. The 30 disagreements were decoder
errors, including merged Persian minute glyphs. Their original confidence
scores and machine readings remain in the local full audit, rather than being
silently rewritten. Manual readings are in
[`timetable-cell-review.json`](../sources/isfahan/timetable-cell-review.json);
the deterministic report hash and counts are in
[`timetable-cell-audit-summary.json`](../sources/isfahan/timetable-cell-audit-summary.json).

This combines machine comparison and **one visual reviewer**. It is not an
independent second-person review or operator approval. Machine agreement is
retained as machine evidence; it is not relabelled as manual verification.
Every normalized stop links to its source-cell box and audit hash. All timing
records retain `reviewOnly: true` and `productionEtaApproved: false`.

The source is a station movement timetable. It does not separately identify
arrival, departure or dwell times. The candidate therefore stores
`publishedTime`; the duplicate upload arrival/departure columns do not imply
zero dwell or measured arrivals.

## Friday boarding discrepancy

The **1405/07/11** poster blacks **بهارستان، گلستان، دانشگاه، کارگر** in
both directions. Following the user's research, the candidate provisionally
interprets those cells as no passenger boarding/alighting. It does not invent
times, infer nonstop passage, remove physical track or mark permanent closures.

An older operator [active-Friday-stations page](https://metroisfahan.ir/post/3238/ایستگاه-های-فعال-مترو-در-روزهای-جمعه),
dated **1402/11/07**, contains a video. Its final station diagram explicitly
lists **کارگر** as active and omits **چمران**, along with بهارستان، گلستان،
دانشگاه. Its historical hours are 09:00–21:00. The video was downloaded, hashed
and visually inspected; this independently establishes that the sources differ.
It does not establish the current rule. Both versions and their dates are
retained in the calendar evidence, with `conflictResolved: false`.

The two station names refer to distinct stable Isfahan identities. No station
boarding status in the graph or passenger app is changed by this interpretation.

## City-specific calendar

[`service-calendar-review.json`](../sources/isfahan/service-calendar-review.json)
and [`isfahan-service-calendar.ts`](../importers/isfahan-service-calendar.ts)
keep Friday, public holidays and exact-date exceptions separate:

1. A source-verified exact-date closure or modified schedule takes priority.
2. An unverified exact-date report blocks a normal-service promise.
3. Friday uses the published Friday pattern, preserving the holiday flag.
4. A non-Friday public holiday stays **unconfirmed**, provisionally **no service**,
   with no timetable or promised departures.
5. An ordinary Saturday–Thursday uses the weekday pattern. Unknown holiday
   classification blocks that fallback.

Verified modified hours alone do not supply station times. Without a separately
referenced timetable the resolver returns `hours_only`, not fabricated shifted
departures. Conflicting verified overrides also return unconfirmed. The current
poster cannot establish service before its 2026-10-03 publication.

The user supplied research about an August 2025 normal holiday-closure practice
and specific 1405 Nowruz closures/modified hours. Exact independently verified
announcements were not retrieved in this review. These remain attributed user
research, not invented citations or populated date overrides. `dateOverrides`
is deliberately empty until exact notices can be attached. This resolver is
review code; no production holiday calendar or ETA path uses it yet.

## Reproduce locally

The original files are not redistributed. Obtain the pinned upload and two
unmodified operator images first; the scripts reject changed hashes. Use a
local Python virtual environment for the optional analysis dependencies:

```bash
python3 -m venv .quality-report/isfahan-review-venv
.quality-report/isfahan-review-venv/bin/pip install -r scripts/requirements-isfahan-review.txt
.quality-report/isfahan-review-venv/bin/python scripts/audit-isfahan-timetable-cells.py \
  --source-dir /path/to/original-images \
  --input /path/to/stop_times.csv
pnpm candidate:isfahan:timetable --input /path/to/stop_times.csv
```

Name the original image files `weekday.jpg` and `friday.jpg`. The audit writes
`.quality-report/isfahan-source-cell-audit.json` and its summary. The candidate
builder requires the regenerated audit to match the committed summary hash,
then writes only `.quality-report/isfahan-timetable-candidate.json`. It never
writes canonical `data/cities/*` schedules or changes city availability.
Ordinary CI does not download these external originals or require Python;
TypeScript tests cover normalization, source evidence pins and calendar rules.

## Genuinely unresolved evidence

| Unresolved item | Exact evidence needed |
| --- | --- |
| Current non-Friday public-holiday policy | A dated current operator rule confirming blanket closure, or exact-date notices for each affected holiday. A third-party guide or old general statement cannot establish the current blanket rule. |
| Friday black-column meaning and چمران / کارگر discrepancy | A current operator explanation of boarding/alighting at the four black columns, explicitly reconciling the 1402 video and 1405 poster. |
| 1405 Nowruz overrides | Original dated announcement(s) enumerating closed/open dates, hours and Friday exceptions. Hours alone still need a separate station timetable before producing ETAs. |
| Approval to use timetable candidates for passenger ETAs | A second reviewer/operator sign-off on the pinned cells and applicable service/boarding/calendar rules. Pixel agreement alone does not certify present-day operation. |

Directions, station order, source date and the two complete final Friday rows are
resolved from the sources. No remaining printed cell needs the user to guess
its direction or reconstruct a missing time. Existing production datasets and
the Isfahan map-preview graph remain unchanged.
