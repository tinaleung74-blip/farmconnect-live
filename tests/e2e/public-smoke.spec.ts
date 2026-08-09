import { expect, test } from "@playwright/test";
import { monitorPage } from "./helpers";

const publicRoutes = [
  { route: "/", heading: "Sign in to your account" },
  { route: "/forgot-password", heading: /forgot|reset/i },
  { route: "/view-farm", heading: /farm/i },
  { route: "/caretaker/signup", heading: /caretaker/i },
];

for (const item of publicRoutes) {
  test(`${item.route} renders without runtime or server errors`, async ({ page }, testInfo) => {
    const monitor = monitorPage(page);
    const response = await page.goto(item.route, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByRole("heading", { name: item.heading }).first()).toBeVisible();
    await monitor.assertClean(testInfo);
  });
}
