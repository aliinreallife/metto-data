import { get, put, list, del, BlobPreconditionFailedError } from "@vercel/blob";
import type { PrivateStore } from "./intake";
export function privateBlobStore(token: string): PrivateStore {
  const options = { token, access: "private" as const };
  const store: PrivateStore = {
    async read<T>(path: string) {
      const result = await get(path, { ...options, useCache: false });
      if (!result || result.statusCode !== 200) return null;
      const value = (await new Response(result.stream).json()) as T;
      return { value, etag: result.blob.etag };
    },
    async write(path, value, expected) {
      try {
        await put(path, JSON.stringify(value), {
          ...options,
          addRandomSuffix: false,
          allowOverwrite: expected !== null,
          ...(expected ? { ifMatch: expected } : {}),
          contentType: "application/json",
          cacheControlMaxAge: 60,
        });
        return true;
      } catch (error) {
        if (error instanceof BlobPreconditionFailedError) return false;
        if (expected === null && (await store.read(path))) return false;
        throw error;
      }
    },
    async remove(path, expected) {
      try {
        await del(path, { token, ifMatch: expected });
        return true;
      } catch (error) {
        if (error instanceof BlobPreconditionFailedError) return false;
        throw error;
      }
    },
    async paths(prefix, cursor) {
      const result = await list({ token, prefix, cursor, limit: 10 });
      return {
        paths: result.blobs.map((blob) => blob.pathname),
        cursor: result.hasMore ? result.cursor : undefined,
      };
    },
  };
  return store;
}
