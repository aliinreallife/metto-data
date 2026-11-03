import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { normalizeIsfahanTimetable, parseTimetableCSV, type TimetableContext } from "../importers/isfahan-timetable.js";
import { isfahanCalendarPolicy, resolveIsfahanServiceDate, type DateOverride } from "../importers/isfahan-service-calendar.js";

const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const intake = read("sources/isfahan/timetable-candidate-review-2026-10-31.json");
const patches = read("sources/isfahan/timetable-reviewed-corrections.json");
const hash = "a".repeat(64);
function context(): TimetableContext {
  return structuredClone({ crosswalk: intake.stationIdCrosswalk, images: intake.operatorReference.images,
    inputSha256: hash, addedTrips: patches.addedTrips, conditionalDispatches: patches.conditionalDispatches });
}
function rows(serviceId = "saturday_thursday", conditional = false) {
  const ctx = context();
  const trip = conditional ? "isf_l1_saturday_thursday_qods_to_defa_005" : `fixture_${serviceId}_qods_to_defa`;
  const first = conditional ? "06:42" : serviceId === "friday" ? "09:00" : "06:00";
  const start = Number(first.slice(0, 2)) * 60 + Number(first.slice(3));
  return ctx.crosswalk.filter(s => serviceId !== "friday" || ![2, 3, 17, 18].includes(s.ordinalQodsToDefa)).map(s => {
    const minute = start + (s.ordinalQodsToDefa === 1 ? 0 : 2 * s.ordinalQodsToDefa - 1);
    const time = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
    return { trip_id: trip, city: "isfahan", line: "1", service_id: serviceId, direction: "qods_to_defa",
      source_row_index: serviceId === "friday" ? "4" : conditional ? "5" : "1", terminal_start_time: first,
      station_id: s.uploadedStationId, station_name_fa: s.sourceNameFa, stop_sequence: String(s.ordinalQodsToDefa),
      arrival_time: time, departure_time: time, source_image: serviceId === "friday" ? "image (8).png" : "image (7).png",
      departure_detection_method: "fixture", station_time_method: "terminal_departure_plus_first_run_station_offsets",
      operator_timestamp: "1405/07/11", timezone: "Asia/Tehran", verification_status: "machine_reconstructed_needs_manual_cell_validation", production_ready: "False" };
  });
}
function csv(values: Record<string, string>[]) {
  const header = Object.keys(values[0]);
  const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return "\uFEFF" + [header, ...values.map(v => header.map(k => v[k]))].map(r => r.map(quote).join(",")).join("\r\n");
}

it("preserves quoted CSV content and rejects malformed/header-deficient input", () => {
  const input = rows(); input[0].source_image = 'image, "7".png';
  expect(parseTimetableCSV(csv(input))).toEqual(input);
  expect(() => parseTimetableCSV('trip_id,city\nx,isfahan')).toThrow(/columns/);
  expect(() => parseTimetableCSV(csv(input) + '\n"unfinished')).toThrow(/quote/);
  expect(() => parseTimetableCSV(csv(input).replace('"trip_id"', '"trip_id"junk'))).toThrow(/closing CSV quote/);
  expect(() => parseTimetableCSV(csv(input).replace('"trip_id"', 'tr"ip_id'))).toThrow(/unquoted CSV/);
});
it("adds both directly inspected 22:00 Friday rows, retaining black cells and conditional extras separately", () => {
  const result = normalizeIsfahanTimetable([...rows(), ...rows("saturday_thursday", true), ...rows("friday")], context());
  expect(result.counts).toEqual({ trips: 5, scheduledTrips: 4, conditionalTrips: 1, stationTimes: 88, blackSourceCells: 12 });
  const added = result.scheduledTrips.filter(t => t.uploadedTripId === null);
  expect(added).toHaveLength(2);
  for (const t of added) {
    expect(t.terminalDeparture).toBe("22:00"); expect(t.stops.at(-1)!.publishedTime).toBe("22:39");
    expect(t.stationOrder).toHaveLength(20); expect(t.stops.filter(s => s.publishedTime !== null)).toHaveLength(16);
    expect(t.stops.filter(s => s.sourceMark === "black").every(s => s.publishedTime === null && s.boardingRule === "provisional_no_boarding_newest_poster")).toBe(true);
    expect(t.stops.filter(s => s.publishedTime).every(s => s.verification === "manual_source_cell" && s.imageBbox?.length === 4)).toBe(true);
    expect(t.originId).toBe(t.stationOrder[0]); expect(t.destinationId).toBe(t.stationOrder.at(-1));
    expect(t.sourceRow).toBe(53); expect(t.serviceDays).toEqual(["friday"]);
  }
  expect(result.conditionalTrips[0].terminalDeparture).toBe("06:42");
  expect(result.conditionalTrips[0].dispatchCondition).toBe("when_needed_and_possible");
  expect(result.scheduledTrips.some(t => t.uploadedTripId === result.conditionalTrips[0].uploadedTripId)).toBe(false);
  expect(result.fridayBoardingRule.conflictResolved).toBe(false);
  expect(result.readyForProduction).toBe(false);
  expect([...result.scheduledTrips, ...result.conditionalTrips].every(t => t.reviewOnly && !t.productionEtaApproved)).toBe(true);
});
it.each(["foreign", "duplicate", "sequence", "missing", "approval", "time", "backwards"])("rejects %s input instead of fabricating a timetable", problem => {
  const input = rows();
  if (problem === "foreign") input[0].station_id = "tehran:station:qods";
  if (problem === "duplicate") input.push({ ...input[0] });
  if (problem === "sequence") input[1].stop_sequence = "9";
  if (problem === "missing") input.splice(1, 1);
  if (problem === "approval") input[0].production_ready = "True";
  if (problem === "time") input[0].arrival_time = input[0].departure_time = "25:99";
  if (problem === "backwards") input[1].arrival_time = input[1].departure_time = "05:00";
  expect(() => normalizeIsfahanTimetable(input, context())).toThrow(/Isfahan timetable/);
});
it("rejects invented Friday black-cell times and altered correction provenance/order", () => {
  const input = rows("friday"), fake = rows()[1];
  input.push({ ...input[0], station_id: fake.station_id, station_name_fa: fake.station_name_fa, stop_sequence: "2" });
  expect(() => normalizeIsfahanTimetable(input, context())).toThrow(/black Friday/);
  const altered = context(); altered.addedTrips[0].sourceImageSha256 = hash;
  expect(() => normalizeIsfahanTimetable(rows(), altered)).toThrow(/source/);
  const order = context(); order.addedTrips[0].cells[0].stationId = "tehran:station:qods";
  expect(() => normalizeIsfahanTimetable(rows(), order)).toThrow(/cells/);
  const collision = context(); collision.addedTrips.push(structuredClone(collision.addedTrips[0]));
  expect(() => normalizeIsfahanTimetable(rows(), collision)).toThrow(/duplicate source trip/);
});
it("keeps pinned original input identity and the 32 reviewed cells separate", () => {
  expect(patches.addedTrips.flatMap((t: { cells: { sourceCellValue: string | null }[] }) => t.cells.filter(c => c.sourceCellValue !== null))).toHaveLength(32);
  expect(patches.conditionalDispatches).toHaveLength(5);
  expect(intake.uploadedInputs.find((i: { fileName: string }) => i.fileName === "stop_times.csv").sha256).toBe("672ac1f7aa5d74f634902bf324f00a0fb150b316dea901f003b87b0607e0a08d");
});
it("pins the source-cell audit to the reviewed manual reads and the reproducible decoder", () => {
  const summary = read("sources/isfahan/timetable-cell-audit-summary.json");
  const digest = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
  expect(summary.manualReviewSha256).toBe(digest("sources/isfahan/timetable-cell-review.json"));
  expect(summary.scriptSha256).toBe(digest("scripts/audit-isfahan-timetable-cells.py"));
  expect(summary.counts.machineMatches + summary.counts.manualUploadedMatches).toBe(5204);
  expect(summary.counts.addedFridayManualMatches).toBe(32);
  expect(summary.counts.remainingTimeDifferences).toBe(0);
  expect(summary.counts.remainingUnreadableTimes).toBe(0);
  expect(summary.productionEtaApproved).toBe(false);
});

function override(date: string, availability: "closed" | "modified" = "closed"): DateOverride {
  return { date, availability, verification: "source_verified", ...(availability === "modified" ? { hours: { start: "07:00", end: "22:00" } } : {}),
    evidence: { url: "https://metroisfahan.ir/example-official-notice", publishedOn: "2026-03-20", sha256: hash, kind: "operator_notice" } };
}
describe("Isfahan-specific calendar precedence", () => {
  it("keeps Friday, non-Friday holidays and unknown classifications distinct", () => {
    expect(resolveIsfahanServiceDate("2026-11-06", "ordinary").serviceId).toBe("friday");
    expect(resolveIsfahanServiceDate("2026-11-06", "public_holiday")).toMatchObject({ isFriday: true, holidayStatus: "public_holiday", serviceId: "friday" });
    expect(resolveIsfahanServiceDate("2026-11-05", "public_holiday")).toMatchObject({ category: "public_holiday", availability: "assumed_pattern", provisionalExpectation: "friday_service", serviceId: "friday", hours: { start: "09:00", end: "22:00" } });
    expect(resolveIsfahanServiceDate("2026-11-05", "unknown").availability).toBe("unconfirmed");
    expect(resolveIsfahanServiceDate("2026-11-05", "ordinary")).toMatchObject({ category: "weekday", serviceId: "saturday_thursday", hours: { start: "06:00", end: "22:00" } });
  });
  it("applies an evidenced exact-date closure before Friday and keeps modified hours distinct from station times", () => {
    const policy = structuredClone(isfahanCalendarPolicy); policy.dateOverrides = [override("2026-11-06"), override("2026-11-05", "modified")];
    expect(resolveIsfahanServiceDate("2026-11-06", "ordinary", policy)).toMatchObject({ category: "date_override", availability: "closed", serviceId: null });
    const modified = resolveIsfahanServiceDate("2026-11-05", "public_holiday", policy);
    expect(modified).toMatchObject({ category: "date_override", availability: "hours_only", hours: { start: "07:00", end: "22:00" }, serviceId: null, productionEtaApproved: false });
    expect(modified.evidence).toEqual([policy.dateOverrides[1].evidence.url]);
  });
  it("does not let unevidenced, conflicting or user-only overrides silently fall back to normal departures", () => {
    const p = structuredClone(isfahanCalendarPolicy); const row = override("2026-11-06"); row.verification = "unverified"; p.dateOverrides = [row];
    expect(resolveIsfahanServiceDate("2026-11-06", "ordinary", p).availability).toBe("unconfirmed");
    row.verification = "source_verified"; row.evidence.kind = "user_report";
    expect(resolveIsfahanServiceDate("2026-11-06", "ordinary", p).availability).toBe("unconfirmed");
    p.dateOverrides = [override("2026-11-06"), override("2026-11-06", "modified")];
    expect(resolveIsfahanServiceDate("2026-11-06", "ordinary", p).availability).toBe("unconfirmed");
  });
  it("rejects invalid dates, absent holiday classes and production-approval flags", () => {
    expect(() => resolveIsfahanServiceDate("2026-02-30", "ordinary")).toThrow(/date/);
    expect(() => resolveIsfahanServiceDate("2026-11-05", undefined as never)).toThrow(/classification/);
    expect(() => resolveIsfahanServiceDate("2026-11-05", "ordinary", { ...isfahanCalendarPolicy, productionEtaApproved: true })).toThrow(/boundary/);
    expect(resolveIsfahanServiceDate("2026-11-06", "ordinary").productionEtaApproved).toBe(false);
  });
  it("does not retroactively apply the October poster to earlier dates", () => {
    expect(resolveIsfahanServiceDate("2026-03-22", "ordinary").availability).toBe("unconfirmed");
    const policy = structuredClone(isfahanCalendarPolicy); policy.dateOverrides = [override("2026-03-22")];
    expect(resolveIsfahanServiceDate("2026-03-22", "public_holiday", policy).availability).toBe("closed");
  });
  it("rejects invalid override hours and keeps the dated Friday conflict unresolved", () => {
    const policy = structuredClone(isfahanCalendarPolicy); const modified = override("2026-11-06", "modified");
    modified.hours = { start: "07:00", end: "22:99" }; policy.dateOverrides = [modified];
    expect(() => resolveIsfahanServiceDate("2026-11-06", "ordinary", policy)).toThrow(/hours/);
    modified.hours = { start: "22:00", end: "07:00" };
    expect(() => resolveIsfahanServiceDate("2026-11-06", "ordinary", policy)).toThrow(/hours/);
    const evidence = read("sources/isfahan/service-calendar-review.json");
    const older = evidence.sourceReferences.find((r: { id: string }) => r.id === "operator-friday-stations-1402-11-07");
    expect(older.activeStationIds).toContain("isfahan:station:kargar");
    expect(older.omittedStationIds).toContain("isfahan:station:shahid-chamran");
    expect(evidence.fridayRule.provisionallyNonBoardableStationIds).toContain("isfahan:station:kargar");
    expect(evidence.fridayRule.conflictResolved).toBe(false);
  });
});
