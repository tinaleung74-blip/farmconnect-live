import { expect, type Page, type TestInfo } from "@playwright/test";

type BrowserProblem = {
  kind: "console" | "pageerror" | "http" | "requestfailed";
  message: string;
  url?: string;
};

const ignoredConsolePatterns = [
  /Download the React DevTools/i,
  /favicon\.ico/i,
];

export function monitorPage(page: Page) {
  const problems: BrowserProblem[] = [];

  page.on("console", message => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (ignoredConsolePatterns.some(pattern => pattern.test(text))) return;
    problems.push({ kind: "console", message: text, url: page.url() });
  });

  page.on("pageerror", error => {
    problems.push({ kind: "pageerror", message: error.message, url: page.url() });
  });

  page.on("response", response => {
    if (response.status() < 500) return;
    problems.push({
      kind: "http",
      message: `${response.status()} ${response.statusText()}`,
      url: response.url(),
    });
  });

  page.on("requestfailed", request => {
    const failure = request.failure()?.errorText || "request failed";
    if (/ERR_ABORTED/i.test(failure)) return;
    problems.push({ kind: "requestfailed", message: failure, url: request.url() });
  });

  return {
    problems,
    async assertClean(testInfo: TestInfo) {
      if (problems.length) {
        await testInfo.attach("browser-problems", {
          body: Buffer.from(JSON.stringify(problems, null, 2)),
          contentType: "application/json",
        });
      }
      expect(problems, JSON.stringify(problems, null, 2)).toEqual([]);
    },
  };
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/");
  await page.getByPlaceholder("name@example.com").first().fill(email);
  await page.getByPlaceholder("Enter your password").first().fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).first().click();
}

export function requireCredential(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the production-readiness test.`);
  return value;
}
