import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
it("publishes only the authorized regular Line 1 projection and retains holiday uncertainty", () => {
  const data = read("data/releases/isfahan-line1.json");
  expect(data.release.productionAuthorized).toBe(true);
  expect(data.stationIds).toHaveLength(20);
  expect(data.trips).toHaveLength(278);
  expect(data.trips.filter((t: { serviceId: string }) => t.serviceId === "friday")).toHaveLength(106);
  expect(data.trips.filter((t: { serviceId: string }) => t.serviceId === "saturday_thursday")).toHaveLength(172);
  expect(data.release.conditionalDispatchesIncluded).toBe(false);
  const conditional = read("sources/isfahan/timetable-reviewed-corrections.json").conditionalDispatches;
  for (const t of data.trips) {
    expect(t.times).toHaveLength(20);
    expect(conditional.some((c: { uploadedTripId: string }) => t.id.endsWith(c.uploadedTripId))).toBe(false);
    if (t.serviceId === "friday") expect(t.times.flatMap((v: string | null, i: number) => v === null ? [data.stationIds[i]] : [])).toEqual(data.release.fridayNoBoardingStationIds);
  }
  expect(data.calendar.nonFridayHolidayRule.operatorVerified).toBe(false);
  expect(data.calendar.nonFridayHolidayRule.availability).toBe("assumed_pattern");
  expect(data.calendar.fridayRule.conflictResolved).toBe(false);
});
