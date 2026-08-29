import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.join(process.cwd(), "app");
const baseUrl = process.env.LOCAL_APP_URL || "http://localhost:3000";

function collect(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    return entry.isDirectory() ? collect(absolute) : [absolute];
  });
}

const routes = collect(root)
  .filter((file) => file.endsWith(`${path.sep}page.tsx`))
  .map((file) => path.relative(root, path.dirname(file)).split(path.sep).filter((part) => !part.startsWith("(")).join("/"))
  .map((route) => `/${route}`.replace(/\/$/, "") || "/")
  .map((route) => route.replace(/\[[^/]+\]/g, "00000000-0000-4000-8000-000000000000"))
  .sort();

const apiRoutes = collect(root)
  .filter((file) => file.endsWith(`${path.sep}route.ts`) && file.includes(`${path.sep}api${path.sep}`))
  .map((file) => `/${path.relative(root, path.dirname(file)).split(path.sep).filter((part) => !part.startsWith("(")).join("/")}`)
  .map((route) => route.replace(/\[[^/]+\]/g, "00000000-0000-4000-8000-000000000000"))
  .sort();

async function inspect(route) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${baseUrl}${route}`, { redirect: "manual", signal: controller.signal });
    const body = await response.text();
    const frameworkError = /<html[^>]+id=["']__next_error__["']/i.test(body)
      || /Internal Server Error|Application error: a client-side exception/i.test(body);
    const redirect = response.status >= 300 && response.status < 400 && Boolean(response.headers.get("location"));
    const expectedFailClosed = response.status === 503 && /CRON_SECRET_NOT_CONFIGURED/.test(body);
    return { route, status: response.status, location: response.headers.get("location"), expectedFailClosed, passed: expectedFailClosed || (response.status < 500 && (redirect || !frameworkError)) };
  } catch (error) {
    return { route, status: 0, passed: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

const results = [];
for (let index = 0; index < routes.length; index += 8) {
  results.push(...await Promise.all(routes.slice(index, index + 8).map(inspect)));
}

const apiResults = [];
for (let index = 0; index < apiRoutes.length; index += 8) {
  apiResults.push(...await Promise.all(apiRoutes.slice(index, index + 8).map(inspect)));
}

const failures = [...results, ...apiResults].filter((result) => !result.passed);
const guarded = apiResults.filter((result) => result.expectedFailClosed).length;
const report = { generatedAt: new Date().toISOString(), baseUrl, pagesChecked: results.length, apiRoutesChecked: apiResults.length, guarded, checked: results.length + apiResults.length, passed: results.length + apiResults.length - failures.length, failed: failures.length, failures, results, apiResults };
const output = path.join(process.cwd(), "test-results", "kafarm", "local-page-smoke.json");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ pagesChecked: report.pagesChecked, apiRoutesChecked: report.apiRoutesChecked, guarded: report.guarded, checked: report.checked, passed: report.passed, failed: report.failed, failures }, null, 2));
if (failures.length) process.exitCode = 1;
