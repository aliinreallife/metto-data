import { previewStore } from "./preview-store";
import { createHash } from "node:crypto";
import { catalog } from "./catalog-data";
import { privateBlobStore } from "./private-store";
import { postgresStore } from "./postgres-store";
import type { IntakeConfig } from "./intake";
export function intakeConfig(requestOrigin?: string): IntakeConfig | null {
  const previewHosts =
    process.env.VERCEL_ENV === "preview"
      ? [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL].filter(
          (host): host is string =>
            !!host && /^[a-zA-Z0-9-]+\.vercel\.app$/.test(host),
        )
      : [];
  const requestedHost = requestOrigin
    ? (() => {
        try {
          return new URL(requestOrigin).host;
        } catch {
          return "";
        }
      })()
    : "";
  const previewHost = previewHosts.includes(requestedHost)
    ? requestedHost
    : previewHosts[0];
  const token = process.env.BLOB_READ_WRITE_TOKEN,
    githubToken = process.env.GITHUB_TOKEN ?? "",
    database = process.env.DATABASE_URL ?? process.env.POSTGRES_URL,
    quotaSecret =
      process.env.DATA_PORTAL_QUOTA_SECRET ??
      process.env.DATA_PORTAL_AUTOMATION_SECRET ??
      githubToken,
    configured =
      previewHost && /^[a-zA-Z0-9-]+\.vercel\.app$/.test(previewHost)
        ? `https://${previewHost}`
        : process.env.DATA_PORTAL_ORIGIN;
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
    store: previewHost
      ? previewStore(
          store,
          createHash("sha256")
            .update(process.env.VERCEL_BRANCH_URL || url.origin)
            .digest("hex")
            .slice(0, 24),
        )
      : store,
    quotaSecret,
    creditSecret: process.env.DATA_PORTAL_CREDIT_SECRET || quotaSecret,
    githubToken: previewHost ? "" : githubToken,
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
