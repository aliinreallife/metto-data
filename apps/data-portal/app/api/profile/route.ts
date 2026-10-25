import { portalAuth, portalUser } from "../../../lib/auth/server";
import { intakeConfig } from "../../../lib/config";
import { createProfileHandler } from "../../../lib/profile";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  const config = intakeConfig(new URL(request.url).origin);
  if (!config?.creditSecret)
    return Response.json(
      { error: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  return createProfileHandler({
    store: config.store,
    secret: config.creditSecret,
    user: portalUser,
    updateName: async (name) => {
      const result = await portalAuth()?.updateUser({ name });
      return !!result && !result.error;
    },
  })(request);
}
export const GET = handle;
export const PUT = handle;
