import type { PrivateStore } from "./intake.ts";
/** Preview records cannot enter the production publisher's submissions/outbox scan. */
export function previewStore(
  store: PrivateStore,
  namespace: string,
): PrivateStore {
  const prefix = `preview/${namespace}/`;
  return {
    read: (path) => store.read(prefix + path),
    write: (path, value, expected) =>
      store.write(prefix + path, value, expected),
    remove: (path, expected) => store.remove(prefix + path, expected),
    ...(store.canStorePhoto
      ? { canStorePhoto: (bytes: number) => store.canStorePhoto!(bytes) }
      : {}),
    async paths(path, cursor) {
      const result = await store.paths(
        prefix + path,
        cursor ? prefix + cursor : undefined,
      );
      return {
        paths: result.paths.map((p) => p.slice(prefix.length)),
        cursor: result.cursor?.slice(prefix.length),
      };
    },
  };
}
