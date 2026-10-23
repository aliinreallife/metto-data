// Approval binds a human review to the exact generated dataset, not just a
// mutable releaseStatus flag. Legacy Tehran keeps its existing release policy.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FILES = ["city.json", "agencies.json", "networks.json", "stations.json", "lines.json", "graph.json", "meta.json"];

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, item]) => [key, canonical(item)]));
  }
  return value;
}

/** Stable over formatting and build time, sensitive to every published fact. */
export function datasetFingerprint(root: string, city: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(city)) throw new Error("invalid city ID");
  const files = Object.fromEntries(FILES.map((name) => {
    const value = JSON.parse(readFileSync(join(root, "data", "cities", city, name), "utf8"));
    if (name === "meta.json" && value && typeof value === "object" && !Array.isArray(value)) {
      delete value.generatedAt;
    }
    return [name, value];
  }));
  return createHash("sha256").update(JSON.stringify(canonical(files))).digest("hex");
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

export function checkReleaseReview(
  city: string,
  source: { releaseStatus?: unknown; repository?: unknown; pinnedCommit?: unknown },
  metaStatus: unknown,
  review: unknown,
  fingerprint: string,
): string[] {
  const errors: string[] = [];
  if (source.releaseStatus !== metaStatus) {
    errors.push(`${city}: release status in meta.json disagrees with sources.json`);
  }
  if (source.releaseStatus === "candidate") {
    errors.push(`city ${city}: candidate dataset is not approved for release`);
  } else if (source.releaseStatus !== "verified" && !(city === "tehran" && source.releaseStatus === undefined)) {
    errors.push(`${city}: explicit releaseStatus=verified is required`);
  }
  if (city === "tehran") return errors;

  const doc = record(review);
  if (!doc || doc.city !== city || doc.reviewStatus !== "approved") {
    errors.push(`${city}: source review is missing or unapproved`);
  }
  if (!Array.isArray(doc?.criticalOutstanding) || doc.criticalOutstanding.length !== 0) {
    errors.push(`${city}: critical source-review blockers remain or are undeclared`);
  }
  const sources = doc?.sources;
  if (!Array.isArray(sources) || !sources.some((item: unknown) => {
    const s = record(item);
    return s?.url === source.repository && s?.pinnedCommit === source.pinnedCommit;
  })) errors.push(`${city}: source review does not match the pinned upstream revision`);

  const approval = record(doc?.approval);
  if (typeof approval?.reviewedBy !== "string" || !approval.reviewedBy.trim() ||
      typeof approval?.reviewedAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T/.test(approval.reviewedAt) || !Number.isFinite(Date.parse(approval.reviewedAt))) {
    errors.push(`${city}: dated maintainer approval is required`);
  }
  if (!/^[a-f0-9]{64}$/.test(fingerprint) || approval?.datasetSha256 !== fingerprint) {
    errors.push(`${city}: approval does not cover the current dataset SHA-256`);
  }
  return errors;
}

/** Missing or malformed review JSON is deliberately unapproved. */
export function readCityReview(root: string, city: string): unknown {
  try {
    return JSON.parse(readFileSync(join(root, "sources", city, "review.json"), "utf8"));
  } catch {
    return null;
  }
}
