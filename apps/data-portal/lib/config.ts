import { catalog } from "./catalog-data";
import { privateBlobStore } from "./private-store";
import type { IntakeConfig } from "./intake";
export function intakeConfig(): IntakeConfig | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN,
    githubToken = process.env.GITHUB_TOKEN,
    configured = process.env.DATA_PORTAL_ORIGIN;
  if (!token || !githubToken || !configured) return null;
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
  return {
    store: privateBlobStore(token),
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
