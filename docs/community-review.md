# Community reports and owner review

Passengers can read published reports at `https://data.metto.ir/reports`.
A Google/GitHub account with a verified email can confirm or disagree with a
report, change that vote or withdraw it. Each account has one vote per report.
The portal never exposes individual voter IDs, private contact details, age or
gender. There is no public points reward for voting.

Three confirmations **or** three disagreements queue the report for the owner;
mixed votes do not add together. The existing maintenance job runs every
15 minutes and assigns the GitHub issue to `aliinreallife`, which uses GitHub's
assignment notification. Delivery follows the owner's GitHub notification
settings. Policy and limits live in
[`data/reference/community-policy.json`](../data/reference/community-policy.json).
A vote threshold does not approve or change data.

## Reviewing a report

1. Open the linked issue and inspect its evidence and **exact structured
   corrections**. Contact fields remain in private storage, outside the issue.
2. To accept it, the repository owner adds `data:accepted` on GitHub. To reject
   it, remove `data:accepted` and add `data:rejected`. Conflicting labels stop
   automatic application. Rejection closes voting; it does not undo an earlier
   applied correction.
3. The owner-only `community-review.yml` job verifies the label against GitHub
   and the original private stored report. Editable issue text cannot supply
   replacement station IDs, values or operations.
4. A current structured **station amenity** correction with a definite
   exists/does-not-exist value can be applied automatically. The job writes an
   auditable `contributions/approved/<report UUID>.json`, rebuilds canonical
   datasets and runs validation and regression tests before pushing to main.
5. Inspect the job/issue result. `data:manual-needed` means some or all of the
   report still needs a manual update. Conflicting prior approved corrections
   are never overwritten automatically. A failed push/validation also requires
   attention; the portal does not claim an update was applied without the job's
   acknowledgement.

Timetable text/photos, wagon/exit placement, station status/location, new cities,
unknown amenity values and older free-text-only reports require manual work.
A report containing both supported amenity booleans and unknown values applies
only its supported fields and explicitly flags the remainder. Photos are evidence,
not trusted machine-extracted data. A single approved field does not mark all
station amenities as verified. Accepted, signed-in contributions continue to
count toward the existing leaderboard; anonymous reports remain anonymous.

The automatic change updates **metto-data** and its portal. Metto's passenger
app imports a pinned dataset separately; updating/releasing that import remains
a manual step in the passenger repository. This avoids claiming an unrelated
passenger deployment has changed.

## Identity and infrastructure

Choosing “Use my account” on the final report step shows the current account
name and obtains its value on the server. It does not ask for another public
name or private contact. An email-shaped/empty provider name requires editing
the account name before opting into public report credit. Optional public
profile aliases remain a separate opt-in setting; existing credited history is
not rewritten when a name changes. Anonymous and manual-contact submissions are
still available, with contact fields included only for the manual-contact mode.

This reuses Neon Auth, the private Neon JSON object store, Vercel and GitHub
Actions. No new database/provider, OAuth permission or persistent GitHub token
is required. Automation receives a short-lived GitHub job token and an OIDC token
bound to the exact main-branch workflow, repository IDs and owner actor. The
maintenance token cannot authorize owner approval. Validation tests use mock
reports, voters and GitHub responses; they never seed production activity.
