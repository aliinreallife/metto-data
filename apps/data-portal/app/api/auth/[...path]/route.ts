import { portalAuth } from "../../../../lib/auth/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) {
  if (
    request.method === "POST" &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return Response.json({ error: "origin" }, { status: 403 });
  const auth = portalAuth();
  if (!auth)
    return Response.json(
      { error: "auth_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  return auth.handler()[request.method as "GET" | "POST"](request, context);
}
export const GET = handle;
export const POST = handle;
