import { expect, it } from "vitest";
import {
  socialProfile,
  cleanSocialLinks,
} from "../apps/data-portal/lib/social-links.ts";
import {
  createProfileHandler,
  parseProfile,
  publicMemberProfile,
  type MemberProfile,
} from "../apps/data-portal/lib/profile.ts";
import { contributorId } from "../apps/data-portal/lib/credit.ts";
import type { PrivateStore } from "../apps/data-portal/lib/intake.ts";
const details: MemberProfile = {
  name: "Private name",
  age: 27,
  gender: "woman",
  publicName: "Public alias",
  bio: "I help keep station data useful.",
  socialLinks: { x: "@example" },
  publicProfile: false,
};
function setup() {
  const rows = new Map<string, { value: unknown; etag: string }>();
  let revision = 0,
    updates = 0;
  const store: PrivateStore = {
    async read<T>(path: string) {
      const row = rows.get(path);
      return row
        ? { value: structuredClone(row.value) as T, etag: row.etag }
        : null;
    },
    async write(path, value, expected) {
      const row = rows.get(path);
      if ((row?.etag ?? null) !== expected) return false;
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
  const config = {
    store,
    secret: "test-profile-credit-secret",
    user: async () => ({ id: "server-verified-user", name: "Original name" }),
    updateName: async () => {
      updates++;
      return true;
    },
  };
  return {
    rows,
    config,
    handle: createProfileHandler(config),
    updates: () => updates,
  };
}
const request = (
  profile: unknown = details,
  revision: string | null = null,
  origin = "https://data.example.test",
) =>
  new Request("https://data.example.test/api/profile", {
    method: "PUT",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify({ profile, revision, userId: "attacker-chosen-id" }),
  });
it("accepts handles/profile links in the Jishoo style and normalizes old platform hosts", () => {
  expect(socialProfile("instagram", "@example.person")).toBe(
    "https://www.instagram.com/example.person",
  );
  expect(
    socialProfile(
      "telegram",
      "https://telegram.me/example_name?start=tracking",
    ),
  ).toBe("https://t.me/example_name");
  expect(
    socialProfile("x", "https://twitter.com/example?utm_source=test"),
  ).toBe("https://x.com/example");
  expect(socialProfile("github", "@example-person")).toBe(
    "https://github.com/example-person",
  );
  expect(
    socialProfile(
      "spotify",
      "https://open.spotify.com/intl-en/artist/1234567890123456789012",
    ),
  ).toBe("https://open.spotify.com/artist/1234567890123456789012");
  expect(socialProfile("website", "example.org/about")).toBe(
    "https://example.org/about",
  );
});
it("rejects scripts, credentials, wrong hosts, social posts and non-profile Spotify links", () => {
  for (const [kind, value] of [
    ["website", "javascript:alert(1)"],
    ["website", "https://user:secret@example.org"],
    ["website", "http://127.0.0.1"],
    ["x", "https://evil.example/example"],
    ["instagram", "https://instagram.com/p/post"],
    ["instagram", "name..name"],
    ["telegram", "https://t.me/joinchat/invite"],
    ["spotify", "https://open.spotify.com/track/1234"],
  ] as const)
    expect(() => socialProfile(kind, value)).toThrow();
  expect(() => cleanSocialLinks({ unknown: "@handle" })).toThrow();
});
it("validates optional private age/gender and requires a deliberate public alias when publishing", () => {
  expect(parseProfile(details)?.age).toBe(27);
  expect(parseProfile({ ...details, age: null, gender: "" })).toBeTruthy();
  for (const invalid of [
    { age: 27.5 },
    { age: -1 },
    { age: 121 },
    { gender: "unrecognized" },
    { publicProfile: true, publicName: "private@example.org" },
    { publicProfile: true, publicName: "" },
  ])
    expect(parseProfile({ ...details, ...invalid })).toBeNull();
});
it("never publishes private name, age or gender, even for an opted-in public profile", () => {
  expect(publicMemberProfile(details)).toBeNull();
  const published = publicMemberProfile({ ...details, publicProfile: true });
  expect(published).toEqual({
    publicName: details.publicName,
    bio: details.bio,
    socialLinks: details.socialLinks,
  });
  expect(JSON.stringify(published)).not.toMatch(
    /Private name|age|gender|woman/,
  );
});
it("keys profile writes by server identity and persists normalized social links outside public reports", async () => {
  const f = setup(),
    response = await f.handle(request());
  expect(response.status).toBe(200);
  expect(f.updates()).toBe(1);
  expect([...f.rows.keys()]).toEqual([
    `profiles/${contributorId("server-verified-user", f.config.secret)}.json`,
  ]);
  const body = (await response.json()) as { profile: MemberProfile };
  expect(body.profile.socialLinks.x).toBe("https://x.com/example");
  expect(body.profile.publicProfile).toBe(false);
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("requires login and same-origin writes and rejects malformed data without writes", async () => {
  const f = setup();
  expect(
    (await f.handle(request(details, null, "https://foreign.example"))).status,
  ).toBe(403);
  expect((await f.handle(request({ ...details, age: "27" }))).status).toBe(400);
  const anonymous = createProfileHandler({
    ...f.config,
    user: async () => null,
  });
  expect(
    (await anonymous(new Request("https://data.example.test/api/profile")))
      .status,
  ).toBe(401);
  expect(f.rows.size).toBe(0);
  expect(f.updates()).toBe(0);
});
it("prevents stale tabs overwriting a profile and allows clearing optional fields with the latest revision", async () => {
  const f = setup(),
    first = (await (await f.handle(request())).json()) as { revision: string };
  expect(
    (await f.handle(request({ ...details, name: "Another name" }))).status,
  ).toBe(409);
  expect(f.updates()).toBe(1);
  const result = await f.handle(
    request(
      { ...details, age: null, gender: "", socialLinks: {} },
      first.revision,
    ),
  );
  expect(result.status).toBe(200);
  expect(
    ((await result.json()) as { profile: MemberProfile }).profile.age,
  ).toBeNull();
});
