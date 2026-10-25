import { portalUser } from "../../../lib/auth/server";
import { intakeConfig } from "../../../lib/config";
import { createIntakeHandler } from "../../../lib/intake";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  const config = intakeConfig(new URL(request.url).origin);
  return config
    ? createIntakeHandler({ ...config, resolveContributor: portalUser })(
        request,
      )
    : Response.json(
        { error: "unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
}
