import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("lib/farmconnect-v1.tsx", "utf8");
const brain = fs.readFileSync("lib/kafarm-brain.ts", "utf8");

test("admin navigation contains only the six agreed workflows", () => {
  const adminNav = app.slice(app.indexOf("admin: ["), app.indexOf("] as const", app.indexOf("admin: [")));
  for (const label of ["Account Verification", "Rooster & Care Payments", "Care Tasks & Updates", "Withdrawals", "Support", "KaFarm"]) {
    assert.match(adminNav, new RegExp(label.replace(/[&]/g, "&")));
  }
  for (const legacy of ["Farm Operations", "Issue Management", "Evidence Logs", "Caretaker Management"]) {
    assert.doesNotMatch(adminNav, new RegExp(legacy));
  }
});

test("caretaker navigation is narrowed to daily work, history, support, and profile", () => {
  const caretakerNav = app.slice(app.indexOf("caretaker: ["), app.indexOf("admin: ["));
  for (const label of ["Today's Care", "Care History", "Support", "Profile"]) assert.match(caretakerNav, new RegExp(label.replace("'", "\\'")));
  for (const legacy of ["Feeding", "Photos", "Weight", "Notes", "Mortality"]) assert.doesNotMatch(caretakerNav, new RegExp(legacy));
});

test("admin payments and care tasks are consolidated", () => {
  assert.match(app, /Rooster Payments/);
  assert.match(app, /Care Payments/);
  assert.match(app, /Rooster Sales/);
  assert.match(app, /Assign Care/);
  assert.match(app, /Review Updates/);
  assert.match(app, /<AdminLiveTaskProofQueue \/>/);
});

test("scheduled report remains connected to admin review and customer diary", () => {
  assert.match(app, /What time\?/);
  assert.match(app, /careEntries/);
  assert.match(app, /Findings:/);
  assert.match(app, /adminReviewTaskProof/);
  assert.match(app, /Daily Update/);
  assert.match(brain, /customer Rooster Diary update/);
});

const redirects = new Map([
  ["app/customer-v2/care/page.tsx", "/customer-v2/roosters"],
  ["app/caretaker/page.tsx", "/caretaker/tasks"],
  ["app/caretaker/dashboard/page.tsx", "/caretaker/tasks"],
  ["app/admin/page.tsx", "/admin/account-verification"],
  ["app/admin/customer-requests/page.tsx", "/admin/customer-requests/payment"],
]);

for (const [file, target] of redirects) {
  test(`${file} redirects to canonical workflow`, () => {
    const source = fs.readFileSync(file, "utf8");
    assert.match(source, new RegExp(target.replaceAll("/", "\\/")));
  });
}
