# What changed when Novus became Metto Data

Compared against `metto-data-prev` commit `c75b7bf1dea6afea848303b136881869dc6c22ce` and the migration record `docs/portal-migration.json`.

The migration explicitly imported the visual language and replaced prototype records and simulated social activity with the canonical catalog and real GitHub reports. The two-step form was also dropped; that was a usability regression and is restored by this change.

| Feature in the old repository | What it actually did | Current portal / this change |
| --- | --- | --- |
| Choose type, then a tailored form | Two client-side views | Restored with six clear choices, including train times and map corrections |
| Wagon near an escalator | Clickable diagram with assumed/default car counts; local proposal only | Retained, now a visible first-step choice; actual observed train length and car are submitted for review |
| Leaderboard | Four hardcoded names and invented counts (`18 - i * 3`) | Omitted. A real leaderboard needs opt-in contributor identities and reviewed contribution totals |
| My profile / public profiles | Fixed names, sample social links, fixed statistics and sample proposals | Omitted; no authenticated profile service in the repository snapshot |
| Login / sign-up | Text inviting sign-up; no login route, auth callback, session or account creation in this snapshot | No implemented login was migrated. Existing database/auth tables were left intact; their existence does not establish a working login UI |
| Agree / disagree voting | React state only; resetting the page resets votes | Omitted; real voting requires persisted identity/anti-abuse rules |
| Several amenities in one report | Local checkbox list and a text proposal | Current structured amenity form reports one amenity at a time; other observations can be described together |
| Named versus anonymous contributions | Checkbox assigns a sample author; not a verified identity | Anonymous real submissions with optional private contact. Public credit needs explicit opt-in, not disclosure of private contact fields |
| A dedicated city suggestion page | Four text fields with an in-memory confirmation | “Other information” → “Another city”; real persisted report, but no separate city suggestion page |
| Latest contributions | Three sample records and made-up review states | Real GitHub issues, labelled as awaiting review/closed; a closed issue is not presented as approval |
| Profile sharing / public contribution history | Generic share action and sample history | Omitted with the simulated profile screens |
| Donation footer link | A fixed `buymeacoffee.com/mettodata` URL | Omitted; ownership/payment destination was not established by the migration |
| Toy network map / sample cities | Handwritten sample records | Real committed Tehran/Mashhad geometry; new map-only construction sections are explicitly separated from passenger routing |

No previous account records or authentication tables were deleted by the migration. This comparison is about the inspected repository and migration code, not proof that no other historical deployment ever had authentication.

Recommended next step: optional accounts, public credit only with consent, then profiles and a leaderboard derived from accepted contributions. Anonymous reporting should remain available. Do not bring back fabricated statistics or make private contact names public.
