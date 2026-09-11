# Topology sources (per city)

Adjacency lists from upstream (`relations[]`) are **not** sufficient: they are
unordered and carry known issues (legacy self-loops, branch forks without
order). Ordered routes, track statuses, transfer walks, and legacy aliases are
curated here and versioned as data (ODbL-1.0).

## Tehran (initial port)

The initial `tehran.*.json` files are a mechanical conversion of the
battle-tested Metto tables — do not re-derive from `relations[]`:

* `lib/metro/routes.ts` (9 routes: line-1-main/parand, 2-main, 3-main,
  4-main/mehrabad, 5-main, 6-main, 7-main; corrections: L1 north
  shahid-sadr→qolhak, L4 west single continuous route, L5 west
  golshahr→shahid-fakhrizadeh→soleimani) → `tehran.routes.json`
* `lib/metro/segments.ts` (163 edges `line-N-a-b` + 6 UC overrides: 2× L4 west,
  4× L6 south tail) → `tehran.segments.json`
* `lib/metro/transfers.ts` (`TRANSFER_RULES`: eram-e-sabz L4↔L5 480s estimated,
  default 240s) → `tehran.transfers.json`
* `lib/metro/aliases.ts` (~167 legacy EN → slug) → `graph.aliases`
  (keys stay English names, values become `tehran:station:*` ids)

Conversion rule: `slug` → `tehran:station:<slug>`, `line-N` → `tehran:line:N`,
`line-N-main` → `tehran:route:line-1-main`, segment ids get the same
`tehran:segment:` prefix. Keep stop/segment order byte-identical to Metto so
`pnpm build` output diffs cleanly against the current app dataset.

Status: **TODO** — files below are pending the mechanical port (tracked as the
first `build.ts` milestone). `importers/tehran.ts` refuses to emit `graph.json`
until they exist, so a half-ported topology can never ship silently.
