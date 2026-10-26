import { expect } from "@playwright/test";

/** Block hydration to check the actual first painted theme, then mount/navigate. */
export async function checkThemePaint(browser, origin) {
  for (const scenario of [
    { preference: "dark", system: "light", dark: true },
    { preference: "light", system: "dark", dark: false },
    { preference: null, system: "dark", dark: true },
  ]) {
    const context = await browser.newContext({ colorScheme: scenario.system });
    const errors = [];
    context.on("page", (page) =>
      page.on("pageerror", (error) => errors.push(error.message)),
    );
    try {
      await context.route("**/api/auth/**", (route) =>
        route.fulfill({ json: null }),
      );
      await context.addInitScript(({ preference }) => {
        if (preference) localStorage.setItem("metto:theme", preference);
        window.__themeFrames = [];
        const observe = () => {
          if (
            document.body &&
            document.querySelector("#main") &&
            window.__themeFrames.length < 360
          )
            window.__themeFrames.push({
              dark: document.documentElement.classList.contains("dark"),
              scheme: getComputedStyle(document.documentElement).colorScheme,
            });
          requestAnimationFrame(observe);
        };
        requestAnimationFrame(observe);
      }, scenario);
      let release;
      const held = new Promise((resolve) => {
        release = resolve;
      });
      await context.route("**/_next/static/**/*.js", async (route) => {
        await held;
        await route.continue();
      });
      const page = await context.newPage();
      await page.goto(origin + "/stations?lang=en", { waitUntil: "commit" });
      await expect(
        page.getByRole("heading", { name: "Stations and status", exact: true }),
      ).toBeVisible();
      // Client bundles are still blocked: this must already be the final theme.
      expect(
        await page
          .locator("html")
          .evaluate((el) => el.classList.contains("dark")),
      ).toBe(scenario.dark);
      expect(
        await page
          .locator("html")
          .evaluate((el) => getComputedStyle(el).colorScheme),
      ).toBe(scenario.dark ? "dark" : "light");
      await page.screenshot(); // Force a pre-hydration paint while bundles remain held.
      let accountPage;
      if (scenario.preference === "dark") {
        accountPage = await context.newPage();
        await accountPage.goto(origin + "/account?lang=en", {
          waitUntil: "commit",
        });
        await expect(
          accountPage.getByRole("button", {
            name: "Continue with Google",
            exact: true,
          }),
        ).toBeDisabled();
      }
      release();
      await page.waitForLoadState("load");
      if (accountPage) {
        await accountPage.waitForLoadState("load");
        await expect(
          accountPage.getByRole("button", {
            name: "Continue with Google",
            exact: true,
          }),
        ).toBeEnabled();
        await accountPage.close();
      }
      await expect(
        page.getByRole("button", { name: "Change theme", exact: true }),
      ).toHaveAttribute("aria-pressed", String(scenario.dark));
      if (scenario.preference === "dark") {
        await page
          .getByTestId("station-card")
          .first()
          .getByRole("link")
          .click();
        await expect(page.getByTestId("report-types")).toBeVisible();
        await expect(page.locator("html")).toHaveClass(/dark/);
        const navigationFrames = await page.evaluate(
          () => window.__themeFrames,
        );
        expect(
          navigationFrames.filter(
            (frame) => !frame.dark || frame.scheme !== "dark",
          ),
        ).toEqual([]);
        await page.reload();
        await expect(page.getByTestId("report-types")).toBeVisible();
        await expect(page.locator("html")).toHaveClass(/dark/);
      }
      const frames = await page.evaluate(() => window.__themeFrames);
      expect(frames.length).toBeGreaterThan(0);
      expect(
        frames.filter(
          (frame) =>
            frame.dark !== scenario.dark ||
            frame.scheme !== (scenario.dark ? "dark" : "light"),
        ),
      ).toEqual([]);
    } catch (error) {
      throw new Error(
        `Theme paint ${JSON.stringify(scenario)}: ${error.message}; page errors: ${JSON.stringify(errors)}`,
      );
    } finally {
      await context.close();
    }
  }
}
