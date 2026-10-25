# Metto Data — simple progress report

The changes are being prepared in the existing preview PRs. They are not merged
into the live site yet.

## What the work does

- Reporting stays open to everyone. You do not need an account.
- The form has three steps: choose what to change, enter the details, then
  check the report and confirm sending. It does not send from step two.
- The wagon picker shows the train, its front and rear, and the car you choose.
  You enter the number of cars actually seen; the app does not guess it.
- One report can describe several amenities. There is also a clear choice for
  requesting a city or line.
- Login uses the existing Neon Auth project. Google and GitHub are the
  only choices, both visible on the login page. No email codes or passwords.
  The callback exchanges the provider verifier through the official SDK before
  returning to the account page.
- Account settings show connected Google/GitHub methods and let you connect the
  other provider. The only remaining supported login method cannot be removed.
- You can edit your name, optional age/gender, bio and social links. Age and gender
  stay private. Publishing a profile requires a separate public alias and an
  explicit switch. Public profile data excludes private name/age/gender.
- Social links accept a handle or direct profile URL for Instagram, Telegram, X,
  GitHub and Spotify, plus a website. Links to posts/invites are rejected.
- Train reporting has separate reference layouts for Tehran urban trains,
  Tehran–Karaj, the Mehrabad shuttle and Mashhad Lines 1/2. Counts stay editable.
  The train can be flipped while the selected car number stays the same.
- Tehran's seven-car diagram shows the sourced full and half women-only areas.
  Boundaries for other layouts remain unconfirmed and are not invented.
- Your name appears publicly only if you choose public credit and enter a
  public name. Private contact details and provider emails are not copied there.
- Contributor pages show real credited reports. The leaderboard counts reports
  a maintainer has explicitly accepted. A sent or closed report alone earns no
  credit. An empty leaderboard is more honest than made-up names and scores.
- Preview submissions are clearly labelled as tests and are kept out of the
  real public-report publisher.
- Mashhad's future lines use simple links between mapped future stops, matching
  Tehran's display style. They are not walking/driving routes and cannot be
  used to plan a passenger journey.
- Mashhad's landing card shows useful route information instead of an empty gap
  or a missing-timetable message. The timetable-help link stays on the route page.

## What is already checked in Neon

- Both the live and preview domains are trusted.
- Google and GitHub return valid sign-in starts and redirect to their provider.
- GitHub uses the credentials added by the owner. It asks for identity/email
  access, not access to users' repositories.
- The application name is **Metto Data**.
- Verified emails are required for public credit; email-code login is not offered.
- Session and public-credit signing secrets are stored securely in Vercel.

## Real login checks

Google currently uses Neon's shared development keys. GitHub now uses the owner’s
configured OAuth app, and its login start was verified. The portal does not use email-code login or require an email sender.
Production Google branding should use Metto-owned credentials.

The owner confirmed that complete Google and GitHub login both work. A read-only
aggregate check also found a Neon identity with both providers connected; no
emails, tokens or individual identity details were returned. The new management
screen makes connected providers visible. Provider connection/removal UI is
covered by intercepted browser tests; the provider continues to own the actual
linking and verified-email rules.

Exact setup instructions: [portal-setup-steps.md](portal-setup-steps.md).

## What we are leaving out for now

SMS codes, social voting, a large profile/social system, and the old donation
link are not part of this release. They add cost or complexity before the core
reporting flow is ready. Votes will not automatically change metro data.

The old leaderboard and profile statistics were examples in a prototype. We
are replacing those examples with real, opt-in contributions rather than
bringing the invented numbers back.

## Which platforms are involved?

Vercel hosts the apps, Neon stores private reports and handles optional login,
GitHub stores the open data/reviews, and Upstash supports passenger-app caching
and request limits. Neither app currently uses Supabase or Cloudflare. Keep
this setup for now; if switching to Supabase, use its database/auth/storage
together rather than keeping two account systems.

More detail: [metto-services-simple.md](metto-services-simple.md).

## Data and photos

Keep verified metro data in GitHub. Use Neon for accounts, private contact
fields and reports. Uploaded evidence is compressed and stripped of metadata
on the server. Its image link becomes public with the public report; it does
not become a file in Git history. Preview uploads expire after seven days.
There is no Supabase dependency or new storage service. See
[data-storage.md](data-storage.md) for capacity and backup follow-up.

The train evidence and its limits are documented in
[train-layout-research.md](train-layout-research.md).
