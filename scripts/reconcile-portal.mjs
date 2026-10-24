// No report or contact content belongs in Actions logs.
const origin = process.env.DATA_PORTAL_ORIGIN,
  secret = process.env.DATA_PORTAL_AUTOMATION_SECRET;
if (!origin || !secret) {
  console.log(
    "Portal maintenance not configured; set its origin and automation secret after Vercel deployment.",
  );
  process.exit(0);
}
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
let cursor;
for (let page = 0; page < 10; page++) {
  const response = await fetch(new URL("/api/maintenance/reconcile", url), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cursor }),
    signal: AbortSignal.timeout(290000),
  });
  if (!response.ok)
    throw Error(
      `Portal maintenance returned HTTP ${response.status}; inspect private server configuration`,
    );
  const result = await response.json();
  const counts = Object.fromEntries(
    ["processed", "published", "pending", "needsReview"].map((key) => [
      key,
      Number(result[key]) || 0,
    ]),
  );
  console.log(JSON.stringify(counts));
  cursor = result.cursor;
  if (!cursor) break;
}
