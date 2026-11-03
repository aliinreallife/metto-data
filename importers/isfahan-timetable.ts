/** Candidate normalization only. Never writes schema-v1 schedules or enables ETAs. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Row = Record<string, string>;
type Crosswalk = { uploadedStationId: string; stationId: string; sourceNameFa: string; ordinalQodsToDefa: number };
type ImageRef = { name: string; url: string; sha256: string; dimensions: number[] };
type ReviewedCell = { stationId: string; stationOrder: number; sourceCellValue: string | null; sourceMark: string; imageBbox: number[]; verification: string };
type AddedTrip = { id: string; direction: string; originId: string; destinationId: string; serviceId: string; sourceDataRow: number; terminalDeparture: string; dispatchKind: string; sourceImageUrl: string; sourceImageSha256: string; cells: ReviewedCell[]; reviewOnly: boolean; productionEtaApproved: boolean };
export type TimetableContext = {
  crosswalk: Crosswalk[]; images: ImageRef[]; inputSha256: string;
  addedTrips: AddedTrip[];
  conditionalDispatches: { uploadedTripId: string; direction: string; terminalDeparture: string; serviceId: string; dispatchKind: string; condition: string; sourceImageUrl: string; sourceImageSha256: string; sourceFootnoteFa: string }[];
};
const blackOrdinals = new Set([2, 3, 17, 18]);
const days = { saturday_thursday: ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday"], friday: ["friday"] };
const required = ["trip_id", "city", "service_id", "line", "direction", "stop_sequence", "station_id", "station_name_fa", "arrival_time", "departure_time", "source_image", "source_row_index", "terminal_start_time", "departure_detection_method", "station_time_method", "operator_timestamp", "timezone", "verification_status", "production_ready"];
function fail(message: string): never { throw Error(`Isfahan timetable candidate: ${message}`); }
function clock(value: string) {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) fail(`invalid time ${value}`);
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}
export function parseTimetableCSV(text: string): Row[] {
  if (Buffer.byteLength(text) > 8_000_000) fail("input too large");
  text = text.replace(/^\uFEFF/, "");
  const records: string[][] = []; let row: string[] = [], field = "", quoted = false, closedQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { quoted = false; closedQuote = true; }
      else field += c;
    } else if (closedQuote && ![",", "\n", "\r"].includes(c)) fail("characters after closing CSV quote");
    else if (c === '"' && !field && !closedQuote) quoted = true;
    else if (c === '"') fail("quote inside unquoted CSV field");
    else if (c === ",") { row.push(field); field = ""; closedQuote = false; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); if (row.some(s => s.length)) records.push(row); row = []; field = ""; closedQuote = false;
    } else field += c;
  }
  if (quoted) fail("unterminated CSV quote");
  if (field || row.length) { row.push(field); records.push(row); }
  const header = records.shift();
  if (!header || header.length !== required.length || new Set(header).size !== header.length || required.some(k => !header.includes(k))) fail("missing/duplicate/unexpected CSV columns");
  return records.map((cells, i) => {
    if (cells.length !== header.length) fail(`wrong field count at row ${i + 2}`);
    return Object.fromEntries(header.map((key, n) => [key, cells[n]]));
  });
}
export function normalizeIsfahanTimetable(rows: Row[], context: TimetableContext) {
  const identity = new Map(context.crosswalk.map(s => [s.uploadedStationId, s]));
  const ordered = [...context.crosswalk].sort((a, b) => a.ordinalQodsToDefa - b.ordinalQodsToDefa);
  if (identity.size !== 20 || ordered.some((s, i) => s.ordinalQodsToDefa !== i + 1 || !s.stationId.startsWith("isfahan:station:")) || new Set(ordered.map(s => s.stationId)).size !== 20) fail("invalid identity crosswalk");
  const conditional = new Map(context.conditionalDispatches.map(c => [c.uploadedTripId, c]));
  const groups = new Map<string, Row[]>();
  for (const row of rows) { const list = groups.get(row.trip_id) ?? []; list.push(row); groups.set(row.trip_id, list); }
  const tripKeys = new Set<string>(), tripIds = new Set<string>();
  type Stop = { stationId: string; stationOrder: number; publishedTime: string | null; sourceMark: string; boardingRule: string; verification: string; imageBbox?: number[] };
  type Trip = { id: string; uploadedTripId: string | null; direction: string; originId: string; destinationId: string; serviceId: string; serviceDays: string[]; sourceRow: number; terminalDeparture: string; dispatchKind: string; dispatchCondition: string | null; stationOrder: string[]; stops: Stop[]; source: { imageUrl: string; imageSha256: string; inputSha256?: string; method: string; originalImageName?: string; footnoteFa?: string; sourceCellAuditSha256?: string }; reviewOnly: true; productionEtaApproved: false };
  const trips: Trip[] = [];
  const register = (trip: Trip) => {
    const key = `${trip.serviceId}|${trip.direction}|${trip.sourceRow}`;
    if (tripKeys.has(key)) fail("duplicate source trip row");
    if (tripIds.has(trip.id)) fail("duplicate trip ID");
    tripKeys.add(key);
    tripIds.add(trip.id);
    const times = trip.stops.flatMap(s => s.publishedTime === null ? [] : [clock(s.publishedTime)]);
    if (!times.length || times[0] !== clock(trip.terminalDeparture) || times.some((n, i) => i > 0 && n < times[i - 1])) fail("backwards or inconsistent trip times");
    trips.push(trip);
  };
  for (const [uploadedTripId, input] of groups) {
    const first = input[0], direction = first.direction, serviceId = first.service_id as keyof typeof days;
    if (!uploadedTripId || !["qods_to_defa", "defa_to_qods"].includes(direction) || !Object.hasOwn(days, serviceId)) fail("unsupported trip/direction/service");
    const stationOrder = direction === "qods_to_defa" ? ordered : [...ordered].reverse();
    const image = context.images.find(i => i.name === (serviceId === "friday" ? "friday" : "weekday"));
    if (!image || !/^[a-f0-9]{64}$/.test(image.sha256)) fail("missing pinned source image");
    const sourceRow = Number(first.source_row_index) - (serviceId === "friday" ? 3 : 0);
    if (!/^\d+$/.test(first.source_row_index) || !Number.isInteger(sourceRow) || sourceRow < 1 || sourceRow > (serviceId === "friday" ? 53 : 91)) fail("invalid source row");
    const stopMap = new Map<string, Row>();
    for (const row of input) {
      const station = identity.get(row.station_id);
      if (!station || station.sourceNameFa !== row.station_name_fa) fail("unknown or changed station identity/name");
      if (stopMap.has(station.stationId)) fail("duplicate trip/station");
      if (["trip_id", "direction", "service_id", "source_row_index", "terminal_start_time", "source_image"].some(k => row[k] !== first[k])) fail("mixed trip metadata");
      if (row.city !== "isfahan" || row.line !== "1" || row.timezone !== "Asia/Tehran" || row.production_ready !== "False" || row.verification_status !== "machine_reconstructed_needs_manual_cell_validation") fail("invalid input scope/approval");
      if (row.station_time_method !== "terminal_departure_plus_first_run_station_offsets" || row.operator_timestamp !== "1405/07/11") fail("changed reconstruction/source version");
      const position = stationOrder.findIndex(s => s.stationId === station.stationId) + 1;
      if (Number(row.stop_sequence) !== position || !/^\d+$/.test(row.stop_sequence)) fail("incorrect station order");
      clock(row.arrival_time); clock(row.departure_time);
      if (row.arrival_time !== row.departure_time) fail("arrival/departure semantics changed; require source review");
      stopMap.set(station.stationId, row);
    }
    const stops: Stop[] = stationOrder.map((s, i) => {
      const row = stopMap.get(s.stationId), black = serviceId === "friday" && blackOrdinals.has(s.ordinalQodsToDefa);
      if (black && row) fail("invented time at black Friday source cell");
      if (!black && !row) fail("missing printed station time");
      return { stationId: s.stationId, stationOrder: i + 1, publishedTime: row?.departure_time ?? null,
        sourceMark: black ? "black" : "time", boardingRule: black ? "provisional_no_boarding_newest_poster" : "source_timing_listed",
        verification: black ? "black_visible_meaning_provisional" : "uploaded_reconstruction_needs_source_cell_check" };
    });
    const extra = conditional.get(uploadedTripId);
    if (extra && (extra.dispatchKind !== "conditional" || extra.condition !== "when_needed_and_possible" || !extra.sourceFootnoteFa || extra.direction !== direction || extra.serviceId !== serviceId || extra.terminalDeparture !== first.terminal_start_time || extra.sourceImageSha256 !== image.sha256 || extra.sourceImageUrl !== image.url)) fail("conditional-dispatch evidence mismatch");
    register({ id: `isfahan:trip:${uploadedTripId}`, uploadedTripId, direction, originId: stationOrder[0].stationId,
      destinationId: stationOrder.at(-1)!.stationId, serviceId, serviceDays: days[serviceId], sourceRow,
      terminalDeparture: first.terminal_start_time, dispatchKind: extra ? "conditional" : "regular", dispatchCondition: extra?.condition ?? null,
      stationOrder: stationOrder.map(s => s.stationId), stops,
      source: { imageUrl: image.url, imageSha256: image.sha256, inputSha256: context.inputSha256,
        originalImageName: first.source_image, method: first.station_time_method, ...(extra ? { footnoteFa: extra.sourceFootnoteFa } : {}) },
      reviewOnly: true, productionEtaApproved: false });
  }
  for (const patch of context.addedTrips) {
    const image = context.images.find(i => i.name === "friday");
    if (!image || patch.reviewOnly !== true || patch.productionEtaApproved !== false || patch.serviceId !== "friday" || patch.dispatchKind !== "regular" || patch.sourceImageSha256 !== image.sha256 || patch.sourceImageUrl !== image.url) fail("unreviewed correction source/approval");
    if (!Number.isInteger(patch.sourceDataRow) || patch.sourceDataRow < 1 || patch.sourceDataRow > 53) fail("invalid correction source row");
    if (!["qods_to_defa", "defa_to_qods"].includes(patch.direction)) fail("invalid correction direction");
    const order = patch.direction === "qods_to_defa" ? ordered : [...ordered].reverse();
    if (!patch.id.startsWith("isfahan:trip:") || patch.cells.length !== 20 || patch.originId !== order[0].stationId || patch.destinationId !== order.at(-1)!.stationId) fail("invalid correction trip identity");
    const stops: Stop[] = patch.cells.map((c, i) => {
      const black = blackOrdinals.has(order[i].ordinalQodsToDefa);
      if (c.stationId !== order[i].stationId || c.stationOrder !== i + 1 || (black ? c.sourceMark !== "black" || c.sourceCellValue !== null : c.sourceMark !== "time" || c.sourceCellValue === null || c.verification !== "manual_source_cell")) fail("invalid correction cells");
      const [x0, y0, x1, y1] = c.imageBbox;
      if (c.imageBbox.length !== 4 || !c.imageBbox.every(Number.isInteger) || x0 < 0 || y0 < 0 || x1 <= x0 || y1 <= y0 || x1 > image.dimensions[0] || y1 > image.dimensions[1]) fail("invalid correction source-cell bounds");
      return { stationId: c.stationId, stationOrder: c.stationOrder, publishedTime: c.sourceCellValue, sourceMark: c.sourceMark,
        boardingRule: black ? "provisional_no_boarding_newest_poster" : "source_timing_listed", verification: c.verification, imageBbox: c.imageBbox };
    });
    register({ id: patch.id, uploadedTripId: null, direction: patch.direction, originId: patch.originId, destinationId: patch.destinationId,
      serviceId: "friday", serviceDays: ["friday"], sourceRow: patch.sourceDataRow, terminalDeparture: patch.terminalDeparture,
      dispatchKind: "regular", dispatchCondition: null, stationOrder: order.map(s => s.stationId), stops,
      source: { imageUrl: image.url, imageSha256: image.sha256, method: "manual_visual_source_cell_transcription" }, reviewOnly: true, productionEtaApproved: false });
  }
  trips.sort((a, b) => a.serviceId.localeCompare(b.serviceId) || a.direction.localeCompare(b.direction) || clock(a.terminalDeparture) - clock(b.terminalDeparture));
  const scheduledTrips = trips.filter(t => t.dispatchKind === "regular"), conditionalTrips = trips.filter(t => t.dispatchKind === "conditional");
  return { schemaVersion: 1, cityId: "isfahan", timezone: "Asia/Tehran", reviewOnly: true as const, readyForProduction: false as const,
    productionEtaApproved: false as const, sourceTimeSemantics: "published movement time; separate arrival/departure and dwell are not established",
    fridayBoardingRule: { status: "provisional_newest_official_poster", conflictResolved: false, stationIds: ordered.filter(s => blackOrdinals.has(s.ordinalQodsToDefa)).map(s => s.stationId) },
    counts: { trips: trips.length, scheduledTrips: scheduledTrips.length, conditionalTrips: conditionalTrips.length,
      stationTimes: trips.reduce((n, t) => n + t.stops.filter(s => s.publishedTime !== null).length, 0),
      blackSourceCells: trips.reduce((n, t) => n + t.stops.filter(s => s.sourceMark === "black").length, 0) },
    scheduledTrips, conditionalTrips };
}
export function buildIsfahanTimetableCandidate(root: string, csvPath: string) {
  const read = (path: string) => JSON.parse(readFileSync(join(root, path), "utf8"));
  const audit = read("sources/isfahan/timetable-candidate-review-2026-10-31.json");
  const corrections = read("sources/isfahan/timetable-reviewed-corrections.json");
  if (audit.reviewOnly !== true || audit.readyForProduction !== false || corrections.reviewOnly !== true || corrections.productionEtaApproved !== false) fail("invalid source review boundary");
  const raw = readFileSync(csvPath), sha256 = createHash("sha256").update(raw).digest("hex");
  if (sha256 !== audit.uploadedInputs.find((i: { fileName: string }) => i.fileName === "stop_times.csv")?.sha256) fail("uploaded CSV hash mismatch");
  const result = normalizeIsfahanTimetable(parseTimetableCSV(raw.toString("utf8")), {
    crosswalk: audit.stationIdCrosswalk, images: audit.operatorReference.images, inputSha256: sha256,
    addedTrips: corrections.addedTrips, conditionalDispatches: corrections.conditionalDispatches,
  });
  if (JSON.stringify(result.counts) !== JSON.stringify({ trips: 283, scheduledTrips: 278, conditionalTrips: 5, stationTimes: 5236, blackSourceCells: 424 })) fail("unexpected complete candidate counts");
  // Require the independently regenerated pixel audit, rather than certifying the
  // original offset reconstruction merely because its shape/counts are correct.
  const summary = read("sources/isfahan/timetable-cell-audit-summary.json");
  const reportBytes = readFileSync(join(root, ".quality-report/isfahan-source-cell-audit.json"));
  if (createHash("sha256").update(reportBytes).digest("hex") !== summary.reportSha256 || summary.inputSha256 !== sha256 || summary.reviewOnly !== true || summary.productionEtaApproved !== false) fail("source-cell audit hash/scope mismatch; regenerate the pinned audit first");
  const cells: { poster: string; direction: string; sourceDataRow: number; stationId: string; sourceCellValue: string | null; bbox: number[]; verification: string }[] = JSON.parse(reportBytes.toString("utf8")).cells;
  const byCell = new Map(cells.map(c => [`${c.poster}|${c.direction}|${c.sourceDataRow}|${c.stationId}`, c]));
  for (const trip of [...result.scheduledTrips, ...result.conditionalTrips]) {
    const poster = trip.serviceId === "friday" ? "friday" : "weekday";
    trip.source.sourceCellAuditSha256 = summary.reportSha256;
    for (const stop of trip.stops) {
      const cell = byCell.get(`${poster}|${trip.direction}|${trip.sourceRow}|${stop.stationId}`);
      if (!cell || cell.sourceCellValue !== stop.publishedTime) fail("candidate time differs from audited source cell");
      stop.verification = cell.verification; stop.imageBbox = cell.bbox;
    }
  }
  return { ...result, sourceCellAudit: summary };
}
