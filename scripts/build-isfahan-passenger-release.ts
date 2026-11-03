/** Explicit bounded release projection; historical review inputs stay unchanged. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { buildIsfahanTimetableCandidate } from "../importers/isfahan-timetable.js";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => JSON.parse(readFileSync(join(root, p), "utf8"));
const release = read("sources/isfahan/passenger-release.json");
const graph = readFileSync(join(root, ".quality-report/isfahan-candidate-graph.json"));
if (!release.productionAuthorized || createHash("sha256").update(graph).digest("hex") !== release.graphSha256) throw Error("Missing or stale release authorization");
const timetable = buildIsfahanTimetableCandidate(root, join(root, ".quality-report/isfahan-timetable-intake-2026-10-31/inputs/stop_times.csv"));
if (timetable.sourceCellAudit.reportSha256 !== release.sourceCellAuditSha256) throw Error("Changed source audit");
const audit = read("sources/isfahan/timetable-candidate-review-2026-10-31.json");
const stationIds = audit.stationIdCrosswalk.map((s: { stationId: string }) => s.stationId);
const output = { schemaVersion: 1, cityId: "isfahan", release,
  source: { pageUrl: audit.operatorReference.pageUrl, updatedJalali: audit.operatorReference.publishedUpdateJalali,
    images: audit.operatorReference.images, inputSha256: timetable.sourceCellAudit.inputSha256 },
  calendar: read("sources/isfahan/service-calendar-review.json"), stationIds,
  // Original source row/direction retained; station arrays always in canonical Qods→Defa order.
  trips: timetable.scheduledTrips.map(t => ({ id: t.id, serviceId: t.serviceId, direction: t.direction,
    sourceRow: t.sourceRow, terminalDeparture: t.terminalDeparture,
    times: stationIds.map((id: string) => t.stops.find(s => s.stationId === id)!.publishedTime) })),
};
const args = process.argv.slice(2);
if (args.length && (args.length !== 1 || args[0] !== "--write")) throw Error("Usage: build-isfahan-passenger-release.ts [--write]");
const target = join(root, args[0] === "--write" ? release.artifact : ".quality-report/isfahan-passenger-release.json");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(output, null, 2) + "\n");
console.log(`Isfahan bounded release: ${output.trips.length} regular runs; conditional trains excluded; holidays unconfirmed → ${target}`);
