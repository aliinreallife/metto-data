import { createServer } from "node:http";
import { beforeAll, afterAll, expect, it } from "vitest";
import { canUnlinkAccount } from "../apps/data-portal/lib/auth/accounts.ts";
import { completeOAuth } from "../apps/data-portal/lib/auth/callback.ts";
const cookieName = "__Secure-neon-auth.session_token";
const challenge = "__Secure-neon-auth.session_challenge=browser-challenge";
let baseUrl = "";
let exchanges = 0;
const server = createServer((request, response) => {
  const url = new URL(request.url!, "http://localhost");
  if (url.pathname !== "/auth/get-session") {
    response.writeHead(404).end();
    return;
  }
  const verifier = url.searchParams.get("neon_auth_session_verifier");
  if (verifier) {
    exchanges++;
    if (
      verifier !== "valid-test-verifier" ||
      !request.headers.cookie?.includes(challenge)
    ) {
      response.writeHead(401).end();
      return;
    }
    response.setHeader(
      "Set-Cookie",
      `${cookieName}=issued-test-session; Path=/; HttpOnly; Secure; SameSite=Lax`,
    );
  }
  response.setHeader("Content-Type", "application/json");
  response.end(
    JSON.stringify({
      user: {
        id: "verified-test-user",
        name: "Rider",
        email: "test@example.invalid",
        emailVerified: true,
      },
      session: {
        id: "test-session",
        userId: "verified-test-user",
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      },
    }),
  );
});
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw Error("Missing local test address");
  baseUrl = `http://127.0.0.1:${address.port}/auth`;
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
const config = () => ({
  baseUrl,
  cookieSecret: "local-callback-test-secret-over-thirty-two-characters",
});
it("exchanges a provider callback through the real SDK and sets the secure session before redirecting", async () => {
  const response = await completeOAuth(
    new Request(
      "https://data.example.test/auth/callback?lang=en&neon_auth_session_verifier=valid-test-verifier&next=https://other.example",
      { headers: { cookie: challenge } },
    ),
    config(),
  );
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe(
    "https://data.example.test/account?lang=en",
  );
  expect(
    response.headers
      .getSetCookie()
      .some(
        (value) =>
          value.startsWith(`${cookieName}=issued-test-session;`) &&
          /HttpOnly/i.test(value) &&
          /Secure/i.test(value),
      ),
  ).toBe(true);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  expect(await response.text()).toBe("");
});
it("rejects a callback without the browser challenge without contacting the provider", async () => {
  const before = exchanges;
  const response = await completeOAuth(
    new Request(
      "https://data.example.test/auth/callback?neon_auth_session_verifier=valid-test-verifier",
    ),
    config(),
  );
  expect(exchanges).toBe(before);
  expect(response.headers.get("location")).toBe(
    "https://data.example.test/account?lang=fa&error=oauth",
  );
  expect(response.headers.getSetCookie()).toEqual([]);
});
it("handles an invalid verifier without leaking it into the account URL or creating a session", async () => {
  const response = await completeOAuth(
    new Request(
      "https://data.example.test/auth/callback?lang=en&neon_auth_session_verifier=invalid-secret",
      { headers: { cookie: challenge } },
    ),
    config(),
  );
  expect(response.headers.get("location")).toBe(
    "https://data.example.test/account?lang=en&error=oauth",
  );
  expect(response.headers.getSetCookie()).toEqual([]);
});
it("keeps the error path usable when auth is unconfigured or the provider cancels", async () => {
  const response = await completeOAuth(
    new Request(
      "https://data.example.test/auth/callback?error=provider-denied",
    ),
    null,
  );
  expect(response.headers.get("location")).toBe(
    "https://data.example.test/account?lang=fa&error=oauth",
  );
});

it("allows unlinking only an owned supported account while another supported provider remains", () => {
  const google = { id: "google-own", providerId: "google" },
    github = { id: "github-own", providerId: "github" };
  expect(canUnlinkAccount([google], google.id)).toBe(false);
  expect(
    canUnlinkAccount(
      [google, { id: "password", providerId: "credential" }],
      google.id,
    ),
  ).toBe(false);
  expect(
    canUnlinkAccount(
      [google, { id: "another-google", providerId: "google" }],
      google.id,
    ),
  ).toBe(false);
  expect(canUnlinkAccount([google, github], "somebody-else")).toBe(false);
  expect(canUnlinkAccount([google, github], github.id)).toBe(true);
});
it("permits a completed link callback with an already verified existing session without minting a new identity", async () => {
  const result = await completeOAuth(
    new Request("https://data.example.test/auth/callback?lang=en&mode=link"),
    config(),
    true,
  );
  expect(result.headers.get("location")).toBe(
    "https://data.example.test/account?lang=en",
  );
  expect(result.headers.getSetCookie()).toEqual([]);
  const anonymous = await completeOAuth(
    new Request("https://data.example.test/auth/callback?lang=en&mode=link"),
    config(),
  );
  expect(anonymous.headers.get("location")).toContain("error=oauth");
});

it("returns an authenticated report author to review while retaining the SDK session exchange", async () => {
  const target = "/contribute?city=mashhad&lang=fa&resume=1";
  const url = new URL(
    "https://data.example.test/auth/callback?lang=fa&neon_auth_session_verifier=valid-test-verifier",
  );
  url.searchParams.set("returnTo", target);
  const response = await completeOAuth(
    new Request(url, { headers: { cookie: challenge } }),
    config(),
  );
  expect(response.headers.get("location")).toBe(
    "https://data.example.test" + target,
  );
  expect(
    response.headers.getSetCookie().some((c) => c.startsWith(cookieName + "=")),
  ).toBe(true);
});
it("returns a cancelled report login to its saved draft and blocks external return URLs", async () => {
  const target = "/contribute?city=mashhad&lang=fa&resume=1";
  const url = new URL("https://data.example.test/auth/callback?error=denied");
  url.searchParams.set("returnTo", target);
  const response = await completeOAuth(new Request(url), null);
  expect(response.headers.get("location")).toBe(
    "https://data.example.test" + target + "&error=oauth",
  );
  const bad = await completeOAuth(
    new Request(
      "https://data.example.test/auth/callback?returnTo=https://evil.test/",
    ),
    null,
  );
  expect(bad.headers.get("location")).toBe(
    "https://data.example.test/account?lang=fa&error=oauth",
  );
});
