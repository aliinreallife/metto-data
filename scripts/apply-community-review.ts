import {
  readFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { validateContributionDoc } from "../validators/contributions.js";
export function applyCommunityReview(root: string, proposal: unknown) {
  const p = proposal as {
    document?: Record<string, unknown> | null;
    id?: string;
    manual?: boolean;
  };
  if (!p.document)
    return { applied: false, manual: true, reason: "unsupported-report-type" };
  const d = p.document,
    city = String(d.city),
    stationId = String(d.entityId),
    id = String(d.id);
  const cityIds = new Set(
    Object.keys(JSON.parse(readFileSync(join(root, "sources.json"), "utf8"))),
  );
  const label = "contributions/approved/" + id + ".json";
  const errors = validateContributionDoc(d, label, cityIds);
  if (
    errors.length ||
    d.status !== "approved" ||
    d.entityType !== "station" ||
    d.changeType !== "update"
  )
    throw Error("Invalid approved review document");
  const operations = d.operations as {
    op: string;
    path: string;
    value: unknown;
  }[];
  if (
    operations.some(
      (op) =>
        op.op !== "set" ||
        !/^\/amenities\/[a-zA-Z]+$/.test(op.path) ||
        typeof op.value !== "boolean",
    )
  )
    throw Error("Only structured amenity booleans can be automated");
  const stations = JSON.parse(
    readFileSync(join(root, "data", "cities", city, "stations.json"), "utf8"),
  ) as { id: string; amenities: Record<string, unknown> }[];
  const station = stations.find((s) => s.id === stationId);
  if (
    !station ||
    operations.some(
      (op) => !Object.hasOwn(station.amenities, op.path.slice(11)),
    )
  )
    throw Error("Unknown station or amenity");
  const dir = join(root, "contributions", "approved");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, id + ".json");
  if (existsSync(path)) {
    const old = JSON.parse(readFileSync(path, "utf8"));
    if (
      old.id === d.id &&
      old.city === d.city &&
      old.entityId === d.entityId &&
      JSON.stringify(old.operations) === JSON.stringify(d.operations)
    )
      return { applied: true, manual: !!p.manual, unchanged: true };
    return {
      applied: false,
      manual: true,
      reason: "existing-proposal-conflict",
    };
  }
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const old = JSON.parse(readFileSync(join(dir, file), "utf8"));
    if (
      old.entityId === stationId &&
      old.entityType === "station" &&
      old.operations?.some((previous: { path: string; value: unknown }) =>
        operations.some(
          (op) =>
            op.path === previous.path &&
            JSON.stringify(op.value) !== JSON.stringify(previous.value),
        ),
      )
    )
      return {
        applied: false,
        manual: true,
        reason: "conflicting-approved-change",
      };
  }
  writeFileSync(path, JSON.stringify(d, null, 2) + "\n");
  return { applied: true, manual: !!p.manual, unchanged: false };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const { values } = parseArgs({
    options: { input: { type: "string" }, root: { type: "string" } },
  });
  if (!values.input) throw Error("An approved review input file is required");
  console.log(
    JSON.stringify(
      applyCommunityReview(
        resolve(values.root ?? "."),
        JSON.parse(readFileSync(values.input, "utf8")),
      ),
    ),
  );
}
