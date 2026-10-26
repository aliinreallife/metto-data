import { intakeConfig } from "../../../../lib/config";
import { verifyReviewWorkflowToken } from "../../../../lib/workflow-auth";
import { prepareCommunityReview } from "../../../../lib/community-review";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  const config = intakeConfig();
  if (!config) return Response.json({ error: "unavailable" }, { status: 503 });
  const token = request.headers.get("authorization") ?? "";
  if (!token.startsWith("Bearer ") || token.length > 20000)
    return new Response(null, { status: 403 });
  let actor: string;
  try {
    actor = (
      await verifyReviewWorkflowToken(token.slice(7), config.publicOrigin)
    ).actor;
  } catch {
    return new Response(null, { status: 403 });
  }
  try {
    const raw = await request.text();
    if (raw.length > 5000) throw Error();
    const body = JSON.parse(raw);
    if (
      !Number.isSafeInteger(body.issueNumber) ||
      body.issueNumber < 1 ||
      typeof body.githubToken !== "string" ||
      !body.githubToken ||
      body.githubToken.length > 1024 ||
      /[\r\n]/.test(body.githubToken) ||
      !["prepare", "applied", "manual", "rejected"].includes(body.action)
    )
      return new Response(null, { status: 400 });
    return Response.json(
      await prepareCommunityReview(
        { ...config, githubToken: body.githubToken },
        body.issueNumber,
        actor,
        body.action,
        body.commit,
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "review_unavailable" }, { status: 409 });
  }
}
