import { intakeConfig } from "../../../../lib/config";
import { reconcile } from "../../../../lib/reconcile";
import { verifyWorkflowToken } from "../../../../lib/workflow-auth";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  const config = intakeConfig();
  if (!config) return Response.json({ error: "unavailable" }, { status: 503 });
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ") || authorization.length > 20000)
    return new Response(null, { status: 403 });
  try {
    await verifyWorkflowToken(authorization.slice(7), config.publicOrigin);
  } catch {
    return new Response(null, { status: 403 });
  }
  let body: { cursor?: string; githubToken?: string };
  try {
    const text = await request.text();
    if (text.length > 5000) throw Error();
    body = JSON.parse(text);
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      typeof body.githubToken !== "string" ||
      !body.githubToken ||
      body.githubToken.length > 1024 ||
      /[\r\n]/.test(body.githubToken) ||
      (body.cursor !== undefined &&
        (typeof body.cursor !== "string" || body.cursor.length > 2000))
    )
      throw Error();
  } catch {
    return new Response(null, { status: 400 });
  }
  // The job's repository-scoped token is used only for this invocation. It is
  // never saved in report storage, environment variables, responses or logs.
  try {
    return Response.json(
      await reconcile(
        { ...config, githubToken: body.githubToken },
        body.cursor,
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
