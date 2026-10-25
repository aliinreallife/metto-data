import {
  DEFAULT_AUTH_SKIP_ROUTES,
  NEON_AUTH_SESSION_COOKIE_NAME,
  processAuthMiddleware,
} from "@neondatabase/auth/server";
import { safeReportReturn } from "./return-to.ts";

/** Use the SDK's challenge/verifier exchange before returning to the account. */
export async function completeOAuth(
  request: Request,
  config: { baseUrl: string; cookieSecret: string } | null,
  linkedSession = false,
): Promise<Response> {
  const url = new URL(request.url);
  const account = new URL("/account", url);
  account.searchParams.set(
    "lang",
    url.searchParams.get("lang") === "en" ? "en" : "fa",
  );
  const returnTo = safeReportReturn(url.searchParams.get("returnTo"));
  const destination = returnTo ? new URL(returnTo, url) : account;
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  });
  if (
    linkedSession &&
    !url.searchParams.has("neon_auth_session_verifier") &&
    !url.searchParams.has("error")
  ) {
    headers.set("Location", destination.toString());
    return new Response(null, { status: 303, headers });
  }
  if (config && url.searchParams.has("neon_auth_session_verifier")) {
    try {
      const result = await processAuthMiddleware({
        request,
        pathname: "/auth/callback",
        skipRoutes: DEFAULT_AUTH_SKIP_ROUTES,
        loginUrl: "/account",
        ...config,
        logLevel: "silent",
      });
      if (
        result.action === "redirect_oauth" &&
        (linkedSession ||
          result.cookies.some(
            (cookie) =>
              cookie.startsWith(`${NEON_AUTH_SESSION_COOKIE_NAME}=`) &&
              !cookie.startsWith(`${NEON_AUTH_SESSION_COOKIE_NAME}=;`) &&
              !/max-age=0(?:;|$)/i.test(cookie),
          ))
      ) {
        for (const cookie of result.cookies)
          headers.append("Set-Cookie", cookie);
        headers.set("Location", destination.toString());
        return new Response(null, { status: 303, headers });
      }
    } catch {
      /* Show a retry, never raw OAuth errors or verifier values. */
    }
  }
  destination.searchParams.set("error", "oauth");
  headers.set("Location", destination.toString());
  return new Response(null, { status: 303, headers });
}
