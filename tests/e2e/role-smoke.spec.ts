import { expect, test } from "@playwright/test";
import { monitorPage, requireCredential, signIn } from "./helpers";

const roles = [
  {
    name: "customer",
    email: "E2E_CUSTOMER_EMAIL",
    password: "E2E_CUSTOMER_PASSWORD",
    destination: /\/customer\/dashboard/,
    routes: [
      "/customer/dashboard",
      "/customer/farm-buy",
      "/customer/farm-requests",
      "/customer/roosters",
      "/customer/inbox",
      "/customer/wallet",
      "/customer/inventory",
      "/customer/care-logs",
      "/customer/care-plans",
    ],
  },
  {
    name: "caretaker",
    email: "E2E_CARETAKER_EMAIL",
    password: "E2E_CARETAKER_PASSWORD",
    destination: /\/caretaker\/dashboard/,
    routes: [
      "/caretaker/dashboard",
      "/caretaker/tasks",
      "/caretaker/completed",
      "/caretaker/chat",
      "/caretaker/profile",
    ],
  },
] as const;

for (const role of roles) {
  test(`${role.name} can sign in and open frozen workspace routes`, async ({ page }, testInfo) => {
    const monitor = monitorPage(page);
    await signIn(page, requireCredential(role.email), requireCredential(role.password));
    await expect(page).toHaveURL(role.destination);

    for (const route of role.routes) {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status(), route).toBeLessThan(400);
    }

    await monitor.assertClean(testInfo);
  });
}
