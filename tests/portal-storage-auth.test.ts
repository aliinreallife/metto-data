import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from "jose";
import {
  createPostgresStore,
  PORTAL_MIGRATION,
} from "../apps/data-portal/lib/postgres-store.ts";
import { verifyWorkflowToken } from "../apps/data-portal/lib/workflow-auth.ts";
import {
  createIntakeHandler,
  type IntakeConfig,
  type StoredReport,
} from "../apps/data-portal/lib/intake.ts";
let db: PGlite;
const query = async (sql: string, params?: unknown[]) =>
  (await db.query<Record<string, unknown>>(sql, params)).rows;
const migrate = async () => {
  await db.exec("BEGIN;" + PORTAL_MIGRATION.join(";") + ";COMMIT;");
};
beforeAll(async () => {
  db = new PGlite();
  await migrate();
}, 30000);
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.exec("TRUNCATE metto_data_portal.objects");
});
describe("existing Postgres private intake storage", () => {
  it("applies the isolated migration twice without touching other tables", async () => {
    await db.exec(
      "CREATE TABLE IF NOT EXISTS public.previous_app_marker(value text)",
    );
    await migrate();
    expect(
      (
        await db.query(
          "SELECT to_regclass('public.previous_app_marker') AS table_name",
        )
      ).rows,
    ).toEqual([{ table_name: "previous_app_marker" }]);
  });
  it("stores private report fields and supports create-only writes", async () => {
    const store = createPostgresStore(query, migrate);
    expect(
      await store.write(
        "submissions/id.json",
        { contact: "private@example.org", photo: "/9j/2Q==" },
        null,
      ),
    ).toBe(true);
    expect(
      await store.write("submissions/id.json", { contact: "replace" }, null),
    ).toBe(false);
    const row = await store.read<{ contact: string }>("submissions/id.json");
    expect(row?.value.contact).toBe("private@example.org");
  });
  it("enforces compare-and-swap in SQL under concurrent updates", async () => {
    const store = createPostgresStore(query, migrate);
    await store.write("counter", { n: 0 }, null);
    const previous = await store.read("counter");
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, n) =>
        store.write("counter", { n: n + 1 }, previous!.etag),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await store.read("counter"))?.etag).not.toBe(previous?.etag);
  });
  it("paginates only matching outbox paths and removes by revision", async () => {
    const store = createPostgresStore(query, migrate);
    for (let i = 0; i < 13; i++)
      await store.write(
        `outbox/${String(i).padStart(2, "0")}.json`,
        { id: i },
        null,
      );
    await store.write("submissions/private.json", { contact: "private" }, null);
    const first = await store.paths("outbox/");
    expect(first.paths).toHaveLength(10);
    const next = await store.paths("outbox/", first.cursor);
    expect(next.paths).toHaveLength(3);
    const row = await store.read(first.paths[0]);
    expect(await store.remove(first.paths[0], "999")).toBe(false);
    expect(await store.remove(first.paths[0], row!.etag)).toBe(true);
  });
  it("denies ordinary database roles even if a future integration grants SELECT", async () => {
    await db.exec(
      "CREATE ROLE portal_anonymous; GRANT USAGE ON SCHEMA metto_data_portal TO portal_anonymous; GRANT SELECT ON metto_data_portal.objects TO portal_anonymous",
    );
    const store = createPostgresStore(query, migrate);
    await store.write("private", { contact: "secret" }, null);
    await db.exec("SET ROLE portal_anonymous");
    try {
      expect(
        (await db.query("SELECT * FROM metto_data_portal.objects")).rows,
      ).toEqual([]);
    } finally {
      await db.exec("RESET ROLE");
    }
  });
  it("accepts a report into the durable queue without a GitHub personal token", async () => {
    const store = createPostgresStore(query, migrate);
    let calls = 0;
    const config: IntakeConfig = {
      store,
      githubToken: "",
      quotaSecret: "private-generated-quota-key",
      publicOrigin: "https://portal.example",
      cityStations: { mashhad: [] },
      fetch: async () => {
        calls++;
        throw Error("must not publish");
      },
    };
    const id = "12345678-1234-4123-8123-123456789abc";
    const response = await createIntakeHandler(config)(
      new Request("https://portal.example/api/reports", {
        method: "POST",
        headers: {
          origin: "https://portal.example",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          cityId: "mashhad",
          kind: "timetable",
          details: "Observed board",
          name: "Private person",
          contact: "private@example.org",
        }),
      }),
    );
    expect(response.status).toBe(202);
    expect(calls).toBe(0);
    expect(
      (await store.read<StoredReport>(`submissions/${id}.json`))?.value.state,
    ).toBe("pending");
    expect(await store.read(`outbox/${id}.json`)).toBeTruthy();
    expect(await response.text()).not.toContain("private@example");
  });
});
describe("GitHub workload identity for publishing", () => {
  let signKey: Parameters<SignJWT["sign"]>[0],
    keySet: ReturnType<typeof createLocalJWKSet>;
  const claims = {
    repository: "aliinreallife/metto-data",
    repository_id: "1366364947",
    repository_owner_id: "91134550",
    ref: "refs/heads/main",
    workflow_ref:
      "aliinreallife/metto-data/.github/workflows/portal-maintenance.yml@refs/heads/main",
    event_name: "workflow_dispatch",
  };
  beforeAll(async () => {
    const pair = await generateKeyPair("RS256");
    signKey = pair.privateKey;
    keySet = createLocalJWKSet({
      keys: [
        { ...(await exportJWK(pair.publicKey)), kid: "test", alg: "RS256" },
      ],
    });
  });
  const sign = async (
    overrides: Record<string, unknown> = {},
    audience = "https://portal.example",
    expired = false,
  ) =>
    new SignJWT({ ...claims, ...overrides })
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setIssuer("https://token.actions.githubusercontent.com")
      .setAudience(audience)
      .setIssuedAt()
      .setNotBefore(Math.floor(Date.now() / 1000) - 5)
      .setExpirationTime(expired ? Math.floor(Date.now() / 1000) - 1 : "5m")
      .sign(signKey);
  it("accepts only the expected repository default-branch maintenance workflow", async () => {
    expect(
      await verifyWorkflowToken(await sign(), "https://portal.example", keySet),
    ).toBe(true);
  });
  it("rejects forks, pull requests, other workflows, wrong audience and expired credentials", async () => {
    for (const override of [
      { repository: "other/metto-data" },
      { repository_id: "wrong" },
      { repository_owner_id: "wrong" },
      { ref: "refs/pull/1/merge" },
      {
        workflow_ref:
          "aliinreallife/metto-data/.github/workflows/ci.yml@refs/heads/main",
      },
      { event_name: "pull_request" },
    ])
      await expect(
        verifyWorkflowToken(
          await sign(override),
          "https://portal.example",
          keySet,
        ),
      ).rejects.toThrow();
    await expect(
      verifyWorkflowToken(
        await sign({}, "https://elsewhere.example"),
        "https://portal.example",
        keySet,
      ),
    ).rejects.toThrow();
    await expect(
      verifyWorkflowToken(
        await sign({}, "https://portal.example", true),
        "https://portal.example",
        keySet,
      ),
    ).rejects.toThrow();
  });
});
