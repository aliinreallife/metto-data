import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkReleaseReview, datasetFingerprint } from "../validators/release-review.js";

// Synthetic approval fixtures exercise the gate. They are not city evidence.
const source = {
  releaseStatus: "verified", repository: "https://github.com/example/transit",
  pinnedCommit: "a".repeat(40),
};
const hash = "b".repeat(64);
const approved = () => ({
  city: "mashhad", reviewStatus: "approved", criticalOutstanding: [],
  sources: [{ url: source.repository, pinnedCommit: source.pinnedCommit }],
  approval: { reviewedBy: "test-reviewer", reviewedAt: "2026-10-23T12:00:00Z", datasetSha256: hash },
});
const check = (review: unknown) => checkReleaseReview("mashhad", source, "verified", review, hash);

describe("release review is independent of the release flag", () => {
  it("rejects promotion when the existing Mashhad review is still unresolved", () => {
    const review = JSON.parse(readFileSync(new URL("../sources/mashhad/review.json", import.meta.url), "utf8"));
    const actualSource = JSON.parse(readFileSync(new URL("../sources.json", import.meta.url), "utf8")).mashhad;
    const errors = checkReleaseReview("mashhad", { ...actualSource, releaseStatus: "verified" }, "verified", review, hash);
    expect(errors.join("\n")).toMatch(/unapproved/);
    expect(errors.join("\n")).toMatch(/critical source-review blockers/);
  });

  it("rejects deleting the candidate flag or mismatching generated metadata", () => {
    expect(checkReleaseReview("mashhad", { ...source, releaseStatus: undefined }, undefined, approved(), hash).join("\n"))
      .toMatch(/explicit releaseStatus/);
    expect(checkReleaseReview("mashhad", source, "candidate", approved(), hash).join("\n"))
      .toMatch(/meta.json disagrees/);
  });

  it.each([null, [], {}, { ...approved(), city: "other" }, { ...approved(), criticalOutstanding: undefined }])
    ("rejects missing or malformed review records (%j)", (review) => {
      expect(check(review).length).toBeGreaterThan(0);
    });

  it("requires an explicit empty blocker list and a dated maintainer decision", () => {
    const review = approved();
    expect(check({ ...review, criticalOutstanding: ["Unverified Line 3 boarding"] }).join("\n"))
      .toMatch(/critical source-review blockers/);
    expect(check({ ...review, approval: { ...review.approval, reviewedBy: " " } }).join("\n"))
      .toMatch(/maintainer approval/);
    expect(check({ ...review, approval: { ...review.approval, reviewedAt: "invalid" } }).join("\n"))
      .toMatch(/maintainer approval/);
  });

  it("invalidates approval for a changed source or generated payload", () => {
    const review = approved();
    expect(check({ ...review, sources: [{ url: source.repository, pinnedCommit: "c".repeat(40) }] }).join("\n"))
      .toMatch(/pinned upstream revision/);
    expect(check({ ...review, approval: { ...review.approval, datasetSha256: "c".repeat(64) } }).join("\n"))
      .toMatch(/current dataset SHA-256/);
    expect(check(review)).toEqual([]);
  });

  it("keeps Tehran's existing policy while still rejecting candidate Tehran", () => {
    expect(checkReleaseReview("tehran", {}, undefined, null, "")).toEqual([]);
    expect(checkReleaseReview("tehran", { releaseStatus: "candidate" }, "candidate", null, "").join("\n"))
      .toMatch(/candidate dataset/);
  });

  it("fingerprints every dataset field except generatedAt, independent of formatting", () => {
    const root = mkdtempSync(join(tmpdir(), "release-review-"));
    const dir = join(root, "data/cities/example");
    mkdirSync(dir, { recursive: true });
    try {
      const files = ["city.json", "agencies.json", "networks.json", "stations.json", "lines.json", "graph.json"];
      for (const file of files) writeFileSync(join(dir, file), JSON.stringify({ id: file }));
      const meta = { cityId: "example", generatedAt: "2026-10-22", releaseStatus: "verified" };
      writeFileSync(join(dir, "meta.json"), JSON.stringify(meta));
      const first = datasetFingerprint(root, "example");
      writeFileSync(join(dir, "meta.json"), JSON.stringify({ ...meta, generatedAt: "2026-10-23" }, null, 2));
      expect(datasetFingerprint(root, "example")).toBe(first);
      for (const file of [...files, "meta.json"]) {
        const before = readFileSync(join(dir, file), "utf8");
        const value = JSON.parse(before);
        writeFileSync(join(dir, file), JSON.stringify({ ...value, changed: true }));
        expect(datasetFingerprint(root, "example"), file).not.toBe(first);
        writeFileSync(join(dir, file), before);
      }
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
