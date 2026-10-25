import { canUnlinkAccount } from "../../../../lib/auth/accounts";
import { portalAuth, portalUser } from "../../../../lib/auth/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) {
  const path = (await context.params).path.join("/");
  if (
    !(
      (request.method === "GET" &&
        ["get-session", "list-accounts"].includes(path)) ||
      (request.method === "POST" &&
        [
          "sign-in/social",
          "sign-out",
          "link-social",
          "unlink-account",
        ].includes(path))
    )
  )
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  if (
    request.method === "POST" &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return Response.json({ error: "origin" }, { status: 403 });
  if (["sign-in/social", "link-social"].includes(path)) {
    const body = await request
      .clone()
      .json()
      .catch(() => null);
    if (
      !body ||
      ![
        "google",
        ...(process.env.DATA_PORTAL_GITHUB_LOGIN === "1" ? ["github"] : []),
      ].includes(body.provider)
    )
      return Response.json({ error: "provider" }, { status: 400 });
  }
  const auth = portalAuth();
  if (!auth)
    return Response.json(
      { error: "auth_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  if (["link-social", "unlink-account", "list-accounts"].includes(path)) {
    if (!(await portalUser()))
      return Response.json({ error: "login" }, { status: 401 });
    if (path === "unlink-account") {
      const accounts = await auth.listAccounts();
      if (accounts.error || !accounts.data)
        return Response.json({ error: "unavailable" }, { status: 503 });
      const body = await request
        .clone()
        .json()
        .catch(() => null);
      const target = accounts.data.find(
        (account) => account.id === body?.accountId,
      );
      if (!target || !["google", "github"].includes(target.providerId))
        return Response.json({ error: "account" }, { status: 400 });
      if (!canUnlinkAccount(accounts.data, body?.accountId))
        return Response.json({ error: "last_provider" }, { status: 409 });
    }
  }
  return auth.handler()[request.method as "GET" | "POST"](request, context);
}
export const GET = handle;
export const POST = handle;
