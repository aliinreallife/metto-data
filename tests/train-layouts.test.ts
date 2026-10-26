import { expect, it } from "vitest";
import {
  availableTrainProfiles,
  resolveTrainProfile,
  trainProfiles,
  trainSources,
  womenZone,
} from "../apps/data-portal/lib/train-layouts.ts";
it("keeps city and line templates separate and preserves source evidence", () => {
  expect(
    availableTrainProfiles("mashhad", ["mashhad:line:1"]).map(
      (profile) => profile.cars,
    ),
  ).toEqual([3]);
  expect(
    availableTrainProfiles("mashhad", ["mashhad:line:2"]).map(
      (profile) => profile.cars,
    ),
  ).toEqual([5]);
  expect(
    availableTrainProfiles("tehran", ["tehran:line:5"]).map(
      (profile) => profile.cars,
    ),
  ).toEqual([9]);
  expect(availableTrainProfiles("other")).toEqual([]);
  for (const profile of trainProfiles) {
    expect(profile.id.startsWith(profile.cityId + ":")).toBe(true);
    expect(profile.cars).toBeGreaterThanOrEqual(2);
    expect(profile.cars).toBeLessThanOrEqual(12);
    for (const id of profile.sourceIds)
      expect(
        trainSources.some(
          (source) =>
            source.id === id &&
            source.url.startsWith("https://") &&
            /^[a-f0-9]{64}$/.test(source.snapshotSha256),
        ),
      ).toBe(true);
  }
});
it("marks only the sourced full and adjacent half-car women's areas in the seven-car reference", () => {
  const urban = trainProfiles.find(
    (profile) => profile.id === "tehran:urban:7",
  );
  expect(
    Array.from({ length: 7 }, (_, i) => womenZone(urban, 7, i + 1)),
  ).toEqual(["full", "head-half", null, null, null, "rear-half", "full"]);
});
it("uses the operator-confirmed half-car areas at both ends of Mashhad Line 1", () => {
  const mashhad = resolveTrainProfile("mashhad");
  expect(mashhad?.sourceIds).toContain("mashhad-line1-women-2026");
  expect(
    Array.from({ length: 3 }, (_, i) => womenZone(mashhad, 3, i + 1)),
  ).toEqual(["head-half", null, "rear-half"]);
});
it("does not extrapolate women's sections to unverified layouts or a changed consist", () => {
  const urban = trainProfiles.find(
    (profile) => profile.id === "tehran:urban:7",
  );
  expect(womenZone(urban, 8, 1)).toBeNull();
  for (const profile of trainProfiles.filter((profile) => !profile.women))
    for (let car = 1; car <= profile.cars; car++)
      expect(womenZone(profile, profile.cars, car)).toBeNull();
});
it("defaults by city and station while rejecting stale or unrelated profile selections", () => {
  expect(resolveTrainProfile("tehran")?.cars).toBe(7);
  expect(resolveTrainProfile("mashhad")?.cars).toBe(3);
  expect(resolveTrainProfile("mashhad", ["mashhad:line:2"])?.cars).toBe(5);
  expect(resolveTrainProfile("tehran", ["tehran:line:5"])?.cars).toBe(9);
  expect(resolveTrainProfile("mashhad", [], "tehran:urban:7")?.cars).toBe(3);
  expect(
    resolveTrainProfile("mashhad", ["mashhad:line:2"], "mashhad:line1:3")?.cars,
  ).toBe(5);
  expect(resolveTrainProfile("other")).toBeUndefined();
  const station = "tehran:station:mehrabad-airport-terminal-1-2";
  expect(
    availableTrainProfiles("tehran", ["tehran:line:4"], station).map(
      (p) => p.cars,
    ),
  ).toEqual([4]);
  expect(
    resolveTrainProfile("tehran", ["tehran:line:4"], "tehran:urban:7", station)
      ?.cars,
  ).toBe(4);
  expect(
    availableTrainProfiles(
      "tehran",
      ["tehran:line:4"],
      "tehran:station:bimeh",
    ).map((p) => p.cars),
  ).toEqual([7, 4]);
});

it("records reported Line 5 women-only presence separately from verified positions", () => {
  const profile = resolveTrainProfile("tehran", ["tehran:line:5"]);
  expect(profile).toHaveProperty(
    "womenPresenceObservation",
    "tehran-line5-owner-observation-2026-10-26",
  );
  expect(profile?.women).toBeNull();
  expect(
    Array.from({ length: 9 }, (_, i) => womenZone(profile, 9, i + 1)),
  ).toEqual(Array(9).fill(null));
});
