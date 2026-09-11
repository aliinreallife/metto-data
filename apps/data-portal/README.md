# data.metto.ir — contribution platform (placeholder)

Future web app for non-developer contributions. Not implemented in this repo yet;
this directory reserves the integration point so links and contracts exist first.

Planned capabilities:

* station search + map-based editing (drag pin → `/location/*` ops)
* facility toggles (elevator, toilets, parking, prayer room, Wi-Fi, shops,
  accessibility) → `/amenities/*` ops
* photo uploads (hosted externally; proposals carry `evidence` URLs only)
* discussion/comments + change history per proposal
* maintainer approval workflow (`pending` → `needs-info` → `approved`/`rejected`)
* issuance of `contributions/pending/<uuid>.json`-compatible payloads

Contract: [`docs/data-platform.md`](../../docs/data-platform.md).
Platform writes proposals only — it never commits to `data/cities/*` or
`upstream-*/` directly. Approval + rebuild always happen in this repo.
