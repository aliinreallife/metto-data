# Attribution

## Upstream sources

Metto's normalized data is derived from third-party transit datasets kept as
untouched git submodules under `upstream-*/`. They are source material only.

### Tehran Metro Data

* Project: Tehran Metro Data by mostafa-kheibary
* Repository: <https://github.com/mostafa-kheibary/tehran-metro-data>
* Submodule path: `upstream-tehran-metro` (upstream file: `data/stations.json`)
* Pinned commit: `bcf474e17f29a53684bd02229e73bcaa06c4f37d` (see `sources.json`)
* License: Open Database License (ODbL) v1.0 —
  <https://opendatacommons.org/licenses/odbl/1-0/> —
  local copy: `LICENSES/ODbL-1.0.txt`

Upstream license note: the upstream repository's `LICENSE.md`/README identify
the database as ODbL-1.0 while its `package.json` says `ISC` (almost certainly
an npm-init leftover). As a conservative approach, metto-data treats all data
copied from or substantially derived from that database as **ODbL-1.0** and
does not propagate `ISC` to data.

## What this means (summary, not legal advice)

Per ODbL §§ 4.2–4.6, if you publicly use the normalized database
(`data/cities/*`) or a derivative of it you must:

1. Attribute: "Contains information from Tehran Metro Data
   (https://github.com/mostafa-kheibary/tehran-metro-data), available under
   the Open Database License (ODbL)."
2. Share-Alike derivative databases under ODbL (or a compatible license).
3. Offer the derivative database (or the alteration file) in machine-readable
   form — metto-data satisfies this by publishing `data/cities/*` plus
   `overrides/*` and the importer source.

Read the full license text in `LICENSES/ODbL-1.0.txt` and `DATA_LICENSE.md`.

## Community contributors

Approved community proposals (`contributions/approved/`) become part of the
normalized dataset. Contributors are credited in:

* `contributors.json` (id → name, profile URL, contribution uuids, entities,
  first/last timestamps), updated automatically on approval;
* `data/cities/<city>/meta.json` (`contributorIds` for that build).

Contributor submissions are proposals under the same ODbL-1.0 data license once
merged — by submitting, contributors agree their accepted changes are published
as part of the ODbL normalized dataset with attribution as above.

## How to cite metto-data

```text
Metto transit data (https://github.com/<org>/metto-data), derived from
Tehran Metro Data by mostafa-kheibary (ODbL-1.0), plus community contributions
listed in contributors.json. Data build: see data/cities/tehran/meta.json.
```
