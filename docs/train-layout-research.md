# Train layout investigation — 2026-10-25

These are curated reporting references, not live train assignments. The selected
city supplies a default; a selected station narrows the available layouts. Users
can choose a listed train type, but cannot enter an arbitrary car count. They can
describe a different observed formation and attach a photo for review. No car is
selected on the user's behalf.

Direction choices use the endpoints of canonical boarding routes, filtered to the
selected station and layout. Route IDs distinguish the Mehrabad shuttle from
Line 4's main service at Bimeh. Both terminal directions remain available at end
stations because reports can describe an arriving train. A selected car requires
an explicit station and direction; the report retains route/line/destination IDs.
The train's head names the selected destination. Flipping preserves that meaning,
while changing direction clears the selected car for the other platform. Neither
direction nor escalator placement is inferred from the map.

| Service                 | Evidence                                                                                                                                                                                                  | Treatment                                                                                                                                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tehran urban            | Operator operations deputy, quoted by Mizan on 2026-08-26, describes a seven-car train and 1.5 women-only cars at each end.                                                                               | Tehran default: seven cars. Cars 1/7 are fully women-only, with the forward half of 2 and rear half of 6. Remaining space is general.                                                                            |
| Tehran–Karaj Line 5     | Operator CEO, quoted by Mehr on 2017-11-25, says passenger coaches increased from eight to nine per train.                                                                                                | Nine passenger coaches, excluding locomotives. This is historical evidence; women-only boundaries need line-specific verification.                                                                               |
| Tehran Mehrabad shuttle | Persian Tehran Metro article describes four-car trains because of shorter platforms.                                                                                                                      | Four-car secondary reference, automatically selected at the two airport terminal stations. Bimeh still offers the urban and shuttle layouts. Women-only boundaries remain unverified.                            |
| Mashhad Line 1          | Operator CEO Davood Hematian, quoted by Shahrara on 2026-09-10, says trains have recently become three cars. He specifies women-only space to half of the first and last cars, with a general middle car. | Mashhad default: three cars. Outer half of car 1 and outer half of car 3 are women-only. Car 2 and the remaining halves are general. The older two-car secondary template is no longer offered as current stock. |
| Mashhad Line 2          | EPC contractor Farab lists 20 trainsets and 100 cars.                                                                                                                                                     | Five-car project reference, derived from the equipment package. The Line 1 women's boundary is not extrapolated to Line 2.                                                                                       |

The Shahrara article mentions platform markings on Lines 1 and 2, but its detailed
half-car description concerns Line 1. A passenger's suggestion to make a whole
end car women-only is a proposal, not current policy. The picker implements the
operator's description instead.

Tehran has older separated-car and newer through-gangway stock. The technical
article distinguishes three variants (two newer body variants). This does not
justify different car counts for every AC/DC variant. The passenger choices are
urban metro, Line 5 double-deck and the airport shuttle.

The whole train is visible in the picker. Flipping the drawing preserves car
identity and swaps the drawn half-car areas with the train orientation. General
space is not labelled men-only. Platform and train signs remain the guide;
unverified layouts show an explicit note rather than guessed pink sections.
Research did not establish precise current boundaries for Line 2, Line 5 or the
airport shuttle.

Sources inspected:

- https://www.mizanonline.ir/fa/news/4910431 — operator operations interview, 2026-08-26.
- https://shahraranews.ir/fa/news/444196 — Mashhad operator CEO interview, 2026-09-10; three cars and outer half-car women's areas on Line 1.
- https://www.mehrnews.com/news/4154230 — operator Line 5 count announcement, 2017-11-25.
- https://www.farab.com/fa/portfolio/mashhad-urban-railway-line-2/ — contractor equipment list.
- https://fa.wikipedia.org/wiki/متروی_تهران — technical/airport-stock section, secondary.
- https://fa.wikipedia.org/wiki/قطار_شهری_مشهد — historical two/three-car statement, superseded for Line 1 by the operator interview.
- https://www.hamshahrionline.ir/news/689829 — Mashhad women's-area photo report, 2022-07-11; does not establish whole-train boundaries.

Source URLs, retrieval dates and snapshot hashes are recorded in
`data/reference/train-layouts.json`. Full articles/photos are not copied into the
public repository. No active stations, graph edges, timetables or canonical
amenities change in this work.
