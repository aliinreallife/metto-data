# What services Metto uses

Verified against both repositories, their Vercel environment configuration, the
Neon management API and public DNS on 2026-10-25.

| Service | Current responsibility |
| --- | --- |
| Vercel | Hosts the passenger app and the data portal, runs their API functions, builds previews, and manages `metto.ir` DNS |
| Neon Postgres | Private report/outbox storage, including uploaded report photos, for the data portal |
| Neon Auth | The optional Google/GitHub/email-code login being added to the portal |
| GitHub | Open transit datasets, review issues, source history and scheduled automation |
| Upstash Redis | Passenger app holiday cache and shared walking-provider quota limits |
| Supabase | Not configured or used in either inspected app |
| Cloudflare | Not configured in these apps; the domain currently uses `ns1.vercel-dns.com` / `ns2.vercel-dns.com` |

Map/search/walking providers are separate specialist data services. They do not
replace the backend database or account service. The passenger app's normal
metro routing reads committed transit files and can work offline; it does not
query Neon for every route. The Neon connection belongs to the contribution
portal. Vercel Blob is an optional storage fallback in the code, not the active
storage path while Neon/Postgres is configured.

## Recommendation

Keep the current services for now. Do not add Supabase or Cloudflare just to
collect more free plans. One hosting platform and one application backend are
enough for the current work; GitHub remains the open-data/review system. Keep
the existing Redis cache/quota service while it serves a concrete purpose.

Neon is not mandatory. It was chosen because its database and auth connection
already existed. Starting from scratch, Supabase would also be a reasonable
backend because it combines Postgres, auth and file storage. If choosing
Supabase, use those features together and migrate the corresponding Neon roles;
do not maintain two account systems or two copies of report data without a
specific reason.

Free plans may cover the early workload, but this review does not establish
current paid/free billing status or promise that quotas will never be reached.
Watch database/photo storage, email delivery and function/API usage. Photos
currently share the Neon database with reports: a large number of images can
fill a small database allowance much faster than text. That is the first
storage decision to revisit if use grows. A free tier is useful when it covers
the actual workload; adding another provider also adds setup and maintenance.

No hosting, DNS or database migration was performed as part of this review.

The storage responsibilities and upload lifecycle are documented in
[data-storage.md](data-storage.md). The preview now adds server-side image
metadata removal, private queued evidence, seven-day expiry for preview
uploads and expiry of old quota records. Published evidence remains in Neon;
photos are not added to Git history. Revisit object storage at the documented
capacity threshold rather than waiting for the database to fill.
