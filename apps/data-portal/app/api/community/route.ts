import { intakeConfig } from "../../../lib/config";
import { portalUser } from "../../../lib/auth/server";
import { createCommunityHandler } from "../../../lib/community";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  const config = intakeConfig(new URL(request.url).origin);
  return config
    ? createCommunityHandler(config, portalUser)(request)
    : Response.json(
        { error: "unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
}
export const GET = handle;
export const POST = handle;
