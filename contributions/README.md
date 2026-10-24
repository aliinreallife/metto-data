# Contributing data (no coding needed)

> Send source information or timetable photos through the
> [contribution portal](../apps/data-portal/README.md) once configured, or
> [open an issue](https://github.com/aliinreallife/metto-data/issues/new).
> Source reports are reviewed before becoming structured edits. The file flow
> below remains the way to propose canonical data changes.

## What you can fix

* **Facilities:** elevator, toilets (`wc`), parking, prayer room, Wi-Fi, shops,
  ATM, accessibility info. Toggles are `true` (available), `false`
  (confirmed absent), `null` (unknown).
* **Station info:** wrong coordinates (drag on a map, paste lat/lng), wrong
  Persian/English names, missing facilities, wrong status
  (`operational` / `under_construction` / `planned` / `temporarily_closed`).
* **Topology:** missing connection, wrong transfer walk time. These need a note
  + evidence and take longer to review.

What *not* to submit in these JSON files: timetables, live disruptions, photos as files
(send URLs), anything with personal data, or content copied from sources you
don't have the right to share.

## How to submit (file flow)

1. Copy an example from `contributions/examples/` to
   `contributions/pending/<new-uuid>.json`
   (or run `pnpm contributions:new --city tehran --entity tehran:station:tajrish`
   to generate the template).
2. Fill `operations` — one entry per field, e.g.
   `{ "op": "set", "path": "/amenities/elevator", "value": true }`.
   Allowed paths depend on the entity (see `schema.json`):
   station → `/amenities/*`, `/location/lat|lng`, `/name/fa|en`, `/status`;
   transfer → `/walkSeconds`; connection → `/status`; line → `/color`, `/name/*`.
3. Add `note` / `evidence` (photo URL, survey date). Open a PR.
4. Track review: `pending` → `needs-info` (answer the question) →
   `approved` (lands in the next generated dataset) or `rejected` (reason kept).

## How review works

Maintainers run `pnpm contributions:validate` (schema + “does this station/line
exist?” + “is this path allowed?” — it never changes the dataset), check
evidence and plausibility (a coordinate jumping 5 km needs a strong source),
then move your file to `approved/` or `rejected/` with a `review` block
(`decidedBy`, `decidedAt`, `reason`, `appliedInBuild`). The next `pnpm build`
folds approved proposals into `data/cities/*` and credits you in
`contributors.json` + build `meta.json`.

## Attribution

Accepted changes become part of the ODbL-1.0 normalized dataset with credit to
you (see `../contributors.json` and `../ATTRIBUTION.md`). Rejected proposals
stay in `rejected/` for history but never reach the dataset.

## Safety: approved-proposal rules (October 2026)

Only reviewed **field updates** can be published. Every approved proposal must include `review.decidedBy` and a valid `review.decidedAt` timestamp and live in `approved/`. A pending document accidentally placed there fails the build. Entity creation/removal and `remove` operations are explicitly rejected until implemented; they cannot silently no-op. Conflicting approved changes to the same entity path fail the build. All cities use the same approved-patch merge procedure. No approved change is applied directly to an upstream submodule.
