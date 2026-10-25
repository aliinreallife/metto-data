# Metto Data — simple progress report

The changes are being prepared in the existing preview PRs. They are not merged
into the live site yet.

## What the work does

- Reporting stays open to everyone. You do not need an account.
- The form has three steps: choose what to change, enter the details, then
  check the report and confirm sending. It does not send from step two.
- The supplied wagon-selector reference is combined with Metto's sourced train
  layouts. Tap a drawn car; the platform marker shows your chosen upward-escalator
  position. Counts stay fixed for the selected train type.
- All report topics use the same simpler layout. Optional photo/source controls
  stay beside the report details, with a small photo preview and remove button.
- One report can correct several amenities at one station. Duplicate amenity
  choices are prevented, and each selected amenity has clear observed-state
  buttons. There is also a city/line request form.
- Step three offers anonymous sending, private manual contact, or optional
  Google/GitHub login for contributor credit. Public names need an explicit
  choice; provider emails are never used as public names.
- A temporary draft in this browser tab preserves the text, photo, station,
  direction, wagon, selected amenities and contact fields through login,
  cancellation, Back and reload. It expires after 24 hours and clears after
  successful submission. When draft storage is blocked, login opens in another
  tab and the report remains on the original page. Login never submits a report.
- The upward escalator is the only current exit target. Station/direction-specific
  exit lists can be added later; the exit selector appears when there is a real
  choice and switching exits clears the old car selection.
- Ali Rashidi's reviewed 17 Shahrivar correction appears as a real credited
  historical entry in Persian, linked to the existing canonical override.
  The portal distinguishes Line 7 boarding from Line 6 through-tracks. No
  synthetic popularity, votes, accounts or leaderboard points are created.
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
  Tehran–Karaj, the Mehrabad shuttle and Mashhad Lines 1/2. The city/station sets
  a default count. You can choose a listed train type, but cannot type a count.
  Choose the station and terminal direction before reporting a car. The train's
  head names its destination; changing direction clears the selected car. Flipping
  only changes the picture, preserving the direction and car identity. Tap the
  drawn wagon; keyboard selection works too.
- The whole train fits on mobile. Tehran's seven-car diagram shows sourced full
  and half women-only areas. Mashhad Line 1 shows the operator-confirmed outer
  half of the first and last cars. Other layouts remain unmarked until verified.
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
