// Contribution proposal checks (see contributions/schema.json).
// Operates on proposal files only — never mutates data/cities/* or overrides/*.
import { readFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENTITY_ID_RE = /^[a-z0-9-]+:(station|line|segment|route|transfer):.+/;
const AMENITY_KEYS = new Set([
  "wc", "elevator", "atm", "coffeeShop", "fastFood", "groceryStore",
  "freeWifi", "prayerRoom", "parking", "police",
]);

const REQUIRED_FIELDS = [
  "id", "city", "entityType", "entityId", "changeType",
  "operations", "submittedBy", "submittedAt", "status",
];

/** Allowlisted operation paths per entity type (mirrors contributions/schema.json). */
function isAllowedPath(entityType: string, path: string): boolean {
  if (entityType === "station") {
    if (path === "/status" || path === "/location/lat" || path === "/location/lng") return true;
    if (path === "/name/fa" || path === "/name/en" || path === "/names/fa" || path === "/names/en") return true;
    if (path.startsWith("/amenities/")) return AMENITY_KEYS.has(path.slice("/amenities/".length));
    return false;
  }
  if (entityType === "line") {
    return (
      path === "/color" ||
      path === "/name/fa" || path === "/name/en" ||
      path === "/names/fa" || path === "/names/en"
    );
  }
  if (entityType === "connection") return path === "/status";
  if (entityType === "transfer") return path === "/walkSeconds";
  return false;
}

function checkValue(path: string, value: unknown): string | null {
  if (path.startsWith("/amenities/")) {
    return value === true || value === false || value === null
      ? null
      : "amenity value must be true|false|null";
  }
  if (path === "/walkSeconds") {
    return typeof value === "number" && Number.isFinite(value) && value > 0
      ? null
      : "walkSeconds must be a positive number";
  }
  if (path === "/location/lat" || path === "/location/lng") {
    return typeof value === "number" && Number.isFinite(value) ? null : "value must be a number";
  }
  if (path === "/color") {
    return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value) ? null : "color must be #RRGGBB";
  }
  if (path === "/status" || path === "/name/fa" || path === "/name/en" || path === "/names/fa" || path === "/names/en") {
    return typeof value === "string" && value.length > 0 ? null : "value must be a non-empty string";
  }
  return null;
}

/**
 * Validate one parsed proposal document. Returns error strings (empty = valid).
 * `label` identifies the file in messages (e.g. `contributions/pending/<file>`).
 */
export function validateContributionDoc(
  doc: unknown,
  label: string,
  cityIds: Set<string>,
): string[] {
  const errors: string[] = [];
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) {
    return [`${label}: proposal must be a JSON object`];
  }
  const d = doc as Record<string, unknown>;

  for (const field of REQUIRED_FIELDS) {
    if (!(field in d)) errors.push(`${label}: missing required field ${field}`);
  }
  if (typeof d.id !== "string" || !UUID_RE.test(d.id)) {
    errors.push(`${label}: invalid id ${JSON.stringify(d.id)} (expected UUID)`);
  } else if (basename(label) !== `${d.id}.json`) {
    errors.push(`${label}: filename must be ${d.id}.json`);
  }
  if (typeof d.city !== "string" || !cityIds.has(d.city)) {
    errors.push(`${label}: unknown city ${JSON.stringify(d.city)}`);
  }
  if (d.entityType !== "station" && d.entityType !== "line" && d.entityType !== "connection" && d.entityType !== "transfer") {
    errors.push(`${label}: invalid entityType ${JSON.stringify(d.entityType)}`);
  }
  if (typeof d.entityId !== "string" || !ENTITY_ID_RE.test(d.entityId)) {
    errors.push(`${label}: invalid entityId ${JSON.stringify(d.entityId)}`);
  }
  if (d.changeType !== "update" && d.changeType !== "add" && d.changeType !== "remove") {
    errors.push(`${label}: invalid changeType ${JSON.stringify(d.changeType)}`);
  }
  if (typeof d.submittedBy !== "string" || d.submittedBy.length === 0) {
    errors.push(`${label}: missing contributor submittedBy`);
  }
  if (typeof d.submittedAt !== "string" || Number.isNaN(Date.parse(d.submittedAt))) {
    errors.push(`${label}: invalid submittedAt ${JSON.stringify(d.submittedAt)}`);
  }
  if (d.status !== "pending" && d.status !== "approved" && d.status !== "rejected" && d.status !== "needs-info") {
    errors.push(`${label}: invalid status ${JSON.stringify(d.status)}`);
  }

  if (!Array.isArray(d.operations) || d.operations.length === 0) {
    errors.push(`${label}: operations must be a non-empty array`);
  } else {
    const entityType = typeof d.entityType === "string" ? d.entityType : "";
    d.operations.forEach((op: unknown, i: number) => {
      const where = `${label}: operations[${i}]`;
      if (typeof op !== "object" || op === null || Array.isArray(op)) {
        errors.push(`${where}: must be an object`);
        return;
      }
      const o = op as Record<string, unknown>;
      if (o.op !== "set" && o.op !== "add" && o.op !== "remove") {
        errors.push(`${where}: unknown operation ${JSON.stringify(o.op)}`);
      }
      if (typeof o.path !== "string" || !isAllowedPath(entityType, o.path)) {
        errors.push(`${where}: path ${JSON.stringify(o.path)} is not allowlisted for ${entityType || "unknown entity"}`);
        return;
      }
      if (!("value" in o)) {
        errors.push(`${where}: missing value`);
        return;
      }
      const bad = checkValue(o.path, o.value);
      if (bad) errors.push(`${where}: ${bad}`);
      if (o.evidence !== undefined && (typeof o.evidence !== "string" || !/^https?:\/\//.test(o.evidence))) {
        errors.push(`${where}: evidence must be an http(s) URL`);
      }
    });
  }

  if (d.review !== undefined) {
    if (typeof d.review !== "object" || d.review === null || Array.isArray(d.review)) {
      errors.push(`${label}: review must be an object`);
    } else {
      const r = d.review as Record<string, unknown>;
      for (const key of ["decidedBy", "decidedAt", "reason", "appliedInBuild"] as const) {
        if (r[key] !== undefined && typeof r[key] !== "string") {
          errors.push(`${label}: review.${key} must be a string`);
        }
      }
      if (r.decidedAt !== undefined && Number.isNaN(Date.parse(r.decidedAt as string))) {
        errors.push(`${label}: review.decidedAt is not a valid date-time`);
      }
    }
  }
  return errors;
}

/** Validate every *.json file in one contributions queue directory. Missing dir = no proposals = valid. */
export function validateContributionsDir(
  repoRoot: string,
  queue: "pending" | "approved" | "rejected",
  cityIds: Set<string>,
): string[] {
  const errors: string[] = [];
  let files: string[];
  try {
    files = readdirSync(join(repoRoot, "contributions", queue)).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  for (const file of files) {
    const label = `contributions/${queue}/${file}`;
    let doc: unknown;
    try {
      doc = JSON.parse(readFileSync(join(repoRoot, "contributions", queue, file), "utf8"));
    } catch (e) {
      errors.push(`${label}: invalid JSON (${(e as Error).message})`);
      continue;
    }
    errors.push(...validateContributionDoc(doc, label, cityIds));
  }
  return errors;
}
