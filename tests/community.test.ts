import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from "jose";
import {
  createCommunityHandler,
  publicCommunity,
  notifyCommunityReviews,
  communityPath,
  type CommunityState,
} from "../apps/data-portal/lib/community.ts";
import { prepareCommunityReview } from "../apps/data-portal/lib/community-review.ts";
import {
  createIntakeHandler,
  publicBody,
  type IntakeConfig,
  type PrivateStore,
  type StoredReport,
} from "../apps/data-portal/lib/intake.ts";
import { verifyReviewWorkflowToken } from "../apps/data-portal/lib/workflow-auth.ts";
import { safeReportReturn } from "../apps/data-portal/lib/auth/return-to.ts";
import { applyCommunityReview } from "../scripts/apply-community-review.js";
import { buildTehran } from "../importers/tehran.js";
import { createFixture, cleanupFixtures, repoRoot } from "./fixtures.js";
afterEach(cleanupFixtures);
class MemoryStore implements PrivateStore {
  rows = new Map<string, { value: unknown; etag: string }>();
  version = 0;
  async read<T>(path: string) {
    const row = this.rows.get(path);
    return row
      ? { value: structuredClone(row.value) as T, etag: row.etag }
      : null;
  }
  async write(path: string, value: unknown, expected: string | null) {
    const row = this.rows.get(path);
    if (
      (expected === null && row) ||
      (expected !== null && row?.etag !== expected)
    )
      return false;
    this.rows.set(path, {
      value: structuredClone(value),
      etag: String(++this.version),
    });
    return true;
  }
  async remove(path: string, expected: string) {
    if (this.rows.get(path)?.etag !== expected) return false;
    this.rows.delete(path);
    return true;
  }
  async paths(prefix: string) {
    return {
      paths: [...this.rows.keys()].filter((path) => path.startsWith(prefix)),
    };
  }
}
const id = "a2345678-1234-4123-8123-123456789abc",
  origin = "https://data.example.org",
  station = "tehran:station:tajrish";
const issueUrl = "https://github.com/aliinreallife/metto-data/issues/101";
async function fixture() {
  const store = new MemoryStore(),
    calls: { url: string; init: RequestInit }[] = [];
  const saved: StoredReport = {
    inputHash: "hash",
    createdAt: "2026-10-24T09:00:00Z",
    state: "published",
    issueUrl,
    report: {
      id,
      cityId: "tehran",
      stationId: station,
      kind: "facility",
      subject: "Amenities",
      details: "The elevator works",
      source: "Visited today",
      name: "Private contact",
      contact: "secret@example.test",
      amenities: [{ key: "elevator", value: true }],
    },
  };
  const issue = {
    body: publicBody(saved.report, origin),
    labels: [{ name: "data:accepted" }],
    html_url: issueUrl,
  };
  const config: IntakeConfig = {
    store,
    publicOrigin: origin,
    githubToken: "ephemeral-job-token",
    creditSecret: "test-credit-secret",
    quotaSecret: "test-quota-secret",
    cityStations: { tehran: [station] },
    fetch: async (url, init = {}) => {
      calls.push({ url: String(url), init });
      return Response.json(issue);
    },
  };
  await store.write("submissions/" + id + ".json", saved, null);
  return { store, config, saved, issue, calls };
}
function voteRequest(choice: unknown, requestOrigin = origin) {
  return new Request(origin + "/api/community", {
    method: "POST",
    headers: { origin: requestOrigin, "Content-Type": "application/json" },
    body: JSON.stringify({ reportId: id, choice, userId: "forged-user" }),
  });
}
describe("community reports", () => {
  it("allows reads without login, exposes no contacts or voter IDs, and requires login and same origin for writes", async () => {
    const { config } = await fixture();
    const handle = createCommunityHandler(config, async () => null);
    const response = await handle(
      new Request(origin + "/api/community?report=" + id),
    );
    expect(response.status).toBe(200);
    const raw = await response.text();
    expect(raw).not.toMatch(
      /Private contact|secret@example|votes-|forged-user/,
    );
    expect((await handle(voteRequest("confirm"))).status).toBe(401);
    expect(
      (await handle(voteRequest("confirm", "https://evil.example"))).status,
    ).toBe(403);
    expect(
      (await handle(new Request(origin + "/api/community?report=invalid")))
        .status,
    ).toBe(404);
  });
  it("keeps one vote per server-authenticated account, supports switching/withdrawing and queues only matching distinct votes", async () => {
    const { config } = await fixture();
    let actor = "one";
    const handle = createCommunityHandler(config, async () => ({
      id: actor,
      name: "Rider",
    }));
    for (let i = 0; i < 4; i++)
      expect((await handle(voteRequest("confirm"))).status).toBe(200);
    expect(await publicCommunity(config, id, "one")).toMatchObject({
      confirm: 1,
      deny: 0,
      queued: false,
      myVote: "confirm",
    });
    actor = "two";
    await handle(voteRequest("deny"));
    actor = "three";
    await handle(voteRequest("confirm"));
    expect(await publicCommunity(config, id)).toMatchObject({
      confirm: 2,
      deny: 1,
      queued: false,
    });
    actor = "two";
    await handle(voteRequest("confirm"));
    expect(await publicCommunity(config, id)).toMatchObject({
      confirm: 3,
      deny: 0,
      queued: true,
      decision: null,
    });
    await handle(voteRequest(null));
    expect(await publicCommunity(config, id, "two")).toMatchObject({
      confirm: 2,
      queued: false,
      myVote: null,
    });
    expect((await handle(voteRequest("unknown"))).status).toBe(400);
  });
  it("notifies via idempotent GitHub assignment once, with no data application or duplicate comments", async () => {
    const { config, calls } = await fixture();
    for (const actor of ["a", "b", "c"])
      await createCommunityHandler(config, async () => ({
        id: actor,
        name: "Rider",
      }))(voteRequest("deny"));
    expect((await notifyCommunityReviews(config)).notified).toBe(1);
    expect((await notifyCommunityReviews(config)).notified).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      "https://api.github.com/repos/aliinreallife/metto-data/issues/101/assignees",
    );
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      assignees: ["aliinreallife"],
    });
    expect(await publicCommunity(config, id)).toMatchObject({
      deny: 3,
      notified: true,
      decision: null,
    });
  });
  it("does not expose pending/private reports or accept writes to a decided report", async () => {
    const { store, config, saved } = await fixture();
    await store.write(
      communityPath(id),
      { votes: {}, decision: "manual" } satisfies CommunityState,
      null,
    );
    const handle = createCommunityHandler(config, async () => ({
      id: "a",
      name: "Rider",
    }));
    expect((await handle(voteRequest("confirm"))).status).toBe(409);
    const old = await store.read<StoredReport>("submissions/" + id + ".json");
    await store.write(
      "submissions/" + id + ".json",
      { ...saved, state: "pending" },
      old!.etag,
    );
    expect(await publicCommunity(config, id)).toBeNull();
  });
  it("limits account vote changes while allowing an idempotent retry", async () => {
    const { config } = await fixture();
    const handle = createCommunityHandler(config, async () => ({
      id: "a",
      name: "Rider",
    }));
    for (let i = 0; i < 60; i++)
      expect(
        (await handle(voteRequest(i % 2 ? "deny" : "confirm"))).status,
      ).toBe(200);
    expect((await handle(voteRequest("deny"))).status).toBe(200);
    expect((await handle(voteRequest("confirm"))).status).toBe(429);
  });
  it("uses the saved account name and signs it instead of trusting a client public name", async () => {
    const { config, store } = await fixture();
    const newId = "b2345678-1234-4123-8123-123456789abc";
    const input = {
      id: newId,
      cityId: "tehran",
      stationId: station,
      kind: "facility",
      details: "The elevator works",
      amenities: [{ key: "elevator", value: true }],
      publicCredit: true,
      publicNameSource: "account",
      publicName: "Forged alias",
    };
    const req = () =>
      new Request(origin + "/api/reports", {
        method: "POST",
        headers: { origin, "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    const response = await createIntakeHandler({
      ...config,
      githubToken: "",
      resolveContributor: async () => ({
        id: "server-user",
        name: "Account rider",
      }),
    })(req());
    expect(response.status).toBe(202);
    const row = await store.read<StoredReport>(
      "submissions/" + newId + ".json",
    );
    expect(row!.value.report.credit?.name).toBe("Account rider");
    expect(row!.value.report.amenities).toEqual(input.amenities);
    expect(
      (
        await createIntakeHandler({
          ...config,
          resolveContributor: async () => ({
            id: "server-user",
            name: "private@example.test",
          }),
        })(req())
      ).status,
    ).toBe(400);
  });
});
describe("owner-approved changes", () => {
  it("requires explicit owner approval, never trusts public operations, and strips private information", async () => {
    const { config, issue } = await fixture();
    issue.labels = [];
    await expect(
      prepareCommunityReview(config, 101, "aliinreallife", "prepare"),
    ).rejects.toThrow("owner_approval");
    issue.labels = [{ name: "data:accepted" }];
    await expect(
      prepareCommunityReview(config, 101, "other-user", "prepare"),
    ).rejects.toThrow("owner_required");
    issue.body +=
      "\n<!-- metto-data-report:" +
      Buffer.from(
        JSON.stringify({ id, amenities: [{ key: "elevator", value: false }] }),
      ).toString("base64") +
      " -->";
    const result = await prepareCommunityReview(
      config,
      101,
      "aliinreallife",
      "prepare",
    );
    expect(result.document?.operations[0]).toMatchObject({
      path: "/amenities/elevator",
      value: true,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /secret@example|Private contact/,
    );
    expect(await publicCommunity(config, id)).toMatchObject({
      decision: "approved",
    });
    await expect(
      prepareCommunityReview(
        config,
        101,
        "aliinreallife",
        "applied",
        "invalid",
      ),
    ).rejects.toThrow("commit_required");
    await prepareCommunityReview(
      config,
      101,
      "aliinreallife",
      "applied",
      "a".repeat(40),
    );
    await prepareCommunityReview(config, 101, "aliinreallife", "manual");
    expect(await publicCommunity(config, id)).toMatchObject({
      decision: "applied",
    });
  });
  it("records rejection, refuses ambiguous labels, and keeps unsupported changes manual", async () => {
    const { config, issue, store, saved } = await fixture();
    issue.labels = [{ name: "data:rejected" }];
    await prepareCommunityReview(config, 101, "aliinreallife", "rejected");
    expect(await publicCommunity(config, id)).toMatchObject({
      decision: "rejected",
    });
    issue.labels.push({ name: "data:accepted" });
    await expect(
      prepareCommunityReview(config, 101, "aliinreallife", "prepare"),
    ).rejects.toThrow("owner_approval");
    issue.labels = [{ name: "data:accepted" }];
    const old = await store.read<StoredReport>("submissions/" + id + ".json");
    await store.write(
      "submissions/" + id + ".json",
      {
        ...saved,
        report: { ...saved.report, kind: "timetable", amenities: undefined },
      },
      old!.etag,
    );
    expect(
      await prepareCommunityReview(config, 101, "aliinreallife", "prepare"),
    ).toMatchObject({ document: null, manual: true, automatic: 0 });
  });
  it("writes only allowlisted approved amenity changes, rebuilds the station, is idempotent, and flags conflicts", async () => {
    const { config } = await fixture();
    const proposal = await prepareCommunityReview(
      config,
      101,
      "aliinreallife",
      "prepare",
    );
    const root = createFixture();
    mkdirSync(join(root, "data/cities/tehran"), { recursive: true });
    cpSync(
      join(repoRoot, "data/cities/tehran/stations.json"),
      join(root, "data/cities/tehran/stations.json"),
    );
    expect(applyCommunityReview(root, proposal)).toMatchObject({
      applied: true,
      unchanged: false,
    });
    expect(
      buildTehran(root).stations.find((s) => s.id === station)?.amenities
        .elevator,
    ).toBe(true);
    expect(applyCommunityReview(root, proposal)).toMatchObject({
      applied: true,
      unchanged: true,
    });
    const conflict = structuredClone(proposal);
    conflict.document!.id = "c2345678-1234-4123-8123-123456789abc";
    conflict.document!.operations[0].value = false;
    expect(applyCommunityReview(root, conflict)).toMatchObject({
      applied: false,
      manual: true,
    });
    const invalid = structuredClone(proposal);
    invalid.document!.operations[0].path = "/location/lat";
    expect(() => applyCommunityReview(root, invalid)).toThrow();
    const file = readFileSync(
      join(root, "contributions/approved/" + id + ".json"),
      "utf8",
    );
    expect(file).not.toMatch(/secret@example|Private contact/);
  });
  it("returns only to a contribution or report after login and strips arbitrary query parameters", () => {
    expect(
      safeReportReturn("/reports?report=" + id + "&lang=fa&token=secret"),
    ).toBe("/reports?report=" + id + "&lang=fa");
    for (const value of [
      "//evil.test",
      "https://evil.test/reports",
      "/account",
      "/reports\\evil",
    ])
      expect(safeReportReturn(value)).toBeNull();
  });
});
describe("owner approval workload identity", () => {
  let key: Parameters<SignJWT["sign"]>[0],
    keys: ReturnType<typeof createLocalJWKSet>;
  beforeAll(async () => {
    const pair = await generateKeyPair("RS256");
    key = pair.privateKey;
    keys = createLocalJWKSet({
      keys: [
        { ...(await exportJWK(pair.publicKey)), kid: "test", alg: "RS256" },
      ],
    });
  });
  const claims = {
    repository: "aliinreallife/metto-data",
    repository_id: "1366364947",
    repository_owner_id: "91134550",
    ref: "refs/heads/main",
    workflow_ref:
      "aliinreallife/metto-data/.github/workflows/community-review.yml@refs/heads/main",
    event_name: "issues",
    actor: "aliinreallife",
  };
  const sign = (overrides: Record<string, unknown> = {}) =>
    new SignJWT({ ...claims, ...overrides })
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setIssuer("https://token.actions.githubusercontent.com")
      .setAudience(origin)
      .setIssuedAt()
      .setNotBefore(Math.floor(Date.now() / 1000) - 5)
      .setExpirationTime("5m")
      .sign(key);
  it("accepts only the owner's exact default-branch issue approval workflow", async () => {
    expect(await verifyReviewWorkflowToken(await sign(), origin, keys)).toEqual(
      { actor: "aliinreallife" },
    );
    for (const changed of [
      { actor: "other" },
      { ref: "refs/pull/2/merge" },
      { event_name: "pull_request" },
      { repository: "fork/metto-data" },
      { repository_id: "wrong" },
      { repository_owner_id: "wrong" },
      {
        workflow_ref: claims.workflow_ref.replace(
          "community-review",
          "portal-maintenance",
        ),
      },
    ])
      await expect(
        verifyReviewWorkflowToken(await sign(changed), origin, keys),
      ).rejects.toThrow();
    await expect(
      verifyReviewWorkflowToken(
        await sign(),
        "https://elsewhere.example",
        keys,
      ),
    ).rejects.toThrow();
  });
});
