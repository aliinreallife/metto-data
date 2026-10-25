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
- Login uses the existing Neon Auth project. Google and email codes are the
  main choices; GitHub is another option. The app does not manage passwords or
  generate its own login codes.
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
- Email verification is required and uses codes.
- Session and public-credit signing secrets are stored securely in Vercel.

## What still needs an owner’s real-world check

Google currently uses Neon's shared development keys. GitHub now uses the owner’s
configured OAuth app, and its login start was verified. Email currently uses
Neon's shared sender. They can exercise the preview, but production should use
Metto-owned Google credentials and a dedicated sender.

The owner should test a complete Google login, GitHub login and email-code
login on the preview, including receiving an email in their own inbox. The
agent checks the redirect starts and runs automated UI tests without sending
real emails or pretending to be a user at the consent screen.

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
