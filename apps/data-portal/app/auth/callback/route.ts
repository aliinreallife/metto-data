import { completeOAuth } from "../../../lib/auth/callback";
import { portalAuthConfig } from "../../../lib/auth/server";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const config = portalAuthConfig();
  return completeOAuth(request, config ? {
    baseUrl: config.baseUrl,
    cookieSecret: config.cookies.secret,
  } : null);
}
