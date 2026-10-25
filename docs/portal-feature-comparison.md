# Metto Data: feature comparison and implementation scope

Status: implementation authorized and being prepared in draft PRs #23 (portal)
and #231 (passenger map); neither is merged. Read
[the simple progress report](portal-progress-simple.md) for the short version
and [the exact setup steps](portal-setup-steps.md) for account configuration.

## What we already have

- The Vercel project `novus` has `NEON_AUTH_BASE_URL` configured. The existing service was checked through the Neon management API. Google,
  GitHub and email-code configuration are present; both OAuth starts reach the
  provider. The new login screen is in the unmerged portal change.
- Neon/Postgres already stores anonymous reports. Reports are published as
  GitHub issues for review; publication does not automatically change the data.
- Optional contact fields are private. They are not public contributor profiles.
- The initial PR #23 preview had a two-step contribution flow, station search,
  improved dropdowns and wagon reporting. The updated PR adds the requested third confirmation step, revised wagon
  illustration, optional login, opt-in public credit and accepted-contribution
  leaderboard/profile pages.
- Production intake works on the configured production domain. The initial
  preview displayed an unavailable-submission message because its hostname does
  not match that domain. The updated PR replaces this with explicitly labelled test reports in an
  isolated preview namespace. Production publishing is separate.

## Neon Auth and sign-in methods are different choices

Keep Neon Auth as the account/session service. Google, GitHub and OTP are ways
to sign in **through that same service**. We do not need a second authentication
system just to offer those methods.

| Method | Best fit for Metto | Tradeoff | What it needs | Recommendation |
| --- | --- | --- | --- | --- |
| Google | Everyday riders who already have a Google account | External sign-in/consent screen; access should be checked on actual users’ devices | Own Google OAuth client ID/secret for production, Neon callback URI, app branding and trusted app domain | Primary option |
| Email OTP | People who prefer a code without a social account or password | They must open email; delivery delays/spam can interrupt the flow | Enable email sign-in/OTP, configure a dedicated production email provider and sender, test expiry/resend/attempt limits | Primary fallback |
| GitHub | Developers and open-data contributors | Many everyday riders do not have GitHub | GitHub OAuth app ID/secret and Neon callback; request only identity access, not repository permissions | Optional secondary option, under “More ways to log in” if needed |
| SMS OTP | Riders who prefer using a phone number | Message cost, delivery/support work, number collection and abuse controls | An SMS gateway that serves the intended users and a supported phone-auth integration; none has been verified as configured here | Defer unless users specifically prefer phone login |
| Email/password | Existing password-account users, if any | Password creation, resets and support add steps | Email delivery and recovery UX | Do not make it the main new-user flow; preserve recovery if existing users rely on it |

**OTP here means an email code. SMS OTP remains deferred.** Neon’s docs
and SDK support email OTP. SDK support alone does not prove it is enabled on
this project.

Neon documents shared Google credentials for development/testing. Those show
Neon’s branding. Production should use Metto-owned credentials. GitHub needs
custom credentials. Neon’s shared email sender is for development; a dedicated
production email provider is recommended.

## Proposed product decisions

| Feature | What we want | What we do not want | Reason / prerequisite |
| --- | --- | --- | --- |
| Reporting | Anonymous reporting remains available | An account requirement before helping | Ordinary riders should be able to send a correction quickly |
| Form | Choose topic → relevant details → review and explicitly confirm sending | Posting immediately from the details screen | Users should see what will become public before sending |
| Wagon reporting | Clear train diagram, front/rear labels, obvious selected car, actual observed train length/direction | Assumed car count, default selected car or invented women-only sections | Reports must describe the train actually observed |
| Preview submissions | Explicitly labelled test submission, isolated from production publication, or a clear handoff to the live form | “Not enabled” with a dead-looking primary action; silently publishing preview tests | The preview should let people understand/test the flow without creating real data reports by accident |
| Login | Optional Google + email-code flow using the existing Neon Auth service | A custom password/OTP/session system or several separate account databases | Reuse the account provider already available |
| Public credit | Explicit opt-in public display name per report, attached to a server-verified account | Publishing the private contact name/email, or trusting an account ID supplied by the browser | Privacy and trustworthy attribution |
| Leaderboard | Real accepted contributions as the main count; any submitted-report count clearly labelled separately | Hardcoded names, invented points, or presenting submitted reports as approved corrections | Define a reliable maintainer acceptance event first; do not treat a closed issue as acceptance |
| Profiles | A small optional public profile with display name and credited contributions | A large social network or public private-contact history | Useful credit can stay simple; public history must respect consent |
| Multiple amenities | Several observed amenities in one report, each with its own observed status | Forcing a separate report for every amenity or presenting unknowns as verified facts | This was useful in the old UI and can be restored after the main form |
| City/line requests | An obvious request choice with the relevant name/source questions | Burying all requests in a vague text box | A dedicated report type may be enough; a separate page is not essential |
| Voting | Consider later as a review signal | Votes automatically changing canonical data or approving reports | Popularity does not establish correctness; needs persisted identity and moderation |
| Construction maps | Licensed, source-labelled future infrastructure; simple station-to-station display consistent with Tehran; excluded from route planning | Drawing a whole partly operating line as closed, inventing stops, or treating future lines as travel options | Review the future-stop source and statuses before showing them |
| Donations | Add a verified owner-controlled destination if wanted | Restoring an unverified old payment link automatically | Not needed to complete contribution reporting |

“Accepted contribution” needs a recorded review outcome: for example, an
explicit maintainer approval tied to the resulting data change. Until that
exists, the honest options are an empty accepted-contribution table or a
separately labelled list of submitted reports. Do not manufacture rankings.

## What happened to the old Novus features

Compared against `metto-data-prev` commit
`c75b7bf1dea6afea848303b136881869dc6c22ce` and
`docs/portal-migration.json`.

| Old feature | What the old code actually did | Migration result |
| --- | --- | --- |
| Two-step form | Two client-side views | Lost during migration; restored in current PR #23. A third confirmation step is requested next |
| Wagon suggestion | Clickable diagram with default/assumed counts; local proposal only | Real wagon report retained; more visible in PR #23; visual improvement remains pending |
| Leaderboard | Four hardcoded names and counts calculated with `18 - i * 3` | Simulated screen omitted; real leaderboard not implemented |
| My/public profiles | Fixed names, sample links, fixed statistics and sample history | Omitted |
| Login/sign-up | Text inviting sign-up; no account creation/session/callback flow in the inspected snapshot | No functioning login UI was migrated. The existing Neon Auth connection was not removed |
| Agree/disagree votes | React state; reset on page reload | Omitted |
| Several amenities | Local checkbox list and a text proposal | Current structured form handles one amenity at a time |
| Named/anonymous author | Checkbox assigned a sample author | Replaced with anonymous real submissions and private optional contact; verified public credit remains missing |
| City suggestion page | Four text fields and an in-memory confirmation | Generic “Other information” / “Another city” report retained; dedicated screen omitted |
| Recent contributions | Three sample records with sample review states | Replaced with real GitHub reports; closed does not imply approved |
| Profile sharing/history | Generic sharing and sample history | Omitted with profiles |
| Donation link | Fixed `buymeacoffee.com/mettodata` URL | Omitted; ownership was not established in migration |
| Toy network map | Handwritten sample records | Replaced with committed Tehran/Mashhad data |

The migration code did not delete account/authentication tables. This comparison
covers the inspected repository and migration; it does not establish that no
other historical deployment ever offered login.

## Where the current dashed lines came from

They are OpenStreetMap **railway construction ways**, tagged as underground
subway tunnels, not routes generated by a driving or walking service:

- [Line 3 north extension, way 276449885](https://www.openstreetmap.org/way/276449885)
- [Line 3 south extension, way 1388754302](https://www.openstreetmap.org/way/1388754302)
- [Line 4, way 381927098](https://www.openstreetmap.org/way/381927098)

The detailed tunnel alignment can follow streets, which explains its appearance.
Tehran’s app draws simpler station connections. Matching that appearance means
changing the rendering to reviewed future-stop connections, not substituting a
road route. See `docs/mashhad-construction-map.md` for the pinned versions,
license and limitations. The follow-up renders straight connections between the mapped stop positions
instead of every tunnel geometry point, and keeps future stops outside the
boarding catalog.

## What is needed before implementation

1. Chosen methods: Google + email OTP; GitHub as a secondary method.
   Anonymous reporting remains available.
2. Check the Neon console’s enabled providers, email/OTP settings, account
   linking behaviour and existing users. The management API now confirms the provider settings, trusted domains and
   required email verification. Completing login with a real inbox and checking
   cross-provider account linking remain owner acceptance tests.
3. For Google, create/configure a Metto-owned OAuth app, its branding and
   credentials. For GitHub, do the equivalent only if selected. Register the
   exact callback URI shown by Neon; do not guess it or use a GitHub PAT as an
   OAuth client secret.
4. Add the app’s production domain (`data.metto.ir`) to Neon’s trusted domains
   and use an intentional preview/testing setup. Keep provider secrets server
   side.
5. Configure production email delivery/sender and DNS verification for email
   OTP; test delivery, code expiry, resend limits and failed attempts. Confirm
   behaviour on the devices/networks of the intended riders.
6. Connect the account UI/session handling to Neon. Verify that signing in by
   different enabled methods does not create unintended duplicate contributor
   identities. Preserve form drafts/photos across optional login.
7. Add explicit public-credit consent and a reliable accepted-contribution
   signal, then build the leaderboard from real data. Test that private contact
   fields never become public credit.
8. Finish/test the requested form, wagon and map follow-ups separately, then
   review the updated previews before merging. Implementation has now been authorized. Neon domains, Google/GitHub
   authorization starts, the Metto Data application name and required email
   verification have been checked. Production branding/email setup still needs
   the owner-controlled provider configuration described in the setup guide.

## Sources checked

Neon documentation retrieved 2026-10-25:

- [Set up OAuth](https://neon.com/docs/auth/guides/setup-oauth)
- [Email OTP](https://neon.com/docs/auth/guides/plugins/email-otp)
- [Customize emails](https://neon.com/docs/auth/guides/customize-emails)

The installed Neon Auth SDK also exposes social sign-in and email-OTP APIs;
that corroborates capability, not this project’s enabled provider configuration.
