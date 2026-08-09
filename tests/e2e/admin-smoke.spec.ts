import { expect, test } from "@playwright/test";
import { monitorPage, requireCredential, signIn } from "./helpers";

const adminRoutes = [
  "/admin",
  "/admin/customer-requests",
  "/admin/customer-requests/payment",
  "/admin/customer-requests/care",
  "/admin/customer-requests/task",
  "/admin/customer-requests/withdraw",
  "/admin/caretaker-management",
  "/admin/account-verification",
  "/admin/kafarm/whole-app-reader",
];

test("admin can sign in and open frozen operational routes", async ({ page }, testInfo) => {
  const email = requireCredential("E2E_ADMIN_EMAIL");
  const password = requireCredential("E2E_ADMIN_PASSWORD");
  const monitor = monitorPage(page);

  await signIn(page, email, password);
  await expect(page).toHaveURL(/\/admin(?:\/|$)/);

  for (const route of adminRoutes) {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.status(), route).toBeLessThan(400);
    await expect(page.locator("body")).toContainText(/FarmConnect|KaFarm|Customer|Caretaker|Account/i);
  }

  await monitor.assertClean(testInfo);
});
