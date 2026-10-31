# Isfahan timetable upload review — 2026-10-31

The workbook `metto_isfahan_line1_full_timetable_candidates.xlsx` and
`stop_times.csv` are useful candidate inputs. Both explicitly identify the two
directions and contain the same 5,204 station-time records. They are not yet a
verified timetable import. The workbook calls its data a machine reconstruction,
and every CSV row has `production_ready=False`.

The structured review and exact input/source hashes are in
[`timetable-candidate-review-2026-10-31.json`](../sources/isfahan/timetable-candidate-review-2026-10-31.json).
Original uploads are retained in the workspace attachments, with immutable
copies in `.quality-report/isfahan-timetable-intake-2026-10-31/inputs/`.
Operator images and the fetched HTML are kept in that local review folder, not
redistributed in the repository.

## What is clear

- Directions: `qods_to_defa` = **قدس → دفاع مقدس (صفه)**;
  `defa_to_qods` = **دفاع مقدس (صفه) → قدس**. Both agree with the original image
  headers, including the operator's use of the Soffeh alias.
- All 20 uploaded station IDs have an explicit name-checked crosswalk to the
  existing Isfahan candidate IDs. No cross-city name matching is needed.
- There are 281 trip IDs, two day groups (Saturday–Thursday and Friday), and
  timezone `Asia/Tehran`. The workbook's Trips, Station Index and Calendars
  sheets provide the context that a standalone CSV consumer would otherwise miss.
- The CSV and workbook have identical trip/station keys and all 12 shared fields
  agree. No duplicate trip/station keys, invalid clock fields, reversed trip
  times, mixed metadata or direction/station-order mismatches were found.

| Uploaded day group | Direction | Runs | Station times | First departure | Last departure |
| --- | --- | ---: | ---: | --- | --- |
| Saturday–Thursday | قدس → دفاع مقدس | 89 | 1,780 | 06:00 | 22:00 |
| Saturday–Thursday | دفاع مقدس → قدس | 88 | 1,760 | 06:00 | 22:00 |
| Friday | قدس → دفاع مقدس | 52 | 832 | 09:00 | 21:45 |
| Friday | دفاع مقدس → قدس | 52 | 832 | 09:00 | 21:45 |

These are counts of the uploaded candidate rows, not a certification of every
departure or of passenger boarding at every named station.

## Original source independently retrieved

The workbook points to the operator's
[timetable page](https://metroisfahan.ir/post/9363/زمان-بندی-حرکت-قطارها).
It was accessible during this review. Its page title and displayed update date
say **1405/07/11**. The linked weekday/Friday images were downloaded and their
hashes and HTTP Last-Modified headers recorded. Both Last-Modified dates are
2026-10-03, consistent with that Jalali date.

The original images show separate directions, Saturday–Thursday operating hours
06:00–22:00, Friday operating hours 09:00–22:00, and station times extending to
22:39. Operating-hours banners must not be interpreted as a last-arrival cutoff.

## Corrections and unresolved details

### 1. Friday's 22:00 departures are missing

The final row of the original Friday image explicitly shows **22:00 departures
in both directions**, reaching the opposite terminal at 22:39. Both uploaded
files stop at 21:45, and the workbook's Friday calendar also says 21:45.

At least two trip records and 32 visible station times are therefore missing
from the candidates. The source's four black station columns remain separate
unknowns. The missing rows must be read from the original image; this review
does not invent them by extending a headway formula or silently rewrite uploads.

### 2. Five weekday runs are conditional extras

The original weekday image labels orange rows **اعزام فوق‌العاده**. Its footnote
states: **قطارهای فوق العاده حسب نیاز و در صورت امکان، اعزام خواهند شد**.
These trains are dispatched when needed and possible, rather than guaranteed
scheduled departures:

- قدس → دفاع مقدس: 06:42, 06:53, 07:04.
- دفاع مقدس → قدس: 13:07, 13:19.

The workbook preserves `special_dispatch=True`; the CSV has no corresponding
column. Importing only the CSV would lose this distinction. Retain the workbook
context and keep these conditional runs outside guaranteed next-train results.
The source-row number gaps in the opposite direction align with the one-sided
extra rows; they do not alone prove missing regular weekday trains.

### 3. Four Friday station columns are black

The original Friday image blacks out **بهارستان، گلستان، دانشگاه، کارگر** in
both directions. The uploads omit 416 corresponding cells and retain them in
the workbook's Friday Black Cells sheet with `confirmed_skip_or_closed=False`.

The inspected image and page do not explain whether this means no boarding,
station closure, trains passing without stopping, or another convention. Do not
infer permanent station status, manufacture departure times for these cells, or
shorten running times by removing the physical track between their neighbors.
The earlier user clarification about asterisks in the facility table concerns a
different image and does not establish the meaning of timetable black columns.

### 4. All station times need source-cell review

Every one of the 5,204 rows uses
`terminal_departure_plus_first_run_station_offsets`. All reconstructed trips
span 39 minutes between terminals. These regular offsets are not evidence that
every original image cell was read or that every train has identical running
times. The workbook itself identifies 37 high-priority OCR review trips, and
some OCR agreement values are very low.

All `arrival_time` values also equal `departure_time`. The source is a station
movement timetable, with no separate arrival/departure or dwell columns shown.
Do not infer zero dwell or independently measured arrival times from the copied
column pair. Source-cell checks remain necessary even for rows marked normal
priority by the reconstruction.

### 5. Public-holiday rules remain unknown

The source explicitly groups Saturday–Thursday together and Friday separately.
Metto can retain separate Thursday/day-type identifiers while applying the same
source pattern. It must not invent a different Thursday timetable. Official
holiday overrides are not established by either upload or the inspected page.

## Next work

The remaining questions for a local/operator source are the black Friday-column
meaning and public-holiday timetable rules. Directions, station identities,
timezone and the source update date are already available; there is no need to
ask the user to reconstruct those fields or re-upload the two original images.

Before a timetable preview, read the missing Friday rows and independently audit
the reconstructed cells, retaining conditional extras as conditional. No
canonical timetable, passenger timing capability, existing station boarding
status or production app setting was changed by this review.
