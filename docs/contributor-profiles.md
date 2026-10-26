# Contributor identities, profile pages and credit

The real 17 Shahrivar correction was already verified against the pinned Tehran
override. It was recorded as historical activity, so the previous leaderboard's
signed-report-only calculation skipped it. Historical corrections now count once
alongside accepted reports, with their source and historical label retained.
They do not create synthetic OAuth users, votes, pending issues or submissions.

The source author is keyed by the immutable public GitHub account ID (`91134550`
for `aliinreallife`, checked against GitHub), not a typed display name, email or
social URL. Before account linkage, `/contributors/github-91134550` shows the
sourced historical record. An authenticated member's profile load/save checks
Neon Auth's server-side `listAccounts()`. Only the session's exact linked GitHub
provider ID can attach the earlier credit to that member's stable contributor
ID. Client fields cannot supply proof. The old historical URL then redirects to
the member's current profile. Profile visits and leaderboard reads never expose
provider credentials or the private Neon user ID.

A normal report still needs public-credit consent and maintainer acceptance to
count. Sending, closing, confirming or disagreeing with a report does not award
accepted-contribution credit. Anonymous/manual-contact reports are not matched to
accounts by their names or contacts. A historical correction receives the same
one-contribution credit, with its different provenance clearly labeled.

## Usernames

Account settings let a member choose a public username with 3–30 ASCII letters,
numbers or underscores, starting with a letter or number. Handles normalize to
lowercase, and internal/official role names are reserved. Existing accounts keep
their stable ID and remain usable before choosing a handle. A chosen username
produces `/contributors/<username>`; stable ID links remain valid and redirect to
the current handle. Renaming does not transfer report history or credit. A
released handle may be chosen by another account; signed reports continue to
belong to their stable contributor IDs.

Neon's private object store enforces uniqueness with a PostgreSQL unique index
on normalized usernames within each production/preview namespace. The profile
and username are a single atomic row update, so simultaneous claims cannot
produce two owners or strand a separate reservation. Lookup uses bound SQL
parameters. Existing profile revision checks still prevent stale writes. The
legacy Blob-only store does not claim to support unique usernames; it can still
serve old profile operations without a username. Production uses Neon.

Usernames are public. Choosing one does not publish a private account name,
age, gender, bio or social links. Public names already attached to contributions
remain public; the separate profile-name/bio/social opt-in still controls profile
content. The contributor name in the feed, report details and leaderboard opens
that person's page. The signed-in name on report review opens the member's page
in a new tab so the draft remains intact.

Verification uses isolated PostgreSQL-compatible PGlite databases, concurrent
claims, authenticated-provider fixtures and mocked browser saves. No production
account, username or credit binding is seeded or assigned during testing.
