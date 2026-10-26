import { intakeConfig } from "../../../lib/config";
import { portalUser } from "../../../lib/auth/server";
import { createProfilePhotoHandler } from "../../../lib/profile-photo";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
async function handle(request: Request) {
  const config = intakeConfig(new URL(request.url).origin);
  if (!config?.creditSecret)
    return Response.json(
      { error: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  return createProfilePhotoHandler({
    store: config.store,
    secret: config.creditSecret,
    publicOrigin: config.publicOrigin,
    user: portalUser,
  })(request);
}
export const GET = handle;
export const PUT = handle;
