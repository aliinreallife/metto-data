# Importers

Each importer reads **only** from its upstream path (never writes there) and
emits schema/v1 JSON. Pattern (see `tehran.ts`):

```text
upstream-<city>/<upstreamFile>  →  coerce + slug + amenity map  →  apply overrides/
→  fold contributions/approved/  →  join topology/  →  data/cities/<city>/
```

Shared helpers live in `lib/`: `slug.ts` (kebab slug, frozen once assigned),
`coords.ts` (`string | number` → `number` + Iran bounds check). Upstream quirks
are quarantined with warnings, never silently dropped (e.g. Tehran `fastFoodn`
typo, `waterCooler: null`, `lines[]`/`colors[]` length mismatch aborts the
build).
