import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { reviewedReports } from "../apps/data-portal/lib/reports.js";
import community from "../data/reference/community-contributions.json" with { type: "json" };
it("credits the owner's real reviewed correction without inventing a signed submission or fake popularity", () => {
  const entry = community.entries[0],
    report = reviewedReports[0];
  const graph = JSON.parse(
    readFileSync(
      new URL("../data/cities/tehran/graph.json", import.meta.url),
      "utf8",
    ),
  );
  for (const [routeId, status] of Object.entries(entry.routeStatuses)) {
    expect(
      graph.routes
        .find((r: { id: string }) => r.id === routeId)
        .stops.find(
          (s: { stationId: string }) => s.stationId === entry.stationId,
        ).status,
    ).toBe(status);
  }
  expect(report.contributorName).toBe("علی رشیدی");
  expect(report.verified).toBe(true);
  expect(report.title).toBe("۱۷ شهریور فعلاً فقط در خط ۷ فعاله.");
  expect(report.url).toContain("/62bd3f6992e55b49f63e04b68d8fec56ecf42e90/");
  expect(report).not.toHaveProperty("votes");
});
