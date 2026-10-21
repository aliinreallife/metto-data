# Development

## Prerequisites

Node 22 (`nvm use`), pnpm 12, git with submodule support, and (optional but
recommended) [pre-commit](https://pre-commit.com/).

```bash
git clone --recurse-submodules <metto-data-remote-url>
cd metto-data
pnpm install
pre-commit install   # enables the local commit hooks (one-time per clone)
```

## Run manually

```bash
pre-commit run --all-files   # same checks the commit hook runs
pnpm typecheck                # TypeScript must pass
pnpm build --city tehran      # regenerate the dataset
pnpm validate                 # dataset + pending-proposal checks
pnpm contributions:validate   # pending/approved/rejected proposal checks
pnpm test                     # unit tests
pnpm check-release            # full release readiness
```

## What runs where

- **pre-commit catches local mistakes:** `typecheck`, `contributions:validate`,
  and `validate` run on every commit. They are read-only (except `validate`
  reads the built output) and need no network. `pnpm build` is intentionally
  excluded — it rewrites `data/cities/*` and is slow/noisy for a commit hook.
- **CI performs full release validation:** `.github/workflows/validate.yml`
  runs `typecheck` → `build` → `validate` from a clean checkout with
  submodules, so a green commit is still fully rebuilt and re-validated there.
  Release gates (`test`, `check-release`, submodule pin checks) run before
  tagging — see `docs/release-checklist.md`.

## Fresh-clone checklist

After cloning, `pnpm install` then `pre-commit run --all-files` must pass
with no extra setup. The hooks are `repo: local`, so pre-commit downloads
nothing; the checked-in `.pre-commit-config.yaml` is the whole configuration.

## Quality gates and data safety

CI runs `pnpm provenance:check` against the checked-out submodule Git links, pinned
revision, expected station count and license location. The full build then runs
`pnpm generated:check`: committed generated JSON must match regenerated output
(excluding **only** `meta.generatedAt`). This prevents accidental edits to
the public JSON or forgotten regeneration.

`pnpm check-release` remains a stricter publishing gate: it **rejects** all
cities with `releaseStatus: candidate`. Candidate builds are allowed in pull
request CI, but they are not permission to release production routing data.

## Automated integrity and quality checks

`CI` checks all pinned upstream submodules, licensing metadata, TypeScript and
committed datasets. `Validate` regenerates every city, rejects any committed
JSON changes except `meta.generatedAt`, executes regression tests, and uploads
a 30-day quality audit (including an isolated, **unverified** source-facility
candidate dataset). Both workflows have read-only repository permissions,
timeouts and PR concurrency cancellation.

`pnpm check-release` remains deliberately stricter than PR validation:
cities marked `candidate` cannot pass the production release gate.

## Scheduled source monitoring

`.github/workflows/upstream-watch.yml` runs every Monday (and supports manual
dispatch on the default branch). A read-only `git ls-remote` comparison detects
whether the pinned Git SHA differs from the current upstream HEAD, then opens
an issue only once for that *specific* revision. Closing an issue does not
cause it to reopen next week, and new revisions get a new review issue.
No fetched source content is executed, no submodules are auto-updated, and
PRs never receive the issue-writing token. If the network fails, the workflow
fails rather than claiming that the source is current.

## Secure workflow dependencies

Every third-party `uses:` reference is pinned to a 40-character commit SHA.
The refs were resolved from the original action repositories and are checked by
`pnpm workflows:check`. Dependabot proposes updates to actions and npm
dependencies weekly; **no dependency updates are merged automatically**.
Do not use privileged pull-request trigger events for source-monitoring code.
