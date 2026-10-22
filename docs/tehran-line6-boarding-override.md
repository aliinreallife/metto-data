# Tehran Line 6 boarding exception at Shohada-ye Hefdah-e Shahrivar

**Source of truth for this ONE route stop:** `metto/lib/metro/routes.ts`,
as explicitly selected by the Metto maintainers on 2026-10-22.

The public upstream station file uses `disabled: true` as one **station-wide**
flag, so it cannot accurately express distinct passenger-boarding permissions
per metro line. `metto-data` preserves Metto's route-specific semantics using
`overrides/tehran.overrides.json > routeStopStatusOverrides`.

| Separate fact | Imported result |
| --- | --- |
| Physical station | operational |
| Route `tehran:route:line-6-main` boarding stop | under_construction |
| Route `tehran:route:line-7-main` boarding stop | operational |
| Line 6 traversable segments through station | operational |

The importer applies this single override after approved contribution folding,
checks that the referenced route and stop exist, and fails closed if the
original stop status becomes incompatible. No blanket status override for
the station or Line 7 is permitted. Changes to other stations continue to
follow the upstream and verified contribution process.

## Public-data caution

This is a **Metto app compatibility decision**, not a live-service feed or an
independent guarantee of boarding access today. Public reporting from 2026
describes temporary station closures and new construction progress.
Before changing these route facts, review operational bulletins and update
the corresponding tests. Related public sources:
- https://www.tasnimnews.ir/fa/news/1405/02/07/3576761/
- https://www.tasnimnews.ir/fa/news/1405/07/05/3707541/

The upstream-data improvement should model boarding/access per line instead
of deriving per-line availability from a single global `disabled` flag.
