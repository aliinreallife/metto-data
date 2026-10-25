import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createIntakeHandler,
  publicBody,
  type IntakeConfig,
  type PrivateStore,
  type StoredReport,
} from "../apps/data-portal/lib/intake.js";
import {
  makeCredit,
  verifyCredit,
  validPublicName,
} from "../apps/data-portal/lib/credit.js";
import { rankCredits } from "../apps/data-portal/lib/leaderboard.js";
import { previewStore } from "../apps/data-portal/lib/preview-store.js";
const secret = "test-only-credit-signing-secret";
const id = "12345678-1234-4123-8123-123456789abc",
  other = "12345678-1234-4123-8123-123456789abd";
function memory(): PrivateStore {
  const rows = new Map<string, { value: unknown; etag: string }>();
  let revision = 0;
  return {
    async read<T>(path: string) {
      const row = rows.get(path);
      return row
        ? { value: structuredClone(row.value) as T, etag: row.etag }
        : null;
    },
    async write(path, value, expected) {
      const old = rows.get(path);
      if (
        (expected === null && old) ||
        (expected !== null && old?.etag !== expected)
      )
        return false;
      rows.set(path, {
        value: structuredClone(value),
        etag: String(++revision),
      });
      return true;
    },
    async remove(path, expected) {
      if (rows.get(path)?.etag !== expected) return false;
      return rows.delete(path);
    },
    async paths(prefix) {
      return {
        paths: [...rows.keys()].filter((path) => path.startsWith(prefix)),
      };
    },
  };
}
const base = {
  id,
  cityId: "mashhad",
  stationId: "mashhad:station:basij",
  kind: "facility",
  details: "Observed elevator",
  name: "Private contact",
  contact: "private@example.test",
};
function request(payload: unknown) {
  return new Request("https://data.example.test/api/reports", {
    method: "POST",
    headers: {
      Origin: "https://data.example.test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}
function config(store = memory()): IntakeConfig {
  return {
    store,
    githubToken: "",
    quotaSecret: secret,
    publicOrigin: "https://data.example.test",
    cityStations: { mashhad: ["mashhad:station:basij"] },
  };
}
it("requires server-verified identity and an explicit public alias; client identity fields cannot claim credit", async () => {
  const c = config();
  c.creditSecret = "dedicated-test-credit-key";
  const handler = createIntakeHandler(c);
  expect(
    (
      await handler(
        request({
          ...base,
          publicCredit: true,
          publicName: "Public alias",
          contributor: { id: "forged", name: "Fake" },
        }),
      )
    ).status,
  ).toBe(401);
  c.resolveContributor = async () => ({
    id: "verified-user-id",
    name: "private-provider-email@example.test",
  });
  expect(
    (
      await handler(
        request({
          ...base,
          publicCredit: true,
          publicName: "private@example.test",
        }),
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await handler(
        request({
          ...base,
          publicCredit: true,
          publicName: "Public alias",
          contributor: { id: "forged", name: "Fake" },
        }),
      )
    ).status,
  ).toBe(202);
  const row = await c.store.read<StoredReport>(`submissions/${id}.json`);
  expect(row?.value.report.credit).toEqual(
    makeCredit(
      id,
      { id: "verified-user-id", name: "Public alias" },
      c.creditSecret!,
    ),
  );
  const body = publicBody(row!.value.report, c.publicOrigin);
  expect(body).not.toContain("private@example.test");
  expect(body).not.toContain("private-provider-email");
  expect(body).not.toContain("verified-user-id");
  expect(body).not.toContain("Private contact");
  expect(body).toContain("Public alias");
  c.resolveContributor = async () => null;
  expect(
    (
      await handler(
        request({
          ...base,
          id: other,
          publicCredit: true,
          publicName: "Other",
        }),
      )
    ).status,
  ).toBe(401);
});
it("does not attach public credit to anonymous reports, even when optional contact is supplied", async () => {
  const c = config();
  expect((await createIntakeHandler(c)(request(base))).status).toBe(202);
  const row = await c.store.read<StoredReport>(`submissions/${id}.json`);
  expect(row?.value.report.credit).toBeUndefined();
  expect(publicBody(row!.value.report, c.publicOrigin)).not.toContain(
    "Private contact",
  );
});
it("binds public credit to the report and ignores forged identities, duplicate reports and closed-only acceptance", () => {
  const credit = makeCredit(id, { id: "one-user", name: "Alias" }, secret);
  expect(verifyCredit(id, credit, secret)).toBe(true);
  expect(verifyCredit(other, credit, secret)).toBe(false);
  expect(validPublicName("@someone")).toBe(false);
  expect(validPublicName("Public rider")).toBe(true);
  expect(validPublicName("علی مترو")).toBe(true);
  expect(validPublicName("Public\nname")).toBe(false);
  const issue = (reportId: string, c: unknown, accepted = false) => ({
    body: `<!-- metto-data-report:${Buffer.from(JSON.stringify({ id: reportId, credit: c })).toString("base64")} -->`,
    html_url: `https://github.com/aliinreallife/metto-data/issues/${reportId === id ? 1 : 2}`,
    title: "Public report",
    labels: accepted ? [{ name: "data:accepted" }] : [],
    state: "closed",
  });
  expect(rankCredits([issue(id, credit)], secret)[0].accepted).toBe(0);
  const rows = rankCredits(
    [
      issue(id, credit),
      issue(id, credit, true),
      issue(other, { ...credit, name: "Forged" }, true),
    ],
    secret,
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].accepted).toBe(1);
  expect(rows[0].reports).toHaveLength(1);
});
it("isolates preview reports and outbox records from the production publisher", async () => {
  const parent = memory(),
    isolated = previewStore(parent, "deployment-test"),
    c = config(isolated);
  expect((await createIntakeHandler(c)(request(base))).status).toBe(202);
  expect((await parent.paths("submissions/")).paths).toEqual([]);
  expect((await parent.paths("outbox/")).paths).toEqual([]);
  expect((await isolated.paths("submissions/")).paths).toEqual([
    `submissions/${id}.json`,
  ]);
  expect(await isolated.read(`submissions/${id}.json`)).not.toBeNull();
});

it("keeps structured station/direction/exit wagon context with a fixed verified train count", async () => {
  const c = config(),
    handler = createIntakeHandler(c);
  c.validateWagon = (wagon, station) =>
    station === base.stationId &&
    wagon.destinationId === "mashhad:station:airport" &&
    wagon.exitId === "up-escalator";
  const wagon = {
    car: 2,
    cars: 3,
    profileId: "mashhad:line1:3",
    lineId: "mashhad:line:1",
    routeId: "mashhad:route:line-1-main",
    destinationId: "mashhad:station:airport",
    exitId: "up-escalator",
  };
  expect(
    (
      await handler(
        request({
          ...base,
          kind: "wagon",
          details: "واگن ۲ نزدیک پله‌برقی رو به بالاست.",
          wagon,
        }),
      )
    ).status,
  ).toBe(202);
  const row = await c.store.read<StoredReport>("submissions/" + id + ".json");
  expect(row?.value.report.wagon).toEqual(wagon);
  const body = publicBody(row!.value.report, c.publicOrigin);
  expect(body).toContain("واگن ۲");
  expect(body).not.toContain("Not specified");
  expect(body).not.toContain("Source:");
  for (const changed of [
    { ...wagon, cars: 4 },
    { ...wagon, car: 4 },
    { ...wagon, profileId: "tehran:urban:7" },
    { ...wagon, exitId: "invented-exit" },
  ]) {
    expect(
      (
        await handler(
          request({ ...base, id: other, kind: "wagon", wagon: changed }),
        )
      ).status,
    ).toBe(400);
  }
});
