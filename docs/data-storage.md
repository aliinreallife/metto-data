# Where Metto data belongs

## Public transit data: GitHub

Keep reviewed station, line, graph, timetable and source snapshots in
`metto-data`. Changes arrive as reports, are reviewed, and become versioned
commits. Metto builds from these files; normal routing does not query Neon.
This preserves open downloads, review history, reproducible builds and offline
routing. Do not maintain another independently editable canonical copy in Neon.
A public GitHub issue is a source report, not verified transit data.

## Accounts and private reports: Neon

Reuse the existing Neon project for optional Auth and durable report/outbox
storage. Optional contact fields stay in the server-only
`metto_data_portal` schema, which revokes public access and enables RLS. The
browser never receives a database URL or Neon management key. No Supabase is
configured and there is no second account system.

The publisher uses GitHub Actions workload identity and its short-lived job
token. Only public report fields and explicitly chosen contributor credit go
into issues. A maintainer still reviews data changes. Do not export private
report rows, contacts or auth tables into the public repository.

## Uploaded photos: small evidence files in Neon for now

- An upload is evidence, not a station asset or a photo-sharing feature.
- The browser accepts one JPG/PNG/WebP up to 8 MiB, resizes it and sends a JPEG.
  The server independently decodes and re-encodes that JPEG, strips EXIF/GPS and
  source metadata, and enforces 2048 pixels / 512 KiB. Original files and their
  filenames are not retained. The shared request quota is reserved before image
  decoding so failed decodes cannot bypass the processing limit.
- Compressed evidence is stored with the private report. It is not committed
  as binary/base64 data to Git history and is not copied into public issues.
- After the visitor explicitly confirms sending, the publisher creates a
  public GitHub report containing an evidence URL. The URL serves only the
  image, and only after the public issue has been confirmed. Pending,
  ambiguous and preview submissions are not public evidence.
- Public reports/photos are unverified source material. Publishing a report
  does not mean its facts have been accepted or added to Metto.
- Preview rows expire seven days after their last write. Expired rows cannot
  be read or listed, and the existing maintenance job removes them in bounded
  batches. Old daily quota counters expire after three days. Production
  reports and evidence do not expire automatically, so source links stay valid.

The preview has a separate namespace, not a separate Neon branch. All writes
still use shared project capacity. The active Postgres store implements the
expiry rules; the unused optional Vercel Blob fallback does not provide them.

## Capacity and recovery

Neon is a database, not object storage. Keeping bounded evidence there is a
small-project tradeoff that avoids introducing another provider now. Base64
alone adds about one third to image size; 100 maximum-sized images need about
67 MiB before database/index/history overhead. The daily request quota is an
abuse limit, not a long-term storage budget.

The live read-only check on 2026-10-25 found about 8 MiB in the whole database
and 184 KiB in the portal table, including indexes/TOAST. This is a baseline,
not a forecast or a check of the billing plan.

The Postgres adapter also stops new photo intake when the portal table plus
the next image would exceed 128 MiB. Text reports remain available and the
visitor keeps their draft. Preview photos share this guard. It is an early
capacity guard, not an exact transactional/concurrent storage quota; it does
not measure other schemas or replace the project usage dashboard.

Check the Neon dashboard's **Storage** and **Usage** at launch and regularly
while collecting reports. The exact plan allowance and billing settings must
be checked there; a free allowance is not unlimited. Use **128 MiB of portal
storage** as the early review point, or 25% of the actual project allowance if
that is lower. At that point move evidence to private object storage before
raising upload limits or promoting photo-heavy use. Keep report metadata and
Auth in Neon and preserve `/api/evidence/<id>` so existing issue links survive.
Vercel Blob is one possible file store on the existing hosting platform; do
not provision or buy storage automatically. Supabase would be a wider
backend migration, not a requirement for image uploads.

Git protects only the public dataset. It is not a backup of reports or photos.
Confirm the Neon plan's restore/history window in the console, and arrange
private encrypted Postgres exports before treating the portal as the sole
long-term evidence archive. Do not put database dumps in GitHub, public Actions
artifacts or browser downloads. No backup schedule or paid storage was created
by this change.

A storage failure returns an error without clearing the form. The app never
claims a report was received until its durable write is confirmed. Matching
retries reuse the report ID and do not create duplicate issues.
