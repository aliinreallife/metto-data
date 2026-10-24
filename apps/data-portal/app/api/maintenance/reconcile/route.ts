import { timingSafeEqual } from "node:crypto";
import { intakeConfig } from "../../../../lib/config";
import { reconcile } from "../../../../lib/reconcile";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  const secret = process.env.DATA_PORTAL_AUTOMATION_SECRET;
  if (!secret) return new Response(null, { status: 404 });
  const provided = Buffer.from(request.headers.get("authorization") ?? ""),
    expected = Buffer.from(`Bearer ${secret}`);
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  )
    return new Response(null, { status: 403 });
  const config = intakeConfig();
  if (!config) return Response.json({ error: "unavailable" }, { status: 503 });
  let body: { cursor?: string };
  try {
    body = (await request.json()) as { cursor?: string };
    if (
      body.cursor !== undefined &&
      (typeof body.cursor !== "string" || body.cursor.length > 2000)
    )
      throw Error();
  } catch {
    return new Response(null, { status: 400 });
  }
  try {
    return Response.json(await reconcile(config, body.cursor), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
