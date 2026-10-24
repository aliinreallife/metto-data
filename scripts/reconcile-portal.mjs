// Never print report content, private contacts or job credentials.
const origin = process.env.DATA_PORTAL_ORIGIN,
  githubToken = process.env.GITHUB_TOKEN;
if (!origin || !githubToken)
  throw Error("Portal origin and the built-in GitHub job token are required");
const url = new URL(origin);
if (
  url.protocol !== "https:" ||
  url.username ||
  url.password ||
  url.search ||
  url.hash ||
  url.pathname !== "/"
)
  throw Error("Use the public HTTPS portal origin");
let cachedToken,
  tokenAt = 0;
async function identity() {
  if (cachedToken && Date.now() - tokenAt < 120000) return cachedToken;
  const endpoint = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL ?? "");
  endpoint.searchParams.set("audience", url.origin);
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`,
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw Error(`GitHub workload identity returned HTTP ${response.status}`);
  const data = await response.json();
  if (typeof data.value !== "string")
    throw Error("Workload identity is unavailable");
  cachedToken = data.value;
  tokenAt = Date.now();
  return cachedToken;
}
let cursor;
for (let page = 0; page < 10; page++) {
  const response = await fetch(new URL("/api/maintenance/reconcile", url), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await identity()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cursor, githubToken }),
    signal: AbortSignal.timeout(290000),
  });
  if (!response.ok)
    throw Error(
      `Portal maintenance returned HTTP ${response.status}; inspect private server configuration`,
    );
  const result = await response.json();
  console.log(
    JSON.stringify(
      Object.fromEntries(
        ["processed", "published", "pending", "needsReview"].map((key) => [
          key,
          Number(result[key]) || 0,
        ]),
      ),
    ),
  );
  cursor = result.cursor;
  if (!cursor) break;
}
