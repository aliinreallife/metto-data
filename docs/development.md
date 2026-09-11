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
