import { catalog } from "./catalog-data";
import { privateBlobStore } from "./private-store";
import { postgresStore } from "./postgres-store";
import type { IntakeConfig } from "./intake";
export function intakeConfig(): IntakeConfig | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN,
    githubToken = process.env.GITHUB_TOKEN ?? "",
    database = process.env.DATABASE_URL ?? process.env.POSTGRES_URL,
    quotaSecret =
      process.env.DATA_PORTAL_QUOTA_SECRET ??
      process.env.DATA_PORTAL_AUTOMATION_SECRET ??
      githubToken,
    configured = process.env.DATA_PORTAL_ORIGIN;
  if ((!database && !token) || !quotaSecret || !configured) return null;
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    return null;
  }
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["127.0.0.1", "localhost"].includes(url.hostname))
    )
  )
    return null;
  let store;
  try {
    store = database ? postgresStore(database) : privateBlobStore(token!);
  } catch {
    return null;
  }
  return {
    store,
    quotaSecret,
    githubToken,
    publicOrigin: url.origin,
    cityStations: Object.fromEntries([
      ["other", []],
      ...catalog.cities.map((city) => [
        city.id,
        city.stations.map((station) => station.id),
      ]),
    ]),
  };
}
