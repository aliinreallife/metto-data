# Metto Data login setup

Project: [icy-dust-01433283](https://console.neon.tech/app/projects/icy-dust-01433283).
Use the existing Neon Auth service; do not create a replacement project.

## Already verified

- The Neon Auth `/ok` and anonymous session endpoints respond successfully.
- Both `https://data.metto.ir` and the stable PR preview origin are trusted.
- Google returns an authorization URL for both origins. Its current credentials
  are Neon's shared development keys.
- GitHub is configured with custom credentials and returns a valid authorization URL.
  Both Google and GitHub redirects reach their actual provider endpoints.
  Requested scopes are basic identity only (Google email/profile/openid; GitHub
  read:user/user:email), with no repository access.
- Verified email is required for public credit. Email-code/password/magic-link
  routes are not exposed through the portal.
  The application name is **Metto Data**. The console still uses a shared email
  sender, which this social-only login flow does not use.
- `NEON_AUTH_COOKIE_SECRET` and `DATA_PORTAL_CREDIT_SECRET` were securely
  provisioned in Vercel for production/preview. They are never browser values.

## 1. Recognizable name

Neon → Auth → Configuration → Project Info → Application Name:
**Metto Data**. This has been set to **Metto Data** and verified through the management API.

Suggested application description:

> Metto is an open-source metro guide for Tehran and Mashhad. It helps riders
> explore stations, view maps and plan routes. Optional sign-in lets users
> receive public credit for contributing corrections and station information.

## 2. Trusted domains

Neon → Auth → Configuration → Domains. Add these exact origins without a
trailing slash (already verified):

- `https://data.metto.ir`
- `https://novus-git-fix-portal-two-step-co-c90ec1-aliinreallifes-projects.vercel.app`

The second is the stable branch preview; use it for login tests. A new
one-off deployment URL is not automatically trusted. Avoid a wildcard covering
other people's Vercel apps.

## 3. Google production credentials

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select or
   create the Metto project.
2. In **Google Auth Platform**, configure **Branding**, **Audience** and
   **Data Access**. Use Metto's name/support contact and the owned `metto.ir`
   domain. Sign-in only needs basic identity/email/profile permissions.
3. Create a **Web application** OAuth client under **Clients**. If the console
   uses the older layout, this is **APIs & Services → Credentials → Create
   credentials → OAuth client ID**.
4. Add the exact authorized redirect URI:
   `https://ep-sparkling-voice-awosad4s.neonauth.c-12.us-east-1.aws.neon.tech/neondb/auth/callback/google`
5. If JavaScript origins are requested, include `https://data.metto.ir` and the
   Neon Auth origin shown in the Neon OAuth setup guide. Do not substitute the
   app homepage for the redirect URI above.
6. In Neon → Auth → Configuration → OAuth providers → Google, configure the
   Metto-owned Client ID and Client Secret. Store the secret there, not in chat
   or browser code.
7. In Google's Audience settings, testing mode limits access to configured test
   users. Set the intended production publishing status and complete any
   verification Google requires before general release.

Shared Google keys can exercise the preview; they do not provide Metto's own
production consent-screen branding.

## 4. GitHub alongside Google

1. Open [Create a GitHub OAuth App](https://github.com/settings/applications/new).
2. Application name: **Metto Data**.
3. Homepage URL: `https://data.metto.ir`.
4. Authorization callback URL:
   `https://ep-sparkling-voice-awosad4s.neonauth.c-12.us-east-1.aws.neon.tech/neondb/auth/callback/github`
5. Register the app, generate its client secret, then open Neon → Auth →
   Configuration → OAuth providers → Add OAuth provider → **GitHub**.
6. Save the GitHub Client ID and Client Secret in Neon. This is separate from
   the short-lived GitHub token used to publish reports; no contributor
   repository-access permission is needed for login.
7. After confirming that Neon returns a GitHub authorization URL, set
   `DATA_PORTAL_GITHUB_LOGIN=1` in Vercel and redeploy the portal. This has now been verified and the flag is set for the next build.
   If the provider is disabled later, unset the flag so an unavailable button
   is not shown. Its UI and failure handling are
   covered by intercepted-request browser tests.

## 5. Complete sign-in checks

Only Google and GitHub are offered. No email sender, OTP or password setup is
needed for this portal. Existing Neon project email settings/accounts are not
deleted; the application refuses the unused login endpoints.

On the stable preview, sign in with your own Google account, sign out, then
sign in with GitHub. Check that returning from the provider shows the signed-in
account and that logging out clears it. Also try cancelling at the provider and
retrying with the other method. Check whether using both providers with the same
verified address links the intended account before relying on public credit.

The app callback is `/auth/callback?lang=fa` (or `en`). This is different from
the provider's registered Neon callback URLs above. The official SDK exchanges
Neon's one-time verifier and browser challenge, sets secure session cookies and
returns to `/account` with the verifier removed. No user-controlled return URL
is used. A callback without a valid exchange returns a friendly retry state.

Automated integration tests exercise that exchange against a local mock auth
service. Live checks reach the actual Google/GitHub authorization endpoints;
completing account consent still needs the owner's account.

## 6. Real public credit and leaderboard

Reporting without an account stays available. A signed-in user must explicitly
choose public credit and type a public alias. Private contact fields and
provider email/name are not automatically published. The server verifies the
Neon session, derives an opaque public contributor ID and signs the attribution.

The contributor's public history includes only their explicitly credited
reports. The main leaderboard counts reports with the maintainer-controlled
`data:accepted` label. The label was created, but no reports were marked accepted
by this work. Closing an issue does not award credit or change transit data.

Maintainers should apply `data:accepted` only after reviewing and accepting the
contribution. Keep `DATA_PORTAL_CREDIT_SECRET` stable: changing it requires a
migration of old signed attributions. It is separate from quota/session secrets.

## Preview report behaviour

Trusted preview hostnames come from Vercel's deployment/branch environment,
not arbitrary request headers. Test reports are stored under a separate preview
namespace and never enter the production publisher's submissions/outbox scan.
The final review step labels preview sends as tests. Real publication still
requires the production origin and maintainer data review.

## Neon API access

For the agent to inspect/change project auth configuration, add `NEON_API_KEY`
through the cloud environment's secret settings, permitted destination
`console.neon.tech`. Never paste it in chat. The management key is now available in the cloud environment and its
access to this project was verified. It is not copied into the passenger app
or the Vercel portal runtime. An API key can manage Neon settings but does not create Google or
GitHub OAuth-app credentials on those providers' behalf.

Sources: [Neon OAuth](https://neon.com/docs/auth/guides/setup-oauth),
[trusted domains](https://neon.com/docs/auth/guides/configure-domains),
[email OTP](https://neon.com/docs/auth/guides/plugins/email-otp),
[email customization](https://neon.com/docs/auth/guides/customize-emails).
