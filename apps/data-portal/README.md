# Metto Data — one repository for data and the contribution UI

The existing `metto-data-prev` design now lives here as a Next.js application.
The canonical data, importers, review rules and GitHub Actions stay at the
repository root. Vercel hosts this UI and its server functions. GitHub Pages and
Supabase are not required for this approach.

The portal reads committed `data/cities/*` files directly. It shows **151 Tehran
stations and 36 Mashhad stations on Lines 1/2**, using city-qualified IDs.
Mashhad remains a candidate; Line 3 is withheld and no timetable is invented.
Tehran's network files match the cleaned Metto baseline. Amenities are retained
as recorded information that needs review. Demo stations, votes, profiles and
contribution totals from the prototype are replaced by real catalog and issue data.

## Run locally

From the repository root, with Node 22 and the pinned pnpm:

```sh
pnpm install --frozen-lockfile
pnpm --filter @metto/data-portal dev --port 3007
pnpm portal:build
pnpm portal:typecheck
pnpm test
```

The UI works without secrets. Direct submission remains disabled with a working
GitHub issue link until private storage and issue creation are configured.
Copy `.env.example` to `.env.local` inside this app for local intake testing;
use `DATA_PORTAL_ORIGIN=http://localhost:3007` and open that same address.

Pages: `/`, `/stations`, `/map`, `/contribute`, `/reports`. Examples:
`/stations?city=mashhad&lang=fa` and
`/contribute?city=mashhad&kind=timetable&lang=fa`.

## Move the existing Vercel project

The implementation is ready for review; **the Vercel project has not been
reconnected and real intake has not been deployed from this environment**.

1. In the existing portal's Vercel project, change its Git repository from
   `aliinreallife/metto-data-prev` to `aliinreallife/metto-data` (or import the
   combined repository into a new Vercel project for a preview first).
   Set **Root Directory: `apps/data-portal`**, Framework: **Next.js**.
   Allow workspace files outside the root directory. The checked-in
   `vercel.json` uses `pnpm install --frozen-lockfile` and `pnpm build` from
   the app directory. Production branch remains `main`.
2. In Vercel → Storage, create/connect a **private Vercel Blob store**. This
   supplies `BLOB_READ_WRITE_TOKEN`. Do not use a public store: reports include
   optional contact fields. No new database account is needed.
3. Create a fine-grained GitHub token restricted to `aliinreallife/metto-data`
   with **Issues: read and write**. Store it as server-side `GITHUB_TOKEN` in
   Vercel. Set `DATA_PORTAL_ORIGIN` to the public HTTPS origin visitors will use,
   such as `https://data.metto.ir`. Redirect other aliases to that domain.
   No keys belong in any `NEXT_PUBLIC_*` variable.
4. Generate a random maintenance secret privately, for example with
   `openssl rand -hex 32`. Add it as `DATA_PORTAL_AUTOMATION_SECRET` in both
   Vercel and this repository's **Actions secrets**. Set the repository Actions
   **variable** `DATA_PORTAL_ORIGIN` to the same public origin. The daily
   **Retry saved portal reports** action can also be run manually.
5. Redeploy. In a signed-out browser, send a real station report with a photo
   and optional contact. Confirm that its public GitHub issue contains the
   information/photo, that the image URL works, and that contact fields appear
   only in the private Blob record. Check both FA and EN.
6. In the Metto app's Vercel project, set
   `NEXT_PUBLIC_DATA_CONTRIBUTIONS_URL=https://data.metto.ir/contribute`
   (using your actual domain) and redeploy. Its inline timetable link will
   preselect Mashhad, timetable and language.

Keep the old repository/project available until this check passes. No archive,
repository deletion, production source switch or dataset approval is performed
by this code. Import provenance is recorded in
[`docs/portal-migration.json`](../../docs/portal-migration.json).

If you continue using v0, also confirm its project is connected to the combined
repository and that UI edits stay under `apps/data-portal/`.

## How submission works

`Visitor → Vercel function → private Blob report → public GitHub issue`

- No visitor account or login. Text, one photo, or both. Optional name/contact
  stays in the private report; public issue fields are explicitly selected.
  The form explains that information/photos are public before submission.
- The browser resizes photos to 2048 pixels and re-encodes JPEGs up to 512 KiB,
  removing original metadata. It accepts JPG/PNG/WebP inputs up to 8 MiB.
  `/api/evidence/<uuid>` returns only JPEG bytes, never report JSON or contact.
- UUIDs and payload hashes deduplicate matching retries. Atomic Blob ETag
  comparisons prevent concurrent issue publication or quota overruns. Limits:
  4 reports/hour and 10/day per keyed IP digest, 100/day globally. Raw IPs are
  not stored. Shared networks share limits. The global cap still applies if an
  IP changes or forwarding headers cannot identify it reliably.
- A private outbox survives temporary GitHub errors. Explicit client/rate-limit
  errors can be retried by Actions. Ambiguous network/5xx responses stay
  `publishing`; maintenance searches GitHub for the submission reference and
  marks an existing issue published, **never blindly posting another issue**.
  Missing matches are reported as `needsReview` for a maintainer.
- The maintenance endpoint needs the server secret. Actions receives only
  counts, never names, contacts, photos or report text. It processes up to
  100 queued items per run. A long-standing backlog can be processed by another
  manual run; resolve `needsReview` entries rather than leaving them indefinitely.
- Maintain private storage: remove dangling outbox markers only after confirming
  no in-flight report, remove old quota objects, and clear optional contacts
  after follow-up is finished. Deleting public evidence is a separate decision
  because issue references rely on it. No report data is written to Git directly.
- Source reports do not change canonical data. Maintainers still prepare and
  review a contribution PR; normal schema, provenance, rebuild and city-release
  checks apply. An issue being closed is not treated as dataset approval.

The existing full validation workflow now builds/typechecks the portal alongside
all dataset checks. The existing upstream watcher still opens review requests,
without automatically changing pinned sources. This portal replaces the separate
Pages/Supabase proposal in draft PR #11.
