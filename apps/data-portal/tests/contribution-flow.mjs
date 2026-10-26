import { checkThemePaint } from "./theme-paint.mjs";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const origin = "http://127.0.0.1:3017";
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3017",
  ],
  {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    stdio: "ignore",
    env: {
      ...process.env,
      DATA_PORTAL_ORIGIN: origin,
      DATA_PORTAL_QUOTA_SECRET: "local-test-only",
      DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/test",
      POSTGRES_URL: "",
      VERCEL_ENV: "development",
      VERCEL_URL: "",
      VERCEL_BRANCH_URL: "",
      GITHUB_TOKEN: "",
      NEON_AUTH_BASE_URL: "https://auth.example.invalid/auth",
      DATA_PORTAL_GITHUB_LOGIN: "1",
    },
  },
);
server.on("error", (error) => {
  throw error;
});
let browser;
try {
  for (let attempt = 0; ; attempt++) {
    try {
      if ((await fetch(origin + "/contribute")).ok) break;
    } catch {}
    if (attempt >= 120)
      throw Error("Test server did not start; run pnpm portal:build first.");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  browser = await chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  );
  await checkThemePaint(browser, origin);
  for (const path of [
    "email-otp/send-verification-otp",
    "sign-in/email-otp",
    "sign-in/email",
    "sign-up/email",
    "sign-in/magic-link",
  ]) {
    const response = await fetch(origin + "/api/auth/" + path, {
      method: "POST",
      headers: { origin, "Content-Type": "application/json" },
      body: "{}",
    });
    expect(response.status).toBe(404);
  }
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });

  const page = await context.newPage(),
    errors = [],
    sent = [],
    providers = [];
  // Disabled/loading controls can become enabled before their opacity transition
  // ends. Audit the settled screen rather than sampling an intermediate frame.
  async function auditPage() {
    await page.evaluate(async () => {
      await Promise.all(
        document
          .getAnimations()
          .filter(
            (animation) =>
              animation.effect?.getComputedTiming().endTime !== Infinity,
          )
          .map((animation) => animation.finished.catch(() => {})),
      );
    });
    return new AxeBuilder({ page }).analyze();
  }
  let signedIn = false,
    socialSucceeds = false;
  let savedProfile = null,
    profileRevision = null;
  const profileWrites = [];
  const avatarWrites = [];
  let avatar = null,
    avatarRevision = null,
    failAvatar = true;
  const photoFixture = JSON.parse(
    readFileSync(
      new URL("../../../tests/fixtures/report-photo.json", import.meta.url),
      "utf8",
    ),
  );
  await context.route("**/api/profile-photo", async (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      avatarWrites.push(body);
      if (failAvatar) {
        failAvatar = false;
        await route.fulfill({ status: 503, json: { error: "unavailable" } });
        return;
      }
      avatar = body.photo;
      avatarRevision = avatar ? String(avatarWrites.length) : null;
    }
    await route.fulfill({
      json: {
        url: avatar
          ? "/api/profile-photos/" + "a".repeat(64) + "?v=" + avatarRevision
          : null,
        revision: avatarRevision,
      },
    });
  });
  await context.route("**/api/profile-photos/**", async (route) => {
    await route.fulfill({
      contentType: "image/jpeg",
      body: Buffer.from(avatar ?? photoFixture.jpeg, "base64"),
    });
  });
  let linkedAccounts = [{ id: "google-account-id", providerId: "google" }];
  page.on("pageerror", (error) =>
    errors.push(new URL(page.url()).pathname + ": " + error.message),
  );
  const user = {
    id: "mock-verified-user",
    name: "provider-private-email@example.test",
    email: "provider-private-email@example.test",
    emailVerified: true,
  };
  await context.route("**/api/auth/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/get-session")) {
      await route.fulfill({
        json: signedIn
          ? {
              user,
              session: {
                id: "mock-session",
                userId: user.id,
                expiresAt: new Date(Date.now() + 3600000).toISOString(),
              },
            }
          : null,
      });
      return;
    }
    if (path.endsWith("/sign-in/social")) {
      const body = route.request().postDataJSON();
      providers.push(body.provider);
      const callback = new URL(body.callbackURL);
      expect(callback.origin + callback.pathname).toBe(
        origin + "/auth/callback",
      );
      expect(callback.searchParams.get("lang")).toBe("en");
      if (socialSucceeds) {
        signedIn = true;
        await route.fulfill({
          json: {
            url:
              origin +
              (callback.searchParams.get("returnTo") || "/account?lang=en"),
            redirect: true,
          },
        });
        return;
      }
      await route.fulfill({
        status: 400,
        json: { code: "PROVIDER_NOT_ENABLED" },
      });
      return;
    }
    if (path.endsWith("/list-accounts")) {
      await route.fulfill({ json: linkedAccounts });
      return;
    }
    if (path.endsWith("/link-social")) {
      const body = route.request().postDataJSON();
      expect(body.provider).toBe("github");
      expect(body.callbackURL).toContain("/auth/callback?lang=en&mode=link");
      linkedAccounts = [
        ...linkedAccounts,
        { id: "github-account-id", providerId: "github" },
      ];
      await route.fulfill({
        json: { url: origin + "/account?lang=en", redirect: true },
      });
      return;
    }
    if (path.endsWith("/unlink-account")) {
      const body = route.request().postDataJSON();
      expect(body.accountId).toBe("github-account-id");
      linkedAccounts = linkedAccounts.filter(
        (account) => account.id !== body.accountId,
      );
      await route.fulfill({ json: { status: true } });
      return;
    }
    if (path.endsWith("/sign-out")) {
      signedIn = false;
      await route.fulfill({ json: { success: true } });
      return;
    }
    throw Error("Unexpected auth request in mock: " + path);
  });
  await context.route("**/api/profile", async (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      if (body.profile.username === "taken_user") {
        await route.fulfill({ status: 409, json: { error: "username_taken" } });
        return;
      }
      profileWrites.push(body);
      savedProfile = structuredClone(body.profile);
      if (savedProfile.socialLinks.x)
        savedProfile.socialLinks.x =
          "https://x.com/" + savedProfile.socialLinks.x.replace(/^@/, "");
      user.name = savedProfile.name;
      profileRevision = String(profileWrites.length);
    }
    await route.fulfill({
      json: {
        profile: savedProfile,
        revision: profileRevision,
        id: "a".repeat(64),
      },
    });
  });
  await context.route("**/api/reports", async (route) => {
    const body = route.request().postDataJSON();
    sent.push(body);
    await route.fulfill({
      status: sent.length === 1 ? 503 : 202,
      json: sent.length === 1 ? { error: "busy" } : { id: body.id },
    });
  });
  async function choose(text) {
    await page
      .getByTestId("report-types")
      .getByRole("button")
      .filter({ hasText: text })
      .click();
  }
  async function selectDirection(destination, lang = "en") {
    const direct = page.getByRole("button", {
      name: (lang === "fa" ? "به سمت " : "Toward ") + destination,
      exact: true,
    });
    if (await direct.isVisible()) {
      await direct.click();
      return;
    }
    await page
      .getByRole("combobox", {
        name: lang === "fa" ? /^جهت حرکت قطار/ : /^Direction of travel/,
      })
      .click();
    await page.getByRole("option").filter({ hasText: destination }).click();
  }
  async function review() {
    await page
      .getByRole("button", { name: "Review report", exact: true })
      .click();
    await expect(page.getByTestId("report-review")).toBeVisible();
  }
  async function send() {
    await page
      .getByRole("button", { name: "Yes, send report", exact: true })
      .click();
  }
  async function another() {
    await page
      .getByRole("button", { name: "Send another report", exact: true })
      .click();
    await expect(page.getByTestId("report-types")).toBeVisible();
  }
  await page.goto(
    `${origin}/contribute?city=mashhad&station=mashhad:station:basij&kind=timetable&lang=en`,
  );
  await choose("Train times");
  await expect(page.locator("input[name=stationId]")).toHaveValue(
    "mashhad:station:basij",
  );
  await page
    .getByRole("textbox", { name: "Description (optional)", exact: true })
    .fill("Weekday times observed today");
  await expect(page.locator("input[name=contact]")).toHaveCount(0);
  await page.locator("input[name=photo]").setInputFiles({
    name: "board.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page
    .getByRole("button", { name: "Change report type", exact: true })
    .click();
  await choose("Train times");
  await expect(
    page.getByRole("textbox", { name: "Description (optional)", exact: true }),
  ).toHaveValue("Weekday times observed today");
  expect(
    await page
      .locator("input[name=photo]")
      .evaluate((input) => input.files.length),
  ).toBe(1);
  await page.getByRole("button", { name: /Station \(optional\)/ }).click();
  const stationSearch = page.getByRole("combobox", {
    name: "Search stations",
    exact: true,
  });
  await stationSearch.fill("بسيج");
  await expect(
    page.getByRole("option", { name: "Basij", exact: true }),
  ).toBeVisible();
  await stationSearch.press("Home");
  await stationSearch.press("Enter");
  await expect(
    page.getByRole("button", { name: /Station \(optional\)/ }),
  ).toBeFocused();
  await page.getByRole("button", { name: /Station \(optional\)/ }).click();
  await stationSearch.press("Tab");
  await expect(
    page.getByRole("textbox", {
      name: "Line and direction (optional)",
      exact: true,
    }),
  ).toBeFocused();
  await review();
  expect(sent).toHaveLength(0);
  await page.getByRole("radio", { name: /Leave a private contact/ }).check();
  await page
    .getByRole("textbox", { name: "Name (optional)", exact: true })
    .fill("Private reporter");
  await page
    .getByRole("textbox", {
      name: "Email or contact handle (optional)",
      exact: true,
    })
    .fill("private-contact@example.test");
  await page
    .getByRole("radio", { name: /Sign in for contributor credit/ })
    .check();
  await page
    .getByRole("link", { name: "Continue to sign in", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Sign-in did not finish",
  );
  await page.getByRole("link", { name: "Continue draft", exact: true }).click();
  await expect(page.getByTestId("report-review")).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Photo to be sent with your report" }),
  ).toBeVisible();
  socialSucceeds = true;
  await page
    .getByRole("link", { name: "Continue to sign in", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Continue with Google", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await expect(page.getByTestId("report-review")).toBeVisible();
  await page.getByRole("radio", { name: /Leave a private contact/ }).check();
  await expect(
    page.getByRole("textbox", { name: "Name (optional)", exact: true }),
  ).toHaveValue("Private reporter");
  await expect(
    page.getByRole("textbox", {
      name: "Email or contact handle (optional)",
      exact: true,
    }),
  ).toHaveValue("private-contact@example.test");
  await page.reload();
  await expect(page.getByTestId("report-review")).toBeVisible();
  await page.getByRole("radio", { name: /Send anonymously/ }).check();
  expect(sent).toHaveLength(0);
  await expect(page.getByTestId("report-review")).toBeVisible();
  await expect(page.getByTestId("report-review")).toContainText(
    "Weekday times observed today",
  );
  await expect(
    page.getByRole("img", { name: "Photo to be sent with your report" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Remove photo and edit report", exact: true })
    .click();
  expect(
    await page
      .locator("input[name=photo]")
      .evaluate((input) => input.files.length),
  ).toBe(0);
  await expect(
    page.getByRole("textbox", { name: "Description (optional)", exact: true }),
  ).toHaveValue("Weekday times observed today");
  await review();
  await expect(
    page.getByRole("img", { name: "Photo to be sent with your report" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Edit information", exact: true })
    .click();
  await page.locator("input[name=photo]").setInputFiles({
    name: "board.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(
    page.getByRole("textbox", { name: "Description (optional)", exact: true }),
  ).toHaveValue("Weekday times observed today");
  await review();
  await send();
  await expect(
    page.getByTestId("report-review").getByRole("alert"),
  ).toContainText("cannot receive");
  await send();
  await expect(
    page.getByRole("heading", {
      name: "Thank you! Your report was received for review.",
    }),
  ).toBeVisible();
  expect(sent[0].id).toBe(sent[1].id);
  expect(sent[1].photo).toBeTruthy();
  expect(sent[1].publicCredit).toBe(false);
  expect(sent[1].name).toBe("");
  expect(sent[1].contact).toBe("");
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("metto:contribution-draft:v1"),
    ),
  ).toBeNull();
  await another();
  await choose("Car near an escalator");
  await expect(page.getByRole("spinbutton")).toHaveCount(0);
  await expect(page.getByTestId("train-fixed-count")).toContainText("3");
  await page.getByRole("button", { name: "Car 2", exact: true }).click();
  await page
    .getByRole("button", { name: "Review report", exact: true })
    .click();
  await expect(
    page.getByTestId("report-form").getByRole("alert"),
  ).toContainText("station and direction");
  expect(sent).toHaveLength(2);
  await selectDirection("Airport");
  await expect(
    page.getByRole("button", { name: "Car 2", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.locator('[data-diagram-car="2"]').click();
  await expect(page.getByTestId("train-head-destination")).toHaveText(
    "Toward Airport",
  );
  await expect(
    page.getByRole("status").filter({ hasText: "Selected car" }),
  ).toContainText("2");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await review();
  await expect(page.getByTestId("report-review")).toContainText("Car 2 of 3");
  await expect(page.getByTestId("report-review")).toContainText(
    "Line 1 toward Airport",
  );
  await page
    .getByRole("button", { name: "Edit information", exact: true })
    .click();
  await expect(page.locator('input[name="wagonDirection"]')).toHaveValue(
    "mashhad:route:line-1-main|mashhad:station:airport",
  );
  await expect(page.locator('[data-diagram-car="2"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await review();
  await send();
  await expect(
    page.getByRole("heading", {
      name: "Thank you! Your report was received for review.",
    }),
  ).toBeVisible();
  expect(sent[2].details).toContain("Car 2 of 3");
  expect(sent[2].wagon.profileId).toBe("mashhad:line1:3");
  expect(sent[2].wagon.destinationId).toBe("mashhad:station:airport");
  expect(sent[2].wagon.exitId).toBe("up-escalator");
  expect(sent[2].details).not.toContain("layout reference");
  await another();
  await choose("Station amenities");
  await page
    .getByRole("button", { name: "Review report", exact: true })
    .click();
  await expect(
    page.getByTestId("report-form").getByRole("alert"),
  ).toContainText("Write some information");
  await page.getByRole("combobox", { name: /^Amenity / }).click();
  await page.getByRole("option", { name: "Elevator", exact: true }).click();
  await page
    .getByRole("button", { name: "Not available", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add another amenity", exact: true })
    .click();
  await page.getByRole("combobox", { name: /^Amenity 2 / }).click();
  await page.getByRole("option", { name: "Toilets", exact: true }).click();
  await page
    .getByRole("group", { name: "What you observed", exact: true })
    .nth(1)
    .getByRole("button", { name: "Available", exact: true })
    .click();
  await page.reload();
  await expect(page.locator("input[name=amenity]").nth(0)).toHaveValue(
    "elevator",
  );
  await expect(page.locator("input[name=amenity]").nth(1)).toHaveValue("wc");
  await review();
  await expect(page.getByTestId("report-review")).toContainText(
    "Elevator: Not available",
  );
  await expect(page.getByTestId("report-review")).toContainText(
    "Toilets: Available",
  );
  await send();
  await expect(
    page.getByRole("heading", {
      name: "Thank you! Your report was received for review.",
    }),
  ).toBeVisible();
  expect(sent[3].details).toContain("Toilets: Available");
  await another();
  await choose("Suggest a city or line");
  await expect(page.locator("input[name=cityId]")).toHaveValue("other");
  await page
    .getByRole("textbox", { name: "City and line name", exact: true })
    .fill("New city, Line 1");
  await page
    .getByRole("textbox", { name: "Description (optional)", exact: true })
    .fill("A source for the proposed city");
  await review();
  await send();
  await expect(
    page.getByRole("heading", {
      name: "Thank you! Your report was received for review.",
    }),
  ).toBeVisible();
  expect(sent[4].kind).toBe("city_request");
  // Provider requests are intercepted; no third-party account changes occur.
  signedIn = false;
  socialSucceeds = false;
  providers.length = 0;
  await page.goto(`${origin}/account?lang=en`);
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Sign-in did not finish",
  );
  await page
    .getByRole("button", { name: "Continue with GitHub", exact: true })
    .click();
  expect(providers).toEqual(["google", "github"]);
  expect(
    await page.locator('input[type="email"], input[name="otp"]').count(),
  ).toBe(0);
  socialSucceeds = true;
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Log out", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save profile", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Private profile name");
  await page
    .getByRole("spinbutton", { name: "Age (optional)", exact: true })
    .fill("29");
  await page.getByRole("combobox", { name: /Gender \(optional\)/ }).click();
  await page.getByRole("option", { name: "Woman", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: /Show my profile publicly/ }),
  ).not.toBeChecked();
  const usernameInput = page.getByRole("textbox", {
    name: "Username",
    exact: true,
  });
  // The photo has its own preview/save lifecycle and cannot submit/reset profile text.
  const avatarInput = page.locator("#profile-photo-file");
  await expect(page.getByTestId("profile-avatar")).toHaveAttribute(
    "data-avatar-kind",
    "blobatar",
  );
  if (process.env.UI_SCREENSHOTS_DIR) {
    await page.evaluate(() => {
      document.activeElement?.blur();
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: join(
        process.env.UI_SCREENSHOTS_DIR,
        "profile-photo-account-mobile.png",
      ),
      fullPage: true,
    });
  }
  await avatarInput.setInputFiles({
    name: "unsupported.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg></svg>"),
  });
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Choose a JPG, PNG or WebP",
  );
  const uploadFixture = {
    name: "photo.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from(photoFixture.jpeg, "base64"),
  };
  await avatarInput.setInputFiles(uploadFixture);
  await expect(page.getByTestId("profile-avatar")).toHaveAttribute(
    "src",
    /^data:image\/jpeg;base64,/,
  );
  expect(avatarWrites).toHaveLength(0);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByTestId("profile-avatar")).toHaveAttribute(
    "data-avatar-kind",
    "blobatar",
  );
  await avatarInput.setInputFiles(uploadFixture);
  await page.getByRole("button", { name: "Save photo", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Photo not saved",
  );
  await expect(
    page.getByRole("textbox", { name: "Name", exact: true }),
  ).toHaveValue("Private profile name");
  await expect(
    page.getByRole("button", { name: "Save photo", exact: true }),
  ).toBeVisible();
  expect(profileWrites).toHaveLength(0);
  await page.getByRole("button", { name: "Save photo", exact: true }).click();
  await expect(
    page.getByText("Your profile photo is saved.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("profile-avatar")).toHaveAttribute(
    "src",
    /^\/api\/profile-photos\//,
  );
  expect(avatarWrites[1].revision).toBe(null);
  expect(
    Buffer.from(avatarWrites[1].photo, "base64").length,
  ).toBeLessThanOrEqual(65536);
  const avatarAudit = await auditPage();
  expect(
    avatarAudit.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
  await page.getByRole("button", { name: "Remove photo", exact: true }).click();
  await expect(page.getByTestId("profile-avatar")).toHaveAttribute(
    "data-avatar-kind",
    "blobatar",
  );
  expect(avatarWrites[2]).toEqual({ photo: null, revision: "2" });
  await expect(
    page.getByRole("textbox", { name: "Name", exact: true }),
  ).toHaveValue("Private profile name");
  expect(profileWrites).toHaveLength(0);
  await usernameInput.fill("ab");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  expect(await usernameInput.evaluate((input) => input.validity.valid)).toBe(
    false,
  );
  expect(profileWrites).toHaveLength(0);
  await usernameInput.fill("rail_helper");
  await page
    .getByRole("textbox", { name: "Bio (optional)", exact: true })
    .fill("I help with metro data.");
  await page.getByRole("combobox", { name: /Add a link/ }).click();
  await page.getByRole("option", { name: "X", exact: true }).click();
  await page.locator("#social-x").fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "One of the links is invalid",
  );
  expect(profileWrites).toHaveLength(0);
  await page.locator("#social-x").fill("@metto_user");
  await usernameInput.fill("taken_user");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "That username is already taken",
  );
  await expect(
    page.getByRole("textbox", { name: "Bio (optional)", exact: true }),
  ).toHaveValue("I help with metro data.");
  await usernameInput.fill("rail_helper");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByText("Your profile is saved.", { exact: true }),
  ).toBeVisible();
  expect(profileWrites[0].profile).toMatchObject({
    age: 29,
    gender: "woman",
    publicProfile: false,
  });
  await expect(
    page.getByRole("link", { name: /View public profile/ }),
  ).toHaveAttribute("href", "/contributors/rail_helper?lang=en");
  await page
    .getByRole("checkbox", { name: /Show my profile publicly/ })
    .check();
  await page
    .getByRole("textbox", { name: "Public name", exact: true })
    .fill("Rail helper");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByRole("link", { name: /View public profile/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Login accounts", exact: true })
    .click();
  const providerRow = (name) =>
    page
      .getByRole("heading", { name, exact: true })
      .locator("..")
      .locator("..");
  await expect(
    providerRow("Google").getByRole("button", {
      name: "Disconnect",
      exact: true,
    }),
  ).toBeDisabled();
  await providerRow("GitHub")
    .getByRole("button", { name: "Connect", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Login accounts", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Login accounts", exact: true })
    .click();
  await expect(providerRow("GitHub")).toContainText("Connected");
  await providerRow("GitHub")
    .getByRole("button", { name: "Disconnect", exact: true })
    .click();
  await expect(providerRow("GitHub")).toContainText("Not connected");
  await expect(
    providerRow("Google").getByRole("button", {
      name: "Disconnect",
      exact: true,
    }),
  ).toBeDisabled();
  await page.goto(`${origin}/contribute?city=mashhad&lang=en`);
  await choose("Other information");
  await page
    .getByRole("textbox", { name: "Description (optional)", exact: true })
    .fill("Credited observation");
  await review();
  await expect(
    page.getByRole("radio", { name: /Send anonymously/ }),
  ).toBeChecked();
  await page.getByRole("radio", { name: /Use my account/ }).check();
  await expect(page.getByTestId("account-report-name")).toContainText(
    "Private profile name",
  );
  await expect(
    page.getByRole("textbox", { name: "Display name", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Name (optional)", exact: true }),
  ).toHaveCount(0);
  await send();
  await expect(
    page.getByRole("heading", {
      name: "Thank you! Your report was received for review.",
    }),
  ).toBeVisible();
  expect(sent[5].publicNameSource).toBe("account");
  expect(sent[5].publicName).toBeUndefined();
  expect(sent[5].contact).toBe("");
  expect(sent[5].publicCredit).toBe(true);
  for (const lang of ["en", "fa"]) {
    await page.goto(`${origin}/contribute?city=mashhad&lang=${lang}`);
    await page.getByTestId("report-types").getByRole("button").nth(1).click();
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      const audit = await auditPage();
      expect(
        audit.violations.filter((v) =>
          ["serious", "critical"].includes(v.impact ?? ""),
        ),
      ).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.goto(`${origin}/account?lang=${lang}`);
    await expect(
      page.getByRole("button", {
        name: lang === "fa" ? "خروج" : "Log out",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: lang === "fa" ? "ذخیرهٔ پروفایل" : "Save profile",
        exact: true,
      }),
    ).toBeEnabled();
    const audit = await auditPage();
    expect(
      audit.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      ),
    ).toEqual([]);
  }
  await page.goto(`${origin}/map?city=mashhad&lang=en`);
  await expect(page.getByTestId("construction-section")).toHaveCount(5);
  await expect(page.getByTestId("future-stop")).toHaveCount(30);
  await expect(page.locator("svg[role=group] a")).toHaveCount(36);
  await page.goto(`${origin}/map?city=tehran&lang=en`);
  await expect(page.getByTestId("construction-section")).toHaveCount(0);
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto(`${origin}/contribute?city=tehran&lang=en`);
  await choose("Car near an escalator");
  const selectLayout = async (name) => {
    await page.getByRole("combobox", { name: /The train you saw/ }).click();
    await page.getByRole("option", { name, exact: true }).click();
  };
  const diagram = page.getByTestId("train-diagram");
  await expect(page.getByTestId("train-fixed-count")).toContainText("7");
  await expect(page.getByRole("spinbutton")).toHaveCount(0);
  await expect(diagram.locator("[data-car-number]")).toHaveCount(7);
  await expect(page.getByTestId("train-overview")).toHaveAttribute(
    "data-head-side",
    "right",
  );
  await expect(diagram.locator("[data-car-number]").last()).toHaveAttribute(
    "data-car-number",
    "1",
  );
  const endRadii = await diagram
    .locator("[data-train-end]")
    .evaluateAll((ends) =>
      ends.map((el) => ({
        end: el.dataset.trainEnd,
        radius: el.style.borderRadius,
      })),
    );
  expect(endRadii.find((end) => end.end === "head").radius).toBe(
    "6px 28px 12px 6px",
  );
  expect(endRadii.find((end) => end.end === "rear").radius).toBe("6px");
  await expect(diagram.getByTestId("train-window")).toHaveCount(7);
  await expect(diagram.getByTestId("women-only-icon")).toHaveCount(5);
  await expect(diagram.locator('[data-women-zone="full"]')).toHaveCount(2);
  await expect(
    diagram.locator(
      '[data-women-zone="head-half"], [data-women-zone="rear-half"]',
    ),
  ).toHaveCount(2);
  await selectDirection("Tajrish");
  await page.locator('[data-diagram-car="2"]').focus();
  await page.locator('[data-diagram-car="2"]').press("Space");
  await expect(page.getByTestId("train-head-destination")).toHaveText(
    "Toward Tajrish",
  );
  await page.getByRole("button", { name: "Flip train", exact: true }).click();
  await expect(diagram.locator("[data-car-number]").first()).toHaveAttribute(
    "data-car-number",
    "1",
  );
  await expect(page.getByTestId("train-overview")).toHaveAttribute(
    "data-head-side",
    "left",
  );
  await expect(
    page.getByRole("button", { name: "Car 2", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("train-head-destination")).toHaveText(
    "Toward Tajrish",
  );
  await selectDirection("Kahrizak");
  await expect(
    page.getByRole("button", { name: "Car 2", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("train-head-destination")).toHaveText(
    "Toward Kahrizak",
  );
  await selectLayout("Tehran–Karaj · double-deck, 9 cars");
  await expect(page.locator('input[name="wagonDirection"]')).toHaveValue("");
  await expect(diagram.locator("[data-car-number]")).toHaveCount(9);
  await expect(diagram).toContainText("locomotives are not included");
  await expect(diagram).toContainText(
    "Women-only coaches are reported on Tehran–Karaj",
  );
  await expect(diagram.locator('[data-women-zone="full"]')).toHaveCount(0);
  await expect(diagram.locator('[data-women-zone="unknown"]')).toHaveCount(9);
  await expect(diagram.getByTestId("train-window")).toHaveCount(18);
  await expect(diagram.locator("[data-diagram-car]")).toHaveCount(9);
  const overview = await page.getByTestId("train-overview").boundingBox();
  expect(overview.x).toBeGreaterThanOrEqual(0);
  expect(overview.x + overview.width).toBeLessThanOrEqual(360);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const trainAudit = await auditPage();
  expect(
    trainAudit.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
  await page
    .getByTestId("report-form")
    .getByRole("combobox", { name: /^City/ })
    .click();
  await page.getByRole("option", { name: "Mashhad", exact: true }).click();
  await expect(page.getByRole("spinbutton")).toHaveCount(0);
  await expect(page.getByTestId("train-fixed-count")).toContainText("3");
  await expect(
    diagram.locator('[data-women-zone="head-half"]'),
  ).toHaveAttribute("data-car-number", "1");
  await expect(
    diagram.locator('[data-women-zone="rear-half"]'),
  ).toHaveAttribute("data-car-number", "3");
  await expect(diagram.locator('[data-women-zone="general"]')).toHaveAttribute(
    "data-car-number",
    "2",
  );
  await expect(
    diagram.locator('[aria-pressed="true"][data-car-number]'),
  ).toHaveCount(0);
  await selectLayout("Mashhad Line 2 · 5 cars");
  await expect(diagram.locator("[data-car-number]")).toHaveCount(5);
  await expect(diagram.locator('[data-women-zone="full"]')).toHaveCount(0);
  for (const [city, station, count] of [
    ["mashhad", "mashhad:station:tabarsi", 5],
    ["tehran", "tehran:station:mehrabad-airport-terminal-1-2", 4],
  ]) {
    await page.goto(
      `${origin}/contribute?city=${city}&station=${station}&lang=en`,
    );
    await choose("Car near an escalator");
    await expect(page.getByTestId("train-fixed-count")).toContainText(
      String(count),
    );
    await expect(diagram.locator("[data-car-number]")).toHaveCount(count);
    await expect(page.getByRole("spinbutton")).toHaveCount(0);
  }
  for (const lang of ["fa", "en"]) {
    await page.goto(`${origin}/contribute?city=mashhad&lang=${lang}`);
    await choose(lang === "fa" ? "کدام واگن" : "Car near an escalator");
    await selectDirection(lang === "fa" ? "فرودگاه" : "Airport", lang);
    await page.locator('[data-diagram-car="1"]').press("Enter");
    for (const mode of ["light", "dark"]) {
      await page.evaluate(async (mode) => {
        document.documentElement.classList.toggle("dark", mode === "dark");
        await Promise.all(
          document
            .getAnimations()
            .map((animation) => animation.finished.catch(() => {})),
        );
      }, mode);
      const audit = await auditPage();
      expect(
        audit.violations.filter((v) =>
          ["serious", "critical"].includes(v.impact ?? ""),
        ),
      ).toEqual([]);
    }
  }
  for (const lang of ["fa", "en"]) {
    for (const kind of [
      "timetable",
      "facility",
      "status",
      "location",
      "wagon",
      "other",
      "city_request",
    ]) {
      await page.goto(
        origin +
          "/contribute?city=tehran&station=tehran:station:shohada-ye-hefdah-e-shahrivar&lang=" +
          lang,
      );
      await page
        .getByTestId("report-types")
        .locator('[data-kind="' + kind + '"]')
        .click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(await page.locator("input[name=contact]").count()).toBe(0);
      const audit = await auditPage();
      expect(
        audit.violations.filter((v) =>
          ["serious", "critical"].includes(v.impact ?? ""),
        ),
      ).toEqual([]);
    }
  }
  await page.goto(origin + "/reports?lang=fa");
  await expect(
    page.getByRole("link", {
      name: "۱۷ شهریور فعلاً فقط در خط ۷ فعاله.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("علی رشیدی", { exact: true })).toBeVisible();
  signedIn = false;
  const fallback = await context.newPage();
  await fallback.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "metto:contribution-draft:v1")
        throw new DOMException("Full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await fallback.goto(origin + "/contribute?city=mashhad&lang=en");
  await fallback
    .getByTestId("report-types")
    .locator('[data-kind="other"]')
    .click();
  await fallback
    .getByRole("textbox", { name: "Description (optional)", exact: true })
    .fill("Keep this draft when storage is blocked");
  await fallback
    .getByRole("button", { name: "Review report", exact: true })
    .click();
  await fallback
    .getByRole("radio", { name: /Sign in for contributor credit/ })
    .check();
  const popupWait = fallback.waitForEvent("popup");
  await fallback
    .getByRole("link", { name: "Continue to sign in", exact: true })
    .click();
  const popup = await popupWait;
  await expect(
    popup.getByRole("button", { name: "Continue with Google", exact: true }),
  ).toBeVisible();
  await expect(fallback.getByTestId("report-review")).toContainText(
    "Keep this draft when storage is blocked",
  );
  await popup
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await expect(
    popup.getByRole("button", { name: "Log out", exact: true }),
  ).toBeVisible();
  await popup.close();
  await fallback.bringToFront();
  await fallback.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(fallback.getByTestId("account-report-name")).toBeVisible();
  await expect(fallback.getByTestId("report-review")).toContainText(
    "Keep this draft when storage is blocked",
  );
  await fallback.close();
  // Community interaction is entirely mocked; no real votes or GitHub issues.
  const reportId = "d2345678-1234-4123-8123-123456789abc";
  let community = {
    id: reportId,
    confirm: 2,
    deny: 0,
    myVote: null,
    threshold: 3,
    queued: false,
    notified: false,
    decision: null,
    automatic: 1,
    manual: false,
    report: {
      title: "Basij",
      details: "The elevator is working.",
      source: "Observed today",
      cityId: "mashhad",
      stationId: "mashhad:station:basij",
      issueUrl: "https://github.com/aliinreallife/metto-data/issues/101",
    },
  };
  const voteWrites = [];
  await context.route("**/api/community**", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      voteWrites.push(body);
      if (community.myVote === "confirm") community.confirm--;
      if (community.myVote === "deny") community.deny--;
      community.myVote = body.choice;
      if (body.choice) community[body.choice]++;
      community.queued = community.confirm >= 3 || community.deny >= 3;
    }
    await route.fulfill({ json: community });
  });
  signedIn = false;
  await page.goto(`${origin}/reports?report=${reportId}&lang=en`);
  await expect(page.getByTestId("community-report")).toContainText(
    "The elevator is working.",
  );
  await page
    .getByRole("link", { name: "Sign in to confirm or disagree", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/reports\\?report=${reportId}`), {
    timeout: 20000,
  });
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Confirm", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("community-report")).toContainText(
    "Queued for maintainer review.",
  );
  expect(voteWrites[0]).toEqual({ reportId, choice: "confirm" });
  await page.getByRole("button", { name: "Disagree", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Disagree", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Withdraw my vote", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Withdraw my vote", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Change theme", exact: true }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  for (const lang of ["fa", "en"]) {
    await page.goto(`${origin}/reports?report=${reportId}&lang=${lang}`);
    const audit = await auditPage();
    expect(
      audit.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      ),
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  community = { ...community, decision: "manual", manual: true };
  await page.reload();
  await expect(page.getByTestId("community-report")).toContainText(
    "Referred to the maintainer for a manual update.",
  );
  await expect(
    page.getByRole("button", { name: "Confirm", exact: true }),
  ).toHaveCount(0);
  await page.goto(`${origin}/stations?lang=en`);
  await page.getByRole("combobox", { name: /Filter by line/ }).click();
  await page
    .getByRole("option", { name: "Mashhad · Line 1", exact: true })
    .click();
  expect(await page.getByTestId("station-card").count()).toBe(24);
  await page
    .getByRole("searchbox", { name: "Search stations or cities", exact: true })
    .fill("Basij");
  expect(await page.getByTestId("station-card").count()).toBe(1);
  await page
    .getByRole("button", { name: "Clear search and line filter", exact: true })
    .click();
  expect(await page.getByTestId("station-card").count()).toBe(187);
  await page.goto(`${origin}/map?city=mashhad&lang=en`);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.locator("figure svg[role=group]")).toHaveAttribute(
    "style",
    /150%/,
  );
  await page.getByRole("button", { name: "Reset zoom", exact: true }).click();
  await expect(page.locator("figure svg[role=group]")).toHaveAttribute(
    "style",
    /100%/,
  );
  await page.goto(`${origin}/reports?lang=fa`);
  const ownerLink = page.getByRole("link", { name: "علی رشیدی", exact: true });
  await expect(ownerLink).toHaveAttribute(
    "href",
    "/contributors/github-91134550?lang=fa",
  );
  await ownerLink.click();
  await expect(
    page.getByRole("heading", { level: 1, name: "علی رشیدی", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("۱ مشارکت پذیرفته‌شده", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/این اصلاح قبلاً با منبع/)).toBeVisible();
  await expect(page.getByTestId("profile-avatar")).toHaveAttribute(
    "data-avatar-kind",
    "blobatar",
  );
  await expect(page.locator("main time")).toHaveCount(1);
  for (const lang of ["fa", "en"]) {
    await page.goto(`${origin}/contributors/github-91134550?lang=${lang}`);
    const accepted = page
      .getByRole("group", {
        name: lang === "fa" ? "نمایش مشارکت‌ها" : "Filter contributions",
      })
      .getByRole("button", {
        name: lang === "fa" ? "پذیرفته‌شده" : "Accepted",
        exact: true,
      });
    await accepted.click();
    await expect(accepted).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("main time")).toHaveCount(1);
    await page
      .getByRole("button", {
        name: lang === "fa" ? "کپی لینک پروفایل" : "Copy profile link",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("status").filter({
        hasText:
          lang === "fa" ? "لینک پروفایل کپی شد." : "Profile link copied.",
      }),
    ).toBeVisible();
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const dark of [false, true]) {
        await page.evaluate(
          (value) => document.documentElement.classList.toggle("dark", value),
          dark,
        );
        const audit = await auditPage();
        expect(
          audit.violations.filter((v) =>
            ["serious", "critical"].includes(v.impact ?? ""),
          ),
        ).toEqual([]);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        if (process.env.UI_SCREENSHOTS_DIR)
          await page.screenshot({
            path: join(
              process.env.UI_SCREENSHOTS_DIR,
              `public-profile-${lang}-${width}-${dark ? "dark" : "light"}.png`,
            ),
            fullPage: true,
          });
      }
    }
  }
  await page.goto(`${origin}/leaderboard?lang=en`);
  await expect(
    page.getByRole("link", { name: "علی رشیدی", exact: true }),
  ).toHaveAttribute("href", "/contributors/github-91134550?lang=en");
  await expect(
    page.getByText("1 accepted contributions", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    "Passed: theme before hydration, link navigation and reload without light frames; head right, only curved nose, framed windows and women pictograms; three-step confirmation without early writes; draft/photo retention; keyboard/search/Tab; multi-amenity, wagon and city reports; retries; Google/GitHub-only login UI; account name without duplicate contact fields; private profiles/social links and connected logins; city train layouts/full-half women sections/flip; FA/EN mobile/desktop accessibility; future map geometry isolated from boarding stations. Profile-photo preview/save/retry/remove with unsaved text retained; Blobatar defaults, dated public activity, filters and sharing. All auth/report/photo writes mocked.",
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
