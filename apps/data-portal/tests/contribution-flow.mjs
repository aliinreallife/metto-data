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
      GITHUB_TOKEN: "",
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
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage(),
    errors = [],
    sent = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/reports", async (route) => {
    const body = route.request().postDataJSON();
    sent.push(body);
    await route.fulfill({
      status: sent.length === 1 ? 503 : 202,
      json: sent.length === 1 ? { error: "busy" } : { id: body.id },
    });
  });
  await page.goto(
    `${origin}/contribute?city=mashhad&station=mashhad:station:basij&kind=timetable&lang=en`,
  );
  await expect(page.getByTestId("report-types")).toBeVisible();
  await page
    .getByTestId("report-types")
    .getByRole("button")
    .filter({ hasText: "Train times" })
    .click();
  await expect(page.locator("input[name=stationId]")).toHaveValue(
    "mashhad:station:basij",
  );
  await page
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("Weekday times on the board, observed today");
  await page
    .getByText("Add a photo or source link (optional)", { exact: true })
    .click();
  await page
    .locator("input[name=photo]")
    .setInputFiles({
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
  await expect(page.getByTestId("report-form")).toBeHidden();
  await page
    .getByTestId("report-types")
    .getByRole("button")
    .filter({ hasText: "Train times" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Description", exact: true }),
  ).toHaveValue("Weekday times on the board, observed today");
  expect(
    await page
      .locator("input[name=photo]")
      .evaluate((input) => input.files.length),
  ).toBe(1);
  await page.getByRole("button", { name: /Station \(optional\)/ }).click();
  const search = page.getByRole("combobox", {
    name: "Search stations",
    exact: true,
  });
  await search.fill("بسيج");
  await expect(
    page.getByRole("option", { name: "Basij", exact: true }),
  ).toBeVisible();
  await search.press("ArrowDown");
  await search.press("Home");
  await search.press("Enter");
  await expect(page.locator("input[name=stationId]")).toHaveValue(
    "mashhad:station:basij",
  );
  await expect(
    page.getByRole("button", { name: /Station \(optional\)/ }),
  ).toBeFocused();
  await page.getByRole("button", { name: /Station \(optional\)/ }).click();
  await search.fill("zzzzz");
  await expect(
    page.getByText("No stations found.", { exact: true }),
  ).toBeVisible();
  await search.press("Escape");
  await page.getByRole("button", { name: /Station \(optional\)/ }).click();
  await search.press("Tab");
  await expect(
    page.getByRole("textbox", {
      name: "Line and direction (optional)",
      exact: true,
    }),
  ).toBeFocused();
  await page.getByRole("combobox", { name: /^City / }).press("ArrowDown");
  await page.keyboard.press("Home");
  await page.keyboard.press("Enter");
  await expect(page.locator("input[name=cityId]")).toHaveValue("tehran");
  await expect(page.locator("input[name=stationId]")).toHaveValue("");
  await page.getByRole("button", { name: "Send report", exact: true }).click();
  await expect(
    page.getByTestId("report-form").getByRole("alert"),
  ).toContainText("cannot receive");
  await expect(
    page.getByRole("textbox", { name: "Description", exact: true }),
  ).toHaveValue("Weekday times on the board, observed today");
  await page.getByRole("button", { name: "Send report", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Thank you! Your report was received for review.",
    }),
  ).toBeVisible();
  expect(sent[0].id).toBe(sent[1].id);
  expect(sent[1].photo).toBeTruthy();
  await page
    .getByRole("button", { name: "Send another report", exact: true })
    .click();
  await expect(page.getByTestId("report-types")).toBeVisible();
  await page
    .getByTestId("report-types")
    .getByRole("button")
    .filter({ hasText: "Car near an escalator" })
    .click();
  await page.getByRole("spinbutton").fill("6");
  await page.getByRole("button", { name: "Car 4", exact: true }).click();
  await page.getByRole("button", { name: "Send report", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Thank you! Your report was received for review.",
    }),
  ).toBeVisible();
  expect(sent[2].kind).toBe("wagon");
  expect(sent[2].details).toContain("Observed car 4 of 6");
  await page
    .getByRole("button", { name: "Send another report", exact: true })
    .click();
  await page
    .getByTestId("report-types")
    .getByRole("button")
    .filter({ hasText: "Station amenities" })
    .click();
  await expect(page.getByRole("spinbutton")).toHaveCount(0);
  await page.getByRole("button", { name: "Send report", exact: true }).click();
  await expect(
    page.getByTestId("report-form").getByRole("alert"),
  ).toContainText("Write some information");
  await page.getByRole("combobox", { name: /^Amenity / }).click();
  await page.getByRole("option", { name: "Elevator", exact: true }).click();
  await page.getByRole("combobox", { name: /^What you observed / }).click();
  await page
    .getByRole("option", { name: "Not available", exact: true })
    .click();
  await page.getByRole("button", { name: "Send report", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Thank you! Your report was received for review.",
    }),
  ).toBeVisible();
  expect(sent[3].details).toContain("Amenity: elevator; observed value: false");
  for (const lang of ["en", "fa"]) {
    await page.goto(`${origin}/contribute?city=mashhad&lang=${lang}`);
    await page.getByTestId("report-types").getByRole("button").nth(1).click();
    await expect(page.locator("select[name=kind]")).toHaveCount(0);
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
    await page.setViewportSize({ width: 1280, height: 900 });
    const auditDesktop = await new AxeBuilder({ page }).analyze();
    expect(
      auditDesktop.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      ),
    ).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
  }
  await page.goto(`${origin}/map?city=mashhad&lang=en`);
  await expect(page.getByTestId("construction-section")).toHaveCount(5);
  await expect(page.locator("svg[role=group] a")).toHaveCount(36);
  await expect(page.getByTestId("construction-legend")).toContainText("Line 4");
  await page.goto(`${origin}/map?city=tehran&lang=en`);
  await expect(page.getByTestId("construction-section")).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log(
    "Passed: 2-step flow, linked station, preserved text/photo, searchable keyboard selects, Persian spelling normalization, city reset, retry idempotency, wagon-only report, FA/EN mobile/desktop accessibility.",
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
