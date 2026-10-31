# Isfahan facility table supplied on 2026-10-31

The user supplied a Persian image listing seven facility columns for the same
20 Isfahan Line 1 stations already in the candidate identity map. A manual
transcription is saved in
[`facilities-table-2026-10-31.json`](../sources/isfahan/facilities-table-2026-10-31.json).
It preserves all 140 cells, the station names as shown, namespaced candidate IDs
and the two location notes. This is a source-review record, not generated data.

The original URL, publisher, publication/revision date and license are unknown.
The receipt date above is **not** the table's publication date. No legend is
visible. The original image is not stored in this repository, so an image hash
is not asserted. Its source has not been independently authenticated.

## What the image reports

| Column | Positive checkmarks | Literal asterisks, meaning unresolved |
| --- | ---: | ---: |
| پله برقی — escalator | 20 | 0 |
| آسانسور — elevator | 20 | 0 |
| دسترسی ویلچر — wheelchair access | 19 | 1 |
| ایستگاه دوچرخه — bicycle station | 14 | 6 |
| آبسردکن — drinking water | 7 | 13 |
| دستگاه فروش قهوه — coffee vending machine | 11 | 9 |
| مترو مارکت — Metro Market | 2 | 18 |

These counts describe symbols in this image, not facilities independently
verified as available or working today. An asterisk stays uninterpreted; it is
not converted into a confirmed `false` value.

The two Metro Market checkmarks are at شهید مفتح and کوی امام. The lone
wheelchair-access asterisk is at سی و سه پل.

## Preserve the qualifications

- شهید علیخانی: the elevator cell says **سمت شرقی** (east side).
- سی و سه پل: the elevator cell says **سالن بلیط** (ticket hall), while the
  wheelchair-access cell is an asterisk. Do not turn that elevator claim into
  an assertion of continuous street-to-platform step-free access.
- An escalator is a separate facility from an elevator. A bicycle station is
  not automatically the canonical parking facility, a coffee vending machine
  is not a coffee shop, and Metro Market is not silently reclassified as a
  grocery store. Preserve the source categories until their meanings are clear.

## Relationship to the candidate

All 20 rows were manually matched within Isfahan to the existing physical
candidate IDs. Explicit name differences include امام حسین(ع), the spacing in
سی و سه پل, and شریعتی without the doctor title. These links do not merge stations
with the same name in other cities or the inactive southern Baharestan lead.

دانشگاه and کارگر both appear in the table. That is useful supporting evidence
for their facility inventory, but an undated facility list does not settle their
current passenger-boarding status. The source-review questions remain open.

The candidate builder and its pinned geometry are unchanged. Canonical amenities
remain null, the original candidate output remains byte-for-byte unchanged, and
all boarding/accessibility/publication verification flags remain false. This
table is not imported into passenger amenities or accessibility routing.

Next evidence needed: the original page/PDF and date, the asterisk legend, and
the extent and current availability of the two qualified elevator entries.
