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
  for (const path of ["email-otp/send-verification-otp", "sign-in/email-otp", "sign-in/email", "sign-up/email", "sign-in/magic-link"]) {
    const response = await fetch(origin + "/api/auth/" + path, { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: "{}" });
    expect(response.status).toBe(404);
  }
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });

  const page = await context.newPage(),
    errors = [],
    sent = [],
    providers = [];
  let signedIn = false, socialSucceeds = false;
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
        await route.fulfill({ json: { url: origin + "/account?lang=en", redirect: true } });
        return;
      }
      await route.fulfill({
        status: 400,
        json: { code: "PROVIDER_NOT_ENABLED" },
      });
      return;
    }
    if (path.endsWith("/sign-out")) {
      signedIn = false;
      await route.fulfill({ json: { success: true } });
      return;
    }
    throw Error("Unexpected auth request in mock: " + path);
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
  await page.getByRole("button", { name: "Remove photo and edit report", exact: true }).click();
  expect(await page.locator("input[name=photo]").evaluate(input => input.files.length)).toBe(0);
  await expect(page.getByRole("textbox", { name: "Description", exact: true })).toHaveValue("Weekday times observed today");
  await review();
  await expect(page.getByRole("img", { name: "Photo to be sent with your report" })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Edit information", exact: true })
    .click();
  await page.locator("input[name=photo]").setInputFiles({
    name: "board.png", mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64"),
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
  await page.getByRole("spinbutton").fill("12");
  await page.getByRole("button", { name: "Car 4", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Selected car" }),
  ).toContainText("4");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await review();
  await expect(page.getByTestId("report-review")).toContainText("Car 4 of 12");
  await send();
  await expect(
    page.getByRole("heading", {
      name: "Thank you! Your report was received for review.",
    }),
  ).toBeVisible();
  expect(sent[2].details).toContain("Observed car 4 of 12");
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
  expect(await page.locator('input[type="email"], input[name="otp"]').count()).toBe(0);
  socialSucceeds = true;
  await page.getByRole("button", { name: "Continue with Google", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Log out", exact: true }),
  ).toBeVisible();
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
  expect(errors).toEqual([]);
  console.log(
    "Passed: three-step confirmation without early writes; draft/photo retention; keyboard/search/Tab; multi-amenity, wagon and city reports; retries; Google/GitHub-only login UI; explicit alias consent; FA/EN mobile/desktop accessibility; future map geometry isolated from boarding stations. All auth/report writes mocked.",
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
