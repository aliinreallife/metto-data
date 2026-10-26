export const USERNAME_PATTERN = "[a-z0-9][a-z0-9_]{2,29}";
const reserved = new Set([
  "admin",
  "administrator",
  "api",
  "metto",
  "moderator",
  "root",
  "security",
  "support",
  "system",
]);
/** Empty keeps legacy profiles usable; a chosen handle is public and case-insensitive. */
export function normalizeUsername(value: unknown): string | null {
  if (value === undefined || value === "") return "";
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/^@/, "").toLowerCase();
  return new RegExp("^" + USERNAME_PATTERN + "$").test(name) &&
    !reserved.has(name)
    ? name
    : null;
}
export const contributorHref = (id: string, username?: string, lang = "fa") =>
  "/contributors/" + encodeURIComponent(username || id) + "?lang=" + lang;
