import { describe, expect, it } from "vitest";
import { validateContributionDoc } from "../validators/contributions.js";

const cityIds = new Set(["tehran"]);

const valid = {
  id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  city: "tehran",
  entityType: "station",
  entityId: "tehran:station:tajrish",
  changeType: "update",
  operations: [
    {
      op: "set",
      path: "/amenities/elevator",
      value: true,
      note: "Elevator observed in service.",
      evidence: "https://example.org/photos/tajrish-elevator.jpg",
    },
  ],
  submittedBy: "github_username",
  submittedAt: "2026-09-11T12:00:00Z",
  status: "pending",
};

describe("contribution proposals", () => {
  it("accepts a valid proposal", () => {
    expect(validateContributionDoc(valid, `contributions/pending/${valid.id}.json`, cityIds)).toEqual([]);
  });

  it("rejects missing fields and unknown cities", () => {
    const { id: _dropped, ...rest } = valid;
    expect(validateContributionDoc(rest, "contributions/pending/x.json", cityIds).join("\n")).toMatch(
      /missing required field id/,
    );
    expect(
      validateContributionDoc({ ...valid, city: "atlantis" }, "contributions/pending/y.json", cityIds).join("\n"),
    ).toMatch(/unknown city/);
  });

  it("rejects bad entity ids, types, and contributor fields", () => {
    expect(
      validateContributionDoc({ ...valid, entityId: "Tajrish" }, "contributions/pending/y.json", cityIds).join("\n"),
    ).toMatch(/invalid entityId/);
    expect(
      validateContributionDoc({ ...valid, entityType: "timetable" }, "contributions/pending/y.json", cityIds).join(
        "\n",
      ),
    ).toMatch(/invalid entityType/);
    expect(
      validateContributionDoc({ ...valid, submittedBy: "" }, "contributions/pending/y.json", cityIds).join("\n"),
    ).toMatch(/submittedBy/);
  });

  it("rejects unknown operations and non-allowlisted paths", () => {
    const badOp = { ...valid, operations: [{ op: "teleport", path: "/amenities/elevator", value: true }] };
    expect(validateContributionDoc(badOp, "contributions/pending/y.json", cityIds).join("\n")).toMatch(
      /unknown operation/,
    );
    const badPath = { ...valid, operations: [{ op: "set", path: "/amenities/escalator", value: true }] };
    expect(validateContributionDoc(badPath, "contributions/pending/y.json", cityIds).join("\n")).toMatch(
      /not allowlisted/,
    );
    const badEvidence = {
      ...valid,
      operations: [{ op: "set", path: "/amenities/elevator", value: true, evidence: "photos/elevator.jpg" }],
    };
    expect(validateContributionDoc(badEvidence, "contributions/pending/y.json", cityIds).join("\n")).toMatch(
      /http\(s\)/,
    );
  });

  it("enforces the <id>.json filename convention", () => {
    expect(validateContributionDoc(valid, "contributions/pending/wrong-name.json", cityIds).join("\n")).toMatch(
      /filename must be/,
    );
  });
});
