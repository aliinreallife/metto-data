import { expect, it } from "vitest";
import {
  availableTrainProfiles,
  trainProfiles,
  trainSources,
  womenZone,
} from "../apps/data-portal/lib/train-layouts.ts";
it("keeps city and line templates separate and preserves source evidence", () => {
  expect(
    availableTrainProfiles("mashhad", ["mashhad:line:1"]).map(
      (profile) => profile.cars,
    ),
  ).toEqual([2, 3]);
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
it("does not extrapolate women's sections to other cities, double-deck trains or a changed consist", () => {
  const urban = trainProfiles.find(
    (profile) => profile.id === "tehran:urban:7",
  );
  expect(womenZone(urban, 8, 1)).toBeNull();
  for (const profile of trainProfiles.filter(
    (profile) => profile.id !== urban?.id,
  ))
    for (let car = 1; car <= profile.cars; car++)
      expect(womenZone(profile, profile.cars, car)).toBeNull();
});
