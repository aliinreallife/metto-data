import { blobatarUri } from "blobatar/uri";
/** Stable public contributor IDs keep avatars consistent without using email. */
export const defaultAvatar = (id: string) =>
  blobatarUri("metto:" + id, { background: "circle" });
export function profilePhotoUrl(id: string, version: string) {
  return (
    "/api/profile-photos/" +
    encodeURIComponent(id) +
    "?v=" +
    encodeURIComponent(version)
  );
}
