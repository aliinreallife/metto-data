# data.metto.ir — platform API contract (future)

Base URL: `https://data.metto.ir`. All payloads conform to
`contributions/schema.json`; ids are `uuid`, entities are namespaced
(`tehran:station:tajrish`).

## Endpoints (planned)

* `GET /api/schema/v1` — dataset JSON Schemas + contribution schema + path
  allowlist per entity type (drives UI form generation).
* `GET /api/cities` — from `sources.json` (+ per-city `meta.json` counts).
* `GET /api/cities/:city/stations?search=` — station search (id + names + line).
* `GET /api/cities/:city/station/:id` — station detail + history.
* `POST /api/contributions` — submit proposal (server validates schema +
  city/entity/path allowlist, stores as `pending`, returns uuid).
* `GET /api/contributions?status=&city=&entityId=` — review queue listing.
* `GET /api/contributions/:id` — proposal + `review` + discussion thread.
* `POST /api/contributions/:id/comments` — discussion (append-only).
* `POST /api/contributions/:id/review` — maintainer only
  (`approve` → move to `approved/` with `review.*`; `reject` with reason;
  `needs-info` with question).
* `POST /api/uploads` — photo upload → returns URL for `evidence`
  (binaries never enter git).

## Mapping to this repo

Each accepted platform submission lands as `contributions/pending/<uuid>.json`
via PR/sync, then follows the normal review → `approved/` → `pnpm build` →
`data/cities/*` flow. The platform is a proposal client, not a dataset writer.
