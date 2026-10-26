import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import {
  PORTAL_MIGRATION,
  createPostgresStore,
} from "../apps/data-portal/lib/postgres-store.ts";
import {
  createProfileHandler,
  parseProfile,
  publicMemberProfile,
  profilePath,
  type MemberProfile,
} from "../apps/data-portal/lib/profile.ts";
import {
  normalizeUsername,
  contributorHref,
} from "../apps/data-portal/lib/usernames.ts";
import { contributorId } from "../apps/data-portal/lib/credit.ts";
import { previewStore } from "../apps/data-portal/lib/preview-store.ts";
import {
  includeHistoricalCredits,
  resolveHistoricalId,
  linkHistoricalCredit,
} from "../apps/data-portal/lib/historical-credit.ts";
import { enrichLeaders } from "../apps/data-portal/lib/leaderboard.ts";
const secret = "test-contributor-identity-secret",
  origin = "https://data.example.test";
const member: MemberProfile = {
  name: "Private name",
  age: 27,
  gender: "woman",
  username: "rail_helper",
  publicName: "Public alias",
  publicProfile: false,
  bio: "Private until opted in",
  socialLinks: { x: "https://x.com/example" },
};
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec("BEGIN;" + PORTAL_MIGRATION.join(";") + ";COMMIT;");
}, 30000);
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.exec("TRUNCATE metto_data_portal.objects");
});
const store = () =>
  createPostgresStore(
    async (sql, params) =>
      (await db.query<Record<string, unknown>>(sql, params)).rows,
    async () => {},
  );
function handler(
  userId: string,
  accounts: { providerId: string; accountId: string }[] = [],
) {
  return createProfileHandler({
    store: store(),
    secret,
    user: async () => ({ id: userId, name: member.name }),
    verifiedAccounts: async () => accounts,
    updateName: async () => true,
  });
}
const profileResponse = async (response: Response) =>
  (await response.json()) as {
    id: string;
    profile: MemberProfile;
    revision: string;
    historicalLinked: boolean;
  };
const put = (profile: unknown = member, revision: string | null = null) =>
  new Request(origin + "/api/profile", {
    method: "PUT",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      profile,
      revision,
      userId: "forged-id",
      verifiedAccounts: [{ providerId: "github", accountId: "91134550" }],
    }),
  });
describe("unique public usernames", () => {
  it("normalizes case and rejects short, invalid, reserved and overlong handles on the server", () => {
    expect(normalizeUsername(" @Ali_Rashidi ")).toBe("ali_rashidi");
    expect(normalizeUsername("ali")).toBe("ali");
    for (const value of [
      "ab",
      "a b",
      "علی",
      "_abc",
      "admin",
      "a".repeat(31),
      3,
      null,
    ])
      expect(normalizeUsername(value)).toBeNull();
    expect(normalizeUsername(undefined)).toBe("");
    expect(parseProfile({ ...member, username: "ab" })).toBeNull();
    expect(contributorHref("stable-id", "ali", "en")).toBe(
      "/contributors/ali?lang=en",
    );
  });
  it("atomically allows one owner for concurrent case-insensitive claims", async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        handler("user-" + i)(
          put({ ...member, username: i % 2 ? "RAIL_HELPER" : "rail_helper" }),
        ),
      ),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(11);
    const owner =
      await store().findProfileByUsername!<MemberProfile>("rail_helper");
    expect(owner?.value.username).toBe("rail_helper");
    for (const response of results.filter((r) => r.status === 409))
      expect(await response.json()).toEqual({ error: "username_taken" });
  });
  it("resolves a saved username, supports renaming without moving contribution identity, and preserves profile revision checks", async () => {
    const handle = handler("account-a");
    const first = await profileResponse(await handle(put()));
    expect(first.id).toBe(contributorId("account-a", secret));
    expect(first.profile.username).toBe("rail_helper");
    expect(
      (await handle(put({ ...member, username: "new_name" }))).status,
    ).toBe(409);
    const second = await profileResponse(
      await handle(put({ ...member, username: "new_name" }, first.revision)),
    );
    expect(second.id).toBe(first.id);
    expect(await store().findProfileByUsername!("rail_helper")).toBeNull();
    expect((await store().findProfileByUsername!("new_name"))?.id).toBe(
      first.id,
    );
    expect((await handler("account-b")(put())).status).toBe(200);
  });
  it("preserves a chosen username when an older client omits the new field", async () => {
    const handle = handler("legacy-client-user");
    const first = await profileResponse(await handle(put()));
    const legacy = { ...member };
    delete legacy.username;
    const result = await profileResponse(
      await handle(put({ ...legacy, age: 31 }, first.revision)),
    );
    expect(result.profile.username).toBe("rail_helper");
    expect((await store().findProfileByUsername!("RAIL_HELPER"))?.id).toBe(
      first.id,
    );
  });
  it("enforces uniqueness separately in production and isolated previews", async () => {
    const backing = store(),
      a = previewStore(backing, "branch-a"),
      b = previewStore(backing, "branch-b");
    const p1 = profilePath("a".repeat(64)),
      p2 = profilePath("b".repeat(64));
    expect(await backing.write(p1, member, null)).toBe(true);
    expect(await a.write(p1, member, null)).toBe(true);
    expect(await b.write(p2, member, null)).toBe(true);
    expect(await a.write(p2, member, null)).toBe(false);
    expect((await a.findProfileByUsername!("rail_helper"))?.id).toBe(
      "a".repeat(64),
    );
    expect((await b.findProfileByUsername!("rail_helper"))?.id).toBe(
      "b".repeat(64),
    );
  });
  it("does not expose private name, age, gender, bio or social links simply because a username exists", async () => {
    const response = await handler("account-a")(put());
    expect(response.status).toBe(200);
    expect(publicMemberProfile(member)).toBeNull();
    const publicPart = publicMemberProfile({ ...member, publicProfile: true });
    expect(publicPart?.username).toBe("rail_helper");
    expect(publicPart).not.toHaveProperty("name");
    expect(publicPart).not.toHaveProperty("age");
    expect(publicPart).not.toHaveProperty("gender");
  });
});
describe("real historical contribution credit", () => {
  it("counts the owner's sourced correction even without a fabricated signed-in report", async () => {
    const people = await includeHistoricalCredits([]);
    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({
      id: "github-91134550",
      name: "علی رشیدی",
      accepted: 1,
    });
    expect(people[0].reports[0]).toMatchObject({
      id: "tehran-17-shahrivar-line-7",
      kind: "historical",
      accepted: true,
    });
    expect(people[0].reports[0].url).toContain(
      "62bd3f6992e55b49f63e04b68d8fec56ecf42e90",
    );
    expect((await includeHistoricalCredits(people))[0].accepted).toBe(1);
  });
  it("refuses a display-name/social-link/client-payload match as proof of authorship", async () => {
    const fake = handler("other-user", [
      { providerId: "github", accountId: "99999" },
    ]);
    const response = await fake(
      put({
        ...member,
        name: "علی رشیدی",
        socialLinks: { github: "https://github.com/aliinreallife" },
      }),
    );
    expect(response.status).toBe(200);
    expect((await profileResponse(response)).historicalLinked).toBe(false);
    expect(await resolveHistoricalId(store(), "github-91134550")).toBe(
      "github-91134550",
    );
    expect(
      await linkHistoricalCredit(store(), "c".repeat(64), [
        { providerId: "google", accountId: "91134550" },
      ]),
    ).toBe(false);
  });
  it("links only the session's exact verified GitHub account and combines old/new credit once", async () => {
    const userId = "verified-owner",
      id = contributorId(userId, secret),
      handle = handler(userId, [
        { providerId: "github", accountId: "91134550" },
      ]);
    const response = await handle(put({ ...member, username: "ali" }));
    expect(response.status).toBe(200);
    expect((await profileResponse(response)).historicalLinked).toBe(true);
    expect(await resolveHistoricalId(store(), "github-91134550")).toBe(id);
    const people = await enrichLeaders(
      [
        {
          id,
          name: "Explicit public report name",
          accepted: 1,
          reports: [
            {
              id: "new-report",
              title: "New correction",
              url: "https://github.com/aliinreallife/metto-data/issues/101",
              accepted: true,
              createdAt: "2026-10-26",
            },
          ],
        },
      ],
      store(),
    );
    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({ id, username: "ali", accepted: 2 });
    expect(people[0].reports).toHaveLength(2);
    expect(JSON.stringify(people)).not.toMatch(
      /Private name|Private until opted in|"age"|"gender"|https:\/\/x.com\/example/,
    );
    expect((await includeHistoricalCredits(people, store()))[0].accepted).toBe(
      2,
    );
  });
});
