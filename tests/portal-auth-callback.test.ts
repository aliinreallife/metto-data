import { createServer } from "node:http";
import { beforeAll, afterAll, expect, it } from "vitest";
import { completeOAuth } from "../apps/data-portal/lib/auth/callback.ts";
const cookieName = "__Secure-neon-auth.session_token";
const challenge = "__Secure-neon-auth.session_challenge=browser-challenge";
let baseUrl = "";
let exchanges = 0;
const server = createServer((request, response) => {
  const url = new URL(request.url!, "http://localhost");
  if (url.pathname !== "/auth/get-session") {
    response.writeHead(404).end(); return;
  }
  const verifier = url.searchParams.get("neon_auth_session_verifier");
  if (verifier) {
    exchanges++;
    if (verifier !== "valid-test-verifier" || !request.headers.cookie?.includes(challenge)) {
      response.writeHead(401).end(); return;
    }
    response.setHeader("Set-Cookie", `${cookieName}=issued-test-session; Path=/; HttpOnly; Secure; SameSite=Lax`);
  }
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify({
    user: { id: "verified-test-user", name: "Rider", email: "test@example.invalid", emailVerified: true },
    session: { id: "test-session", userId: "verified-test-user", expiresAt: new Date(Date.now()+3600000).toISOString() },
  }));
});
beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw Error("Missing local test address");
  baseUrl = `http://127.0.0.1:${address.port}/auth`;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
const config = () => ({ baseUrl, cookieSecret: "local-callback-test-secret-over-thirty-two-characters" });
it("exchanges a provider callback through the real SDK and sets the secure session before redirecting", async () => {
  const response = await completeOAuth(new Request("https://data.example.test/auth/callback?lang=en&neon_auth_session_verifier=valid-test-verifier&next=https://other.example", { headers: { cookie: challenge } }), config());
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe("https://data.example.test/account?lang=en");
  expect(response.headers.getSetCookie().some(value => value.startsWith(`${cookieName}=issued-test-session;`) && /HttpOnly/i.test(value) && /Secure/i.test(value))).toBe(true);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  expect(await response.text()).toBe("");
});
it("rejects a callback without the browser challenge without contacting the provider", async () => {
  const before = exchanges;
  const response = await completeOAuth(new Request("https://data.example.test/auth/callback?neon_auth_session_verifier=valid-test-verifier"), config());
  expect(exchanges).toBe(before);
  expect(response.headers.get("location")).toBe("https://data.example.test/account?lang=fa&error=oauth");
  expect(response.headers.getSetCookie()).toEqual([]);
});
it("handles an invalid verifier without leaking it into the account URL or creating a session", async () => {
  const response = await completeOAuth(new Request("https://data.example.test/auth/callback?lang=en&neon_auth_session_verifier=invalid-secret", { headers: { cookie: challenge } }), config());
  expect(response.headers.get("location")).toBe("https://data.example.test/account?lang=en&error=oauth");
  expect(response.headers.getSetCookie()).toEqual([]);
});
it("keeps the error path usable when auth is unconfigured or the provider cancels", async () => {
  const response = await completeOAuth(new Request("https://data.example.test/auth/callback?error=provider-denied"), null);
  expect(response.headers.get("location")).toBe("https://data.example.test/account?lang=fa&error=oauth");
});
