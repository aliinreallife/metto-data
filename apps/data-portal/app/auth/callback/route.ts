import { completeOAuth } from "../../../lib/auth/callback";
import { portalAuthConfig, portalUser } from "../../../lib/auth/server";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const config = portalAuthConfig();
  const linking =
    new URL(request.url).searchParams.get("mode") === "link" &&
    !!(await portalUser());
  return completeOAuth(
    request,
    config
      ? {
          baseUrl: config.baseUrl,
          cookieSecret: config.cookies.secret,
        }
      : null,
    linking,
  );
}
