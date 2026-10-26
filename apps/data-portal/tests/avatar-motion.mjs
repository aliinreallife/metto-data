import { expect } from "@playwright/test";
export async function checkAvatarMotion(browser, origin) {
  for (const lang of ["en", "fa"]) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: "no-preference",
    });
    try {
      const page = await context.newPage();
      await page.goto(`${origin}/contributors/github-91134550?lang=${lang}`);
      const avatar = page.getByTestId("profile-avatar"),
        eyes = avatar.locator(".mo-eyes"),
        body = avatar.locator(".mo-root");
      await expect(avatar).toHaveAttribute("data-avatar-kind", "blobatar");
      expect(await avatar.evaluate((node) => node.tagName.toLowerCase())).toBe(
        "svg",
      );
      await expect(avatar).toHaveAttribute("data-avatar-paused", "false");
      const rect = await avatar.boundingBox(),
        cy = rect.y + rect.height / 2;
      const x = () =>
        eyes.evaluate(
          (node) =>
            parseFloat(node.style.getPropertyValue("--mo-track-x")) || 0,
        );
      await page.mouse.move(0, cy);
      await expect.poll(x).toBeLessThan(-0.3);
      await page.mouse.move(1275, cy);
      await expect.poll(x).toBeGreaterThan(0.3);
      await avatar.hover();
      await expect
        .poll(() => body.evaluate((node) => getComputedStyle(node).transform))
        .not.toBe("none");
      // Turning reduced motion on must stop both tracking and hover movement live.
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect
        .poll(() => body.evaluate((node) => getComputedStyle(node).transform))
        .toBe("none");
      await expect
        .poll(() =>
          eyes.evaluate((node) => node.style.getPropertyValue("--mo-track-x")),
        )
        .toBe("");
      expect(
        await eyes.evaluate((node) => getComputedStyle(node).animationName),
      ).toBe("none");
      await page.mouse.move(0, cy);
      expect(await x()).toBe(0);
      // The preference can be reversed without a reload.
      await page.emulateMedia({ reducedMotion: "no-preference" });
      let step = 0;
      await expect
        .poll(async () => {
          await page.mouse.move(1200 + (step++ % 2) * 70, cy);
          return x();
        })
        .toBeGreaterThan(0.3);
      // Off-screen decorative animation pauses, then resumes when visible.
      await page.evaluate(() => {
        document.body.style.minHeight = "2600px";
        window.scrollTo(0, 1800);
      });
      await expect(avatar).toHaveAttribute("data-avatar-paused", "true");
      expect(
        await eyes.evaluate(
          (node) => getComputedStyle(node).animationPlayState,
        ),
      ).toBe("paused");
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(avatar).toHaveAttribute("data-avatar-paused", "false");
    } finally {
      await context.close();
    }
  }
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "no-preference",
  });
  try {
    const page = await context.newPage();
    await page.goto(`${origin}/contributors/github-91134550?lang=fa`);
    const avatar = page.getByTestId("profile-avatar"),
      eyes = avatar.locator(".mo-eyes");
    await expect(avatar).toHaveAttribute("data-avatar-paused", "false");
    expect(
      await page.evaluate(() => matchMedia("(pointer:coarse)").matches),
    ).toBe(true);
    const initial = await eyes.evaluate(
      (node) => getComputedStyle(node).translate,
    );
    // No touch or pointer event: the face looks around on its own.
    await expect
      .poll(() => eyes.evaluate((node) => getComputedStyle(node).translate), {
        timeout: 8500,
      })
      .not.toBe(initial);
    expect(
      await eyes.evaluate((node) => getComputedStyle(node).animationPlayState),
    ).toBe("running");
    expect(
      await eyes.evaluate((node) =>
        node.style.getPropertyValue("--mo-track-x"),
      ),
    ).toBe("");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(eyes).toHaveCSS("animation-name", "none");
    expect(
      await avatar
        .locator(".mo-eye path")
        .first()
        .evaluate((node) => getComputedStyle(node).animationName),
    ).toBe("none");
  } finally {
    await context.close();
  }
}
