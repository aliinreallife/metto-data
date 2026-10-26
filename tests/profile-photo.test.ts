import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { contributorId } from "../apps/data-portal/lib/credit.ts";
import { defaultAvatar } from "../apps/data-portal/lib/avatar.ts";
import {
  createProfilePhotoHandler,
  photoPath,
  publicProfilePhoto,
  sanitizeProfilePhoto,
  type ProfilePhoto,
} from "../apps/data-portal/lib/profile-photo.ts";
import type { PrivateStore } from "../apps/data-portal/lib/intake.ts";
const require = createRequire(
  new URL("../apps/data-portal/package.json", import.meta.url),
);
const sharp = require("sharp");
const fixture = JSON.parse(
  readFileSync(new URL("fixtures/report-photo.json", import.meta.url), "utf8"),
);
type PhotoState = { url: string | null; revision: string | null };
const origin = "https://data.example.test",
  secret = "test-only-photo-secret",
  id = contributorId("verified-user", secret);
function setup() {
  const rows = new Map<string, { value: unknown; etag: string }>();
  let revision = 0;
  const store: PrivateStore = {
    async read<T>(path: string) {
      const row = rows.get(path);
      return row
        ? { value: structuredClone(row.value) as T, etag: row.etag }
        : null;
    },
    async write(path, value, expected) {
      if ((rows.get(path)?.etag ?? null) !== expected) return false;
      rows.set(path, {
        value: structuredClone(value),
        etag: String(++revision),
      });
      return true;
    },
    async remove(path, etag) {
      if (rows.get(path)?.etag !== etag) return false;
      return rows.delete(path);
    },
    async paths(prefix) {
      return {
        paths: [...rows.keys()].filter((path) => path.startsWith(prefix)),
      };
    },
    async canStorePhoto() {
      return true;
    },
  };
  const config = {
    store,
    secret,
    publicOrigin: origin,
    user: async () => ({ id: "verified-user" }) as { id: string } | null,
  };
  return { rows, store, config, handle: createProfilePhotoHandler(config) };
}
function request(
  photo: unknown = fixture.jpeg,
  revision: string | null = null,
  overrides: RequestInit = {},
) {
  return new Request(origin + "/api/profile-photo", {
    method: "PUT",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      photo,
      revision,
      userId: "forged-user",
      id: "b".repeat(64),
    }),
    ...overrides,
  });
}
it("generates deterministic Blobatar images locally from public contributor IDs", () => {
  const uri = defaultAvatar(id);
  expect(uri).toMatch(/^data:image\/svg\+xml/);
  expect(uri).toBe(defaultAvatar(id));
  expect(uri).not.toBe(defaultAvatar("another-public-id"));
  expect(uri).not.toContain("verified-user");
});
it("decodes photos, crops square and strips EXIF and GPS before storing", async () => {
  const clean = await sanitizeProfilePhoto(fixture.jpeg),
    metadata = await sharp(clean).metadata();
  expect(metadata).toMatchObject({ format: "jpeg", width: 512, height: 512 });
  expect(metadata.exif).toBeUndefined();
  expect(metadata.xmp).toBeUndefined();
  expect(clean.length).toBeLessThanOrEqual(65536);
  expect(clean.toString("latin1")).not.toContain("private-photo-metadata");
});
it("rejects disguised files, oversized uploads and excessive pixel counts", async () => {
  for (const input of [
    "<svg></svg>",
    Buffer.from("not a JPEG").toString("base64"),
    "A".repeat(90000),
    await sharp({
      create: { width: 2048, height: 2048, channels: 3, background: "red" },
    })
      .jpeg()
      .toBuffer()
      .then((b: Buffer) => b.toString("base64")),
    await sharp({
      create: { width: 10, height: 10, channels: 3, background: "red" },
    })
      .png()
      .toBuffer()
      .then((b: Buffer) => b.toString("base64")),
  ])
    await expect(sanitizeProfilePhoto(input)).rejects.toThrow();
});
it("requires server authentication and same origin before any photo writes", async () => {
  const { config, rows, handle } = setup();
  expect(
    (
      await handle(
        request(null, null, { headers: { origin: "https://evil.test" } }),
      )
    ).status,
  ).toBe(403);
  config.user = async () => null;
  expect((await handle(request())).status).toBe(401);
  expect(rows.size).toBe(0);
});
it("stores only the signed-in owner's photo and exposes metadata separately from profile fields", async () => {
  const { handle, rows } = setup();
  const response = await handle(request());
  expect(response.status).toBe(200);
  const state = (await response.json()) as PhotoState;
  expect(state.url).toMatch(
    new RegExp("^/api/profile-photos/" + id + "\\?v=[a-f0-9]{64}$"),
  );
  expect(state.revision).toBeTypeOf("string");
  expect(rows.has(photoPath(id))).toBe(true);
  expect(rows.has(photoPath("b".repeat(64)))).toBe(false);
  const metadata = (await (
    await handle(new Request(origin + "/api/profile-photo"))
  ).json()) as PhotoState;
  expect(metadata).toEqual(state);
  expect(Object.keys(metadata).sort()).toEqual(["revision", "url"]);
  const record = rows.get(photoPath(id))!.value as ProfilePhoto;
  expect(Object.keys(record).sort()).toEqual(["jpeg", "updatedAt", "version"]);
});
it("serves only JPEG bytes, supports revalidation and never serves a stale removed photo", async () => {
  const { handle, store } = setup();
  const state = (await (await handle(request())).json()) as PhotoState;
  const url = origin + state.url;
  const response = await publicProfilePhoto(store, id, new Request(url));
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("image/jpeg");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("cache-control")).toContain("must-revalidate");
  expect((await response.arrayBuffer()).byteLength).toBeLessThanOrEqual(65536);
  expect(
    (
      await publicProfilePhoto(
        store,
        id,
        new Request(url, {
          headers: { "if-none-match": response.headers.get("etag")! },
        }),
      )
    ).status,
  ).toBe(304);
  expect(
    (
      await publicProfilePhoto(
        store,
        id,
        new Request(origin + "/api/profile-photos/" + id + "?v=old"),
      )
    ).status,
  ).toBe(404);
  expect((await handle(request(null, state.revision))).status).toBe(200);
  expect((await publicProfilePhoto(store, id, new Request(url))).status).toBe(
    404,
  );
  expect(
    (await publicProfilePhoto(store, "../profiles/private", new Request(url)))
      .status,
  ).toBe(404);
});
it("prevents stale replacements and removal from another tab without touching profile text", async () => {
  const { handle, rows } = setup();
  rows.set("profiles/" + id + ".json", {
    value: { name: "private", bio: "unsaved independent data" },
    etag: "profile-revision",
  });
  const state = (await (await handle(request())).json()) as PhotoState;
  expect((await handle(request(null, null))).status).toBe(409);
  expect((await handle(request(fixture.jpeg, "stale"))).status).toBe(409);
  expect((await handle(request(null, state.revision))).status).toBe(200);
  expect(rows.get("profiles/" + id + ".json")).toEqual({
    value: { name: "private", bio: "unsaved independent data" },
    etag: "profile-revision",
  });
});
it("bounds streamed request bodies and requires JSON", async () => {
  const { handle } = setup();
  expect(
    (
      await handle(
        request(null, null, {
          headers: { origin, "Content-Type": "text/plain" },
        }),
      )
    ).status,
  ).toBe(415);
  expect(
    (
      await handle(
        request(null, null, {
          body: JSON.stringify({ photo: "A".repeat(95000), revision: null }),
        }),
      )
    ).status,
  ).toBe(413);
  expect((await handle(request(null, null, { body: "[null]" }))).status).toBe(
    400,
  );
});
it("limits daily upload attempts while always allowing photo removal", async () => {
  const { handle, rows } = setup();
  const state = (await (await handle(request())).json()) as PhotoState;
  rows.set(
    "limits/" +
      new Date().toISOString().slice(0, 10) +
      "/profile-photo-" +
      id +
      ".json",
    { value: { count: 20 }, etag: "20" },
  );
  expect((await handle(request(fixture.jpeg, state.revision))).status).toBe(
    429,
  );
  expect((await handle(request(null, state.revision))).status).toBe(200);
});
it("honors the shared storage budget and permits deletion when full", async () => {
  const { handle, store } = setup();
  const state = (await (await handle(request())).json()) as PhotoState;
  store.canStorePhoto = async () => false;
  const other = await sharp({
    create: { width: 30, height: 20, channels: 3, background: "blue" },
  })
    .jpeg()
    .toBuffer();
  expect(
    (await handle(request(other.toString("base64"), state.revision))).status,
  ).toBe(507);
  expect((await handle(request(null, state.revision))).status).toBe(200);
});
it("returns a recoverable error on storage failure without claiming success", async () => {
  const { handle, store } = setup();
  store.write = async () => {
    throw Error("database unavailable");
  };
  expect((await handle(request())).status).toBe(503);
});
it("rejects a stale photo revision even if a deleted row's database revision is reused", async () => {
  const { handle, rows } = setup();
  const first = (await (await handle(request())).json()) as PhotoState;
  const original = rows.get(photoPath(id))!;
  await handle(request(null, first.revision));
  const replacement = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "green" },
  })
    .jpeg()
    .toBuffer();
  expect((await handle(request(replacement.toString("base64")))).status).toBe(
    200,
  );
  const current = rows.get(photoPath(id))!;
  rows.set(photoPath(id), { ...current, etag: original.etag });
  expect((await handle(request(null, first.revision))).status).toBe(409);
  expect(rows.has(photoPath(id))).toBe(true);
});
