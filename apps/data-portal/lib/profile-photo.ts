import { createHash } from "node:crypto";
import sharp from "sharp";
import { contributorId } from "./credit.ts";
import type { PrivateStore } from "./intake.ts";
import { profilePhotoUrl } from "./avatar.ts";
export const AVATAR_MAX_BYTES = 65536;
export type ProfilePhoto = { jpeg: string; version: string; updatedAt: string };
export const photoPath = (id: string) => "avatars/" + id + ".json";
export async function savedProfilePhoto(
  store: PrivateStore | undefined,
  id: string,
) {
  if (!store || !/^[a-f0-9]{64}$/.test(id)) return null;
  const row = await store.read<ProfilePhoto>(photoPath(id));
  return row && /^[a-f0-9]{64}$/.test(row.value.version) ? row : null;
}
export async function sanitizeProfilePhoto(value: string) {
  if (
    value.length > Math.ceil(AVATAR_MAX_BYTES / 3) * 4 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  )
    throw Error("photo");
  const bytes = Buffer.from(value, "base64");
  if (bytes.length > AVATAR_MAX_BYTES) throw Error("photo");
  const image = sharp(bytes, {
    limitInputPixels: 1024 * 1024,
    failOn: "warning",
  });
  if ((await image.metadata()).format !== "jpeg") throw Error("photo");
  for (const quality of [85, 75, 65, 55]) {
    const result = await image
      .clone()
      .rotate()
      .resize(512, 512, { fit: "cover" })
      .jpeg({ quality })
      .toBuffer();
    if (result.length <= AVATAR_MAX_BYTES) return result;
  }
  throw Error("photo");
}
async function jsonBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw Error("invalid");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > 95000) {
      await reader.cancel();
      throw Error("large");
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
async function reservePhoto(store: PrivateStore, id: string) {
  const path =
    "limits/" +
    new Date().toISOString().slice(0, 10) +
    "/profile-photo-" +
    id +
    ".json";
  for (let i = 0; i < 6; i++) {
    const old = await store.read<{ count: number }>(path);
    if ((old?.value.count ?? 0) >= 20) return false;
    if (
      await store.write(
        path,
        { count: (old?.value.count ?? 0) + 1 },
        old?.etag ?? null,
      )
    )
      return true;
  }
  return false;
}
export function createProfilePhotoHandler(config: {
  store: PrivateStore;
  secret: string;
  publicOrigin: string;
  user: () => Promise<{ id: string } | null>;
}) {
  return async (request: Request) => {
    const reply = (status: number, value: unknown) =>
      Response.json(value, {
        status,
        headers: { "Cache-Control": "no-store" },
      });
    if (!["GET", "PUT"].includes(request.method))
      return reply(405, { error: "method" });
    if (
      request.method === "PUT" &&
      request.headers.get("origin") !== config.publicOrigin
    )
      return reply(403, { error: "origin" });
    try {
      const user = await config.user();
      if (!user) return reply(401, { error: "login" });
      const id = contributorId(user.id, config.secret),
        path = photoPath(id),
        current = await savedProfilePhoto(config.store, id);
      const state = (row: typeof current) => ({
        url: row ? profilePhotoUrl(id, row.value.version) : null,
        revision: row ? row.etag + ":" + row.value.version : null,
      });
      if (request.method === "GET") return reply(200, state(current));
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        return reply(415, { error: "content_type" });
      let body: { photo?: unknown; revision?: unknown };
      try {
        body = (await jsonBody(request)) as typeof body;
      } catch (error) {
        return reply(
          error instanceof Error && error.message === "large" ? 413 : 400,
          { error: "photo" },
        );
      }
      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        !(body.photo === null || typeof body.photo === "string") ||
        !(body.revision === null || typeof body.revision === "string")
      )
        return reply(400, { error: "photo" });
      if (body.revision !== state(current).revision)
        return reply(409, { error: "changed" });
      if (body.photo === null) {
        if (current && !(await config.store.remove(path, current.etag)))
          return reply(409, { error: "changed" });
        return reply(200, { url: null, revision: null });
      }
      if (!(await reservePhoto(config.store, id)))
        return reply(429, { error: "limited" });
      let image: Buffer;
      try {
        image = await sanitizeProfilePhoto(body.photo);
      } catch {
        return reply(400, { error: "photo" });
      }
      const version = createHash("sha256").update(image).digest("hex");
      if (current?.value.version === version) return reply(200, state(current));
      if (
        config.store.canStorePhoto &&
        !(await config.store.canStorePhoto(image.length))
      )
        return reply(507, { error: "storage_full" });
      if (
        !(await config.store.write(
          path,
          {
            jpeg: image.toString("base64"),
            version,
            updatedAt: new Date().toISOString(),
          } satisfies ProfilePhoto,
          current?.etag ?? null,
        ))
      )
        return reply(409, { error: "changed" });
      const saved = await savedProfilePhoto(config.store, id);
      if (!saved || saved.value.version !== version)
        return reply(409, { error: "changed" });
      return reply(200, state(saved));
    } catch {
      return reply(503, { error: "unavailable" });
    }
  };
}
export async function publicProfilePhoto(
  store: PrivateStore,
  id: string,
  request: Request,
) {
  if (!/^[a-f0-9]{64}$/.test(id))
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  const row = await savedProfilePhoto(store, id),
    version = new URL(request.url).searchParams.get("v");
  if (!row || (version && version !== row.value.version))
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  const etag = '"' + row.value.version + '"',
    headers = {
      "Content-Type": "image/jpeg",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=0, must-revalidate",
      ETag: etag,
    };
  if (request.headers.get("if-none-match") === etag)
    return new Response(null, { status: 304, headers });
  return new Response(new Uint8Array(Buffer.from(row.value.jpeg, "base64")), {
    headers,
  });
}
