import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { spawn } from "node:child_process";
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
  let signedIn = false,
    socialSucceeds = false;
  let savedProfile = null,
    profileRevision = null;
  const profileWrites = [];
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
      expect(body.callbackURL).toBe(origin + "/auth/callback?lang=en");
      if (socialSucceeds) {
        signedIn = true;
        await route.fulfill({
          json: { url: origin + "/account?lang=en", redirect: true },
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
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("Weekday times observed today");
  await page
    .getByText("Add a photo or source link (optional)", { exact: true })
    .click();
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
    page.getByRole("textbox", { name: "Description", exact: true }),
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
  const popupWait = page.waitForEvent("popup");
  await page.getByRole("link", { name: /Optional login/ }).click();
  const loginPopup = await popupWait;
  await expect(
    loginPopup.getByRole("button", {
      name: "Continue with Google",
      exact: true,
    }),
  ).toBeVisible();
  await loginPopup.close();
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
    page.getByRole("textbox", { name: "Description", exact: true }),
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
    page.getByRole("textbox", { name: "Description", exact: true }),
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
  await page.getByRole("combobox", { name: /^Direction of travel/ }).click();
  await page
    .getByRole("option", { name: "Line 1 · Toward Airport", exact: true })
    .click();
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
    "Line 1 · Toward Airport",
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
  expect(sent[2].details).toContain("mashhad:line1:3");
  expect(sent[2].details).toContain(
    "direction: toward Airport (mashhad:station:airport)",
  );
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
  await page.getByRole("combobox", { name: /^What you observed / }).click();
  await page
    .getByRole("option", { name: "Not available", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add another amenity", exact: true })
    .click();
  await page.getByRole("combobox", { name: /^Amenity 2 / }).click();
  await page.getByRole("option", { name: "Toilets", exact: true }).click();
  await page
    .getByRole("combobox", { name: /^What you observed / })
    .nth(1)
    .click();
  await page.getByRole("option", { name: "Available", exact: true }).click();
  await review();
  await expect(page.getByTestId("report-review")).toContainText(
    "Elevator: Not available · Toilets: Available",
  );
  await send();
  await expect(
    page.getByRole("heading", {
      name: "Thank you! Your report was received for review.",
    }),
  ).toBeVisible();
  expect(sent[3].details).toContain("Amenity: wc; observed value: true");
  await another();
  await choose("Suggest a city or line");
  await expect(page.locator("input[name=cityId]")).toHaveValue("other");
  await page
    .getByRole("textbox", { name: "City and line name", exact: true })
    .fill("New city, Line 1");
  await page
    .getByRole("textbox", { name: "Description", exact: true })
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
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByText("Your profile is saved.", { exact: true }),
  ).toBeVisible();
  expect(profileWrites[0].profile).toMatchObject({
    age: 29,
    gender: "woman",
    publicProfile: false,
  });
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
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("Credited observation");
  await review();
  const publicCredit = page.getByRole("checkbox", {
    name: /I want public credit/,
  });
  await expect(publicCredit).not.toBeChecked();
  await publicCredit.check();
  const alias = page.getByRole("textbox", {
    name: "Display name",
    exact: true,
  });
  await expect(alias).toHaveValue("");
  await alias.fill("Public rider");
  await send();
  await expect(
    page.getByRole("heading", {
      name: "Thank you! Your report was received for review.",
    }),
  ).toBeVisible();
  expect(sent[5].publicName).toBe("Public rider");
  expect(sent[5].publicCredit).toBe(true);
  for (const lang of ["en", "fa"]) {
    await page.goto(`${origin}/contribute?city=mashhad&lang=${lang}`);
    await page.getByTestId("report-types").getByRole("button").nth(1).click();
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      const audit = await new AxeBuilder({ page }).analyze();
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
    const audit = await new AxeBuilder({ page }).analyze();
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
  await expect(diagram.locator('[data-women-zone="full"]')).toHaveCount(2);
  await expect(
    diagram.locator(
      '[data-women-zone="head-half"], [data-women-zone="rear-half"]',
    ),
  ).toHaveCount(2);
  await page.getByRole("combobox", { name: /^Direction of travel/ }).click();
  await page
    .getByRole("option", { name: "Line 1 · Toward Tajrish", exact: true })
    .click();
  await page.locator('[data-diagram-car="2"]').focus();
  await page.locator('[data-diagram-car="2"]').press("Space");
  await expect(page.getByTestId("train-head-destination")).toHaveText(
    "Toward Tajrish",
  );
  await page.getByRole("button", { name: "Flip train", exact: true }).click();
  await expect(diagram.locator("[data-car-number]").first()).toHaveAttribute(
    "data-car-number",
    "7",
  );
  await expect(
    page.getByRole("button", { name: "Car 2", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("train-head-destination")).toHaveText(
    "Toward Tajrish",
  );
  await page.getByRole("combobox", { name: /^Direction of travel/ }).click();
  await page
    .getByRole("option", { name: "Line 1 · Toward Kahrizak", exact: true })
    .click();
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
  await expect(diagram).toContainText("Women-only boundaries are unconfirmed");
  await expect(diagram.locator("[data-diagram-car]")).toHaveCount(9);
  const overview = await page.getByTestId("train-overview").boundingBox();
  expect(overview.x).toBeGreaterThanOrEqual(0);
  expect(overview.x + overview.width).toBeLessThanOrEqual(360);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const trainAudit = await new AxeBuilder({ page }).analyze();
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
    await page
      .getByRole("combobox", {
        name: lang === "fa" ? /^جهت حرکت قطار/ : /^Direction of travel/,
      })
      .click();
    await page
      .getByRole("option")
      .filter({ hasText: lang === "fa" ? "فرودگاه" : "Airport" })
      .click();
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
      const audit = await new AxeBuilder({ page }).analyze();
      expect(
        audit.violations.filter((v) =>
          ["serious", "critical"].includes(v.impact ?? ""),
        ),
      ).toEqual([]);
    }
  }
  expect(errors).toEqual([]);
  console.log(
    "Passed: three-step confirmation without early writes; draft/photo retention; keyboard/search/Tab; multi-amenity, wagon and city reports; retries; Google/GitHub-only login UI; explicit alias consent; private profiles/social links and connected logins; city train layouts/full-half women sections/flip; FA/EN mobile/desktop accessibility; future map geometry isolated from boarding stations. All auth/report writes mocked.",
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
