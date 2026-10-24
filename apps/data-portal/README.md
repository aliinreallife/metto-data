# A simple contribution form

A small Persian/English GitHub Pages site for riders who do not have GitHub
accounts. Visitors can send text, a photo, or both. Name and contact details are
optional, and stay in a private Supabase table. The information and photo become
a public issue in `aliinreallife/metto-data`, created by the server's GitHub token.
The form explains this before submission. Reports are unverified source material;
maintainers still review them before changing any transit data.

GitHub Pages serves static files only. A Supabase Edge Function receives the form,
stores it, and creates the issue without exposing credentials to visitors.
No Supabase account or GitHub login is needed by a visitor.

**Status: implementation ready for review; not live until a Supabase project and
GitHub Pages are configured.** The Pages build refuses to publish without its
receiver URL. Metto keeps its existing issue link until the new form is verified.

## One-time setup

1. Create a free project at <https://supabase.com/dashboard/new>. Save the database
   password privately. The public project URL looks like
   `https://PROJECT_REF.supabase.co`; this URL is safe to share.
2. From this repository, authenticate the Supabase CLI and apply the migration:

   ```sh
   npx supabase login
   npx supabase link --project-ref PROJECT_REF
   npx supabase db push
   ```

   Alternatively run
   [`supabase/migrations/202610240001_public_data_intake.sql`](../../supabase/migrations/202610240001_public_data_intake.sql)
   in the project's SQL editor. Use a new/dedicated project so unrelated storage
   policies cannot grant access to contact details or evidence uploads.
3. Create a [fine-grained GitHub token](https://github.com/settings/personal-access-tokens/new)
   restricted to **aliinreallife/metto-data**, with **Issues: read and write**.
   In Supabase → Edge Functions → Secrets, add `GITHUB_TOKEN` with that token.
   Keep the value in Supabase, never in Pages, a GitHub variable, chat, or Git.
   Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` automatically.
   `ALLOWED_ORIGINS` defaults to `https://aliinreallife.github.io,https://metto.ir`;
   set it to the actual form origin if using a custom domain (no path/trailing slash).
4. Deploy the receiver:

   ```sh
   npx supabase functions deploy data-contributions --project-ref PROJECT_REF --no-verify-jwt
   ```

   JWT verification must be **off** for this function because visitors are
   anonymous. Do not disable it for other functions. This is also declared in
   [`supabase/config.toml`](../../supabase/config.toml).
5. In metto-data → Settings → Secrets and variables → Actions → **Variables**, set
   `CONTRIBUTIONS_ENDPOINT` to
   `https://PROJECT_REF.supabase.co/functions/v1/data-contributions`.
   This is a public URL, not a secret. Set Settings → Pages → Source to
   **GitHub Actions**. Once this PR is merged, run **Contribution form (GitHub
   Pages)** in Actions. Expected site: <https://aliinreallife.github.io/metto-data/>.
6. Open the site in a signed-out browser and send a real report. Check that its
   issue appears, its photo opens, and any optional contact appears only in the
   Supabase `data_submissions` table. Then enable the Metto link by setting
   `NEXT_PUBLIC_DATA_CONTRIBUTIONS_URL=https://aliinreallife.github.io/metto-data/`
   in the app's deployment environment and redeploying the app.

Useful entry link:
`https://aliinreallife.github.io/metto-data/?city=mashhad&kind=timetable&lang=fa`.
The page also accepts `city=tehran` and `lang=en`.

## Maintainer operation

- Normal flow: validate → reserve quota → store photo/report → create public issue.
  A reference UUID lets maintainers find the private follow-up contact in Supabase.
- Anonymous/authenticated browser roles have no access to the tables or upload
  API. Only evidence photos are public, as disclosed by the form. Do not paste
  contact columns into GitHub issues. Delete private contacts once follow-up is
  finished; public issue/photo retention is a separate decision.
- Rate limits are 4 per hour and 10 per day per keyed IP digest, plus 100 per day
  globally. No raw IP is saved. Shared networks share limits; the function trusts
  the hosting gateway's forwarding headers, and the global cap bounds requests
  even when an IP changes. CORS and a hidden spam field supplement these limits.
- Matching retries reuse an ID and do not publish a second issue. A lost GitHub
  response is left `publishing` to avoid duplicate issues. Explicit GitHub errors
  leave the saved report `pending`. Both return “received for review” to the rider.
  **There is no automatic retry worker:** check pending/publishing rows regularly:

  ```sql
  select id, created_at, city, kind, station, details, photo_path, status, issue_url
  from public.data_submissions
  where status <> 'published'
  order by created_at;
  ```

  Search GitHub for `"Submission reference: UUID"` before publishing a saved
  report manually. Include only public fields and the evidence URL, then mark
  the row `published` with its `issue_url`. Never include contact fields.
- If storage or database requests fail ambiguously, a photo can be left without
  a report. During maintenance, compare storage object paths with `photo_path`;
  remove unreferenced objects only after confirming no in-flight submission.
- The browser scales photos to 2048 pixels and re-encodes JPEGs (stripping original
  metadata) up to 512 KiB. Input files may be JPG/PNG/WebP up to 8 MiB. The receiver
  bounds JSON size, restricts JPEG uploads, and never embeds contributed Markdown
  as executable markup or mentions in issue bodies.

## Local development

```sh
pnpm portal:check
CONTRIBUTIONS_ENDPOINT=https://PROJECT_REF.supabase.co/functions/v1/data-contributions pnpm portal:build
python3 -m http.server 3006 --directory dist/portal
pnpm typecheck
pnpm test
pnpm validate
```

For a local receiver, use `http://127.0.0.1:54321/functions/v1/data-contributions`
and include `http://localhost:3006` or `http://127.0.0.1:3006` in `ALLOWED_ORIGINS`.
Do not use live credentials in browser mocks. The build copies only `public/` and
writes the public receiver address into `dist/portal/config.js`; migrations and
server code are never part of the Pages artifact.

The richer map-editing/proposal platform described in
[`docs/data-platform.md`](../../docs/data-platform.md) remains future work. This
form opens source reports only; it does not write approval JSON or canonical data.
