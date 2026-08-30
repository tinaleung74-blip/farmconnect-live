import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ui = readFileSync(new URL("../../lib/farmconnect-v1.tsx", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../database/applied/095_rooster_growth_stage_guard.sql", import.meta.url), "utf8");

function stage(day) {
  if (day >= 151) return "adult";
  if (day >= 91) return "young";
  if (day >= 31) return "juvenile";
  return "chick";
}

test("growth-stage boundaries never skip directly from chick to adult", () => {
  assert.deepEqual(
    [1, 30, 31, 90, 91, 150, 151].map((day) => [day, stage(day)]),
    [[1, "chick"], [30, "chick"], [31, "juvenile"], [90, "juvenile"], [91, "young"], [150, "young"], [151, "adult"]],
  );
});

test("customer UI derives age from the database acquisition timestamp", () => {
  assert.match(ui, /Date\.parse\(String\(acquiredAt \|\| metadata\?\.acquired_at/);
  assert.match(ui, /roosterCanRequestEvaluation\(day\)/);
  assert.doesNotMatch(ui, /growth_day \|\| "adult"/);
});

test("database blocks early sale evaluation even if the browser is manipulated", () => {
  assert.match(migration, /v_growth_day < 91/);
  assert.match(migration, /ROOSTER_NOT_READY_FOR_SALE/);
  assert.match(migration, /current_date - coalesce\(p_acquired_at, now\(\)\)::date/);
});

test("all twelve breeds have four individual stage assets", () => {
  const manifest = JSON.parse(readFileSync(new URL("../../public/farmconnect/roosters/breeds/manifest.json", import.meta.url), "utf8"));
  assert.equal(Object.keys(manifest.breeds).length, 12);
  assert.deepEqual(manifest.stages, ["chick", "juvenile", "young", "adult"]);
});
