# Metto Data — data and the contribution UI together

The existing `metto-data-prev` design lives here as a Next.js application.
Canonical data, importers, review rules and GitHub Actions stay at the root.
Vercel hosts this UI/API. The existing portal project (`novus`) already has a
Neon/Postgres connection, which is reused for private report storage.

The portal reads committed `data/cities/*` files: **151 Tehran stations and 36
Mashhad stations on Lines 1/2**, with city-qualified IDs. Tehran matches the
cleaned Metto baseline. Mashhad remains a candidate, Line 3 stays withheld, and
no train times or certified amenities are invented. Prototype records and
simulated social activity are replaced with real catalog and issue data.

## Run locally

From the repository root, with Node 22 and the pinned pnpm:

```sh
pnpm install --frozen-lockfile
pnpm --filter @metto/data-portal dev --port 3007
pnpm portal:build
pnpm portal:typecheck
pnpm test
```

Without secrets, browsing works and the form offers a GitHub fallback. For local
intake, copy `.env.example` to `.env.local`, use a development database, set a
random quota key and `DATA_PORTAL_ORIGIN=http://localhost:3007`. Use that same
host in the browser. Pages: `/`, `/stations`, `/map`, `/contribute`, `/reports`.

## Hosting configuration

The portal is live at **https://data.metto.ir**, on the existing Vercel project
`novus`. The previous `novus-peach-seven.vercel.app` address redirects there.
Root Directory is `apps/data-portal`,
Framework Next.js, Node 22, with workspace files outside the root enabled.
The connected Git repository is `aliinreallife/metto-data`, branch `main`.
The old repository remains available as migration history. If continuing to use
v0, confirm it edits the combined repository under `apps/data-portal/`.

Server environment:

- `DATABASE_URL` (or `POSTGRES_URL`): the existing Neon integration; no database
  password is copied into this repository or exposed in the browser.
- `DATA_PORTAL_ORIGIN`: the actual public HTTPS origin, with no path.
- `DATA_PORTAL_QUOTA_SECRET`: a private random key provisioned through Vercel.
- Optional: `BLOB_READ_WRITE_TOKEN` for a **private** Blob store when not using
  Postgres. A public store is unsuitable for reports containing contact fields.
- Optional: a dedicated `GITHUB_TOKEN` for immediate publication. Normal
  production setup does **not** need a personal GitHub token.

The private store creates only `metto_data_portal.objects`, inside its own
schema, under a serialized idempotent migration. It does not alter existing
application/auth tables. Browser roles have no schema access and the table has
RLS enabled without public policies. The service's owning database role is the
only writer. The same atomic version checks used by the Blob adapter are
implemented as conditional SQL updates.

## Anonymous report publication

`Visitor → private report/outbox → GitHub Actions → public issue`

Visitors need no account. Reports are acknowledged as received once durable
storage succeeds. Information/photos become public; optional name/contact
remains private. The form explains this before sending. A report does not
change a canonical dataset automatically.

The **Publish saved portal reports** action runs every 15 minutes and supports
manual dispatch. It authenticates to Vercel using a short-lived GitHub OIDC
identity. The API verifies issuer, audience, expiry, repository/owner IDs,
`refs/heads/main`, the exact workflow path, and schedule/manual event type.
Forks, PR workflows and other workflows are rejected.

The action supplies its repository-scoped, short-lived `GITHUB_TOKEN` to the
trusted publishing function for that invocation only. It is never saved in
report storage or server environment variables. This avoids another permanent
API key. The workflow needs only `contents: read`, `issues: write`, and
`id-token: write`. No Actions secret is required. Its public origin is configured
in `.github/workflows/portal-maintenance.yml`; keep it aligned with Vercel's
`DATA_PORTAL_ORIGIN` when changing domains, including the OIDC audience.

Matching retries reuse IDs. Atomic updates prevent double publication and quota
overruns. Explicit GitHub client/rate errors can be retried. Ambiguous network
or 5xx responses remain `publishing`; maintenance searches by submission reference
and never blindly creates another issue. Unmatched results require maintainer
review. Logs and maintenance responses contain counts only, never reports,
contacts, photos or credentials.

Quotas: 4 reports/hour and 10/day per keyed IP digest, plus 100/day globally.
Raw IPs are not stored. Shared networks share quotas; the global cap applies
even if the forwarding address changes. The browser converts JPG/PNG/WebP inputs
up to 8 MiB into metadata-free JPEGs up to 2048 pixels / 512 KiB. Public
`/api/evidence/<uuid>` returns JPEG bytes only, never the report JSON/contact.

## Verify delivery after deployment

1. In a signed-out browser, send a timetable/station report with a photo and
   optional contact. Confirm the receipt appears and an image endpoint works.
2. Dispatch **Publish saved portal reports**; confirm its issue contains only
   public fields and the photo. Check FA/EN, shared station names and city filters.
3. Set Metto's `NEXT_PUBLIC_DATA_CONTRIBUTIONS_URL` to
   `https://data.metto.ir/contribute` and redeploy the relevant app
   environment. Its inline link passes city, timetable type and language.

Maintain the private store: clear contact fields after follow-up, remove old
quota objects and investigate `needsReview` entries. Public evidence retention
is separate because issue links depend on it. Approval still uses reviewed
contribution PRs, rebuild/provenance checks and independent city release gates.

Migration provenance: [`docs/portal-migration.json`](../../docs/portal-migration.json).
The combined portal replaces the earlier Pages/Supabase draft #11.
