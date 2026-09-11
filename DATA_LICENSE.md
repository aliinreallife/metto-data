# Data license

## Normalized data: ODbL-1.0

The normalized transit database in this repository — everything under
`data/cities/`, `overrides/`, and `topology/`, plus community-approved changes
from `contributions/approved/` as applied — is made available under the Open
Database License (ODbL) v1.0.

* ODbL 1.0: <https://opendatacommons.org/licenses/odbl/1-0/>
* Local copy of the license text: `LICENSES/ODbL-1.0.txt`

It is derived from the Tehran Metro Data project by mostafa-kheibary
(<https://github.com/mostafa-kheibary/tehran-metro-data>, ODbL-1.0, kept as the
untouched submodule `upstream-tehran-metro/`). The submodule itself is covered
by its own upstream license; Metto modifications never touch it — all
transformations (importer, overrides, topology curation, approved community
proposals) happen outside the submodule and the result is the ODbL adapted
database published here.

Strict JSON files cannot carry license comments; this document together with
`ATTRIBUTION.md` is the license marker for `data/cities/*`.

## Code: AGPL-3.0-only

Importer, validator, and script code (`importers/`, `validators/`, `scripts/`,
`schema/v1/*.ts`) is original Metto software under GNU AGPL-3.0-only —
see `LICENSE`. The AGPL on tooling does not relicense the data outputs.

## Upstream license note

The upstream repository's LICENSE/README identify the database as ODbL-1.0,
while its `package.json` says `ISC`. metto-data does not attempt to resolve
that inconsistency by relicensing. Conservative rule: treat everything copied
from or substantially derived from that metro database as `ODbL-1.0`.

## Your obligations (summary, not legal advice)

If you publicly use this adapted database or a derivative of it, the ODbL
requires attribution, Share-Alike for derivative databases, and that the
derivative database (or the alterations) be offered in machine-readable form
(see ODbL §§ 4.2–4.6). This repository satisfies the machine-readable offer by
publishing `data/cities/*` (derivative), `overrides/*` (alterations), and the
importer source. Read the full license text in `LICENSES/ODbL-1.0.txt`.
