import fs from "node:fs";
import path from "node:path";

const sourcePath = process.argv[2];
const outputPath = process.argv[3];
if (!sourcePath || !outputPath) throw new Error("Usage: node scripts/care-plan/build-mission-seed.mjs <source.txt> <output.sql>");

const source = fs.readFileSync(sourcePath, "utf8").replace(/\r\n/g, "\n");
const matches = [...source.matchAll(/^DAY (\d{3}) OF 180$/gm)];
if (matches.length !== 180) throw new Error(`Expected 180 exact day headers; found ${matches.length}.`);

function section(block, heading, nextHeadings) {
  const start = block.indexOf(`${heading}\n`);
  if (start < 0) return "";
  const contentStart = start + heading.length + 1;
  const ends = nextHeadings.map((next) => block.indexOf(`\n${next}\n`, contentStart)).filter((index) => index >= 0);
  return block.slice(contentStart, ends.length ? Math.min(...ends) : block.length).trim();
}
const list = (value) => value.split("\n").map((line) => line.replace(/^[-*]\s*/, "").trim()).filter(Boolean);
const checklist = (value) => value.split("\n").map((line) => line.replace(/^\[\s?\]\s*/, "").trim()).filter(Boolean);
const jsonSql = (value) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const textSql = (value) => `'${String(value).replaceAll("'", "''")}'`;

const rows = matches.map((match, index) => {
  const dayNumber = Number(match[1]);
  const block = source.slice(match.index, matches[index + 1]?.index ?? source.length).trim();
  const lifeStage = block.match(/^LIFE STAGE:\s*(.+)$/m)?.[1]?.trim() || "";
  const primaryMission = block.match(/^PRIMARY MISSION:\s*(.+)$/m)?.[1]?.trim() || "";
  const supplementHeading = block.match(/^(SUPPLEMENT \/ ELECTROLYTE CHECKLIST[^\n]*)$/m)?.[1] || "SUPPLEMENT / ELECTROLYTE CHECKLIST";
  const vaccineHeading = block.match(/^(VACCINE CHECKLIST[^\n]*)$/m)?.[1] || "VACCINE CHECKLIST";
  const schedule = section(block, "TIME SCHEDULE", ["NEEDED TODAY"]).split("\n").map((line) => {
    const parts = line.trim().match(/^(\S+)\s{2,}(.+)$/);
    return parts ? { time: parts[1], action: parts[2] } : { time: "", action: line.trim() };
  }).filter((item) => item.action);
  const needed = list(section(block, "NEEDED TODAY", ["FEEDING STANDARD"]));
  const feeding = list(section(block, "FEEDING STANDARD", [supplementHeading]));
  const feedRange = feeding.join(" ").match(/(?:Approximate(?: developing intake)?\s+)?(\d+)\D{1,8}(\d+)\s*g\/day/i);
  const feedGramsMin = feedRange ? Number(feedRange[1]) : null;
  const feedGramsMax = feedRange ? Number(feedRange[2]) : null;
  const supplement = checklist(section(block, supplementHeading, [vaccineHeading]));
  const vaccine = checklist(section(block, vaccineHeading, ["DAILY OPERATIONS CHECKLIST"]));
  const operations = checklist(section(block, "DAILY OPERATIONS CHECKLIST", ["HOUSING CHECK"]));
  const housing = list(section(block, "HOUSING CHECK", ["HEALTH PASS CHECK"]));
  const health = checklist(section(block, "HEALTH PASS CHECK", ["FARMCONNECT EVIDENCE REQUIRED"]));
  const evidence = list(section(block, "FARMCONNECT EVIDENCE REQUIRED", ["EMERGENCY STOP RULE"]));
  const emergency = section(block, "EMERGENCY STOP RULE", ["COMPLETION GATE"]).replace(/\n=+\s*$/, "").trim();
  const completion = section(block, "COMPLETION GATE", []).replace(/\n=+\s*$/, "").trim();
  if (!lifeStage || !primaryMission || !schedule.length || !operations.length || !health.length || !evidence.length || !completion) {
    throw new Error(`Day ${dayNumber} is missing a required mission section.`);
  }
  return `(${dayNumber}, ${textSql(lifeStage)}, ${textSql(primaryMission)}, ${feedGramsMin ?? "null"}, ${feedGramsMax ?? "null"}, ${jsonSql(schedule)}, ${jsonSql(needed)}, ${jsonSql(feeding)}, ${jsonSql(supplement)}, ${jsonSql(vaccine)}, ${jsonSql(operations)}, ${jsonSql(housing)}, ${jsonSql(health)}, ${jsonSql(evidence)}, ${textSql(emergency)}, ${textSql(completion)}, 'farmconnect-premium-rooster-180-v1')`;
});

const uniqueDays = new Set(matches.map((match) => Number(match[1])));
if (uniqueDays.size !== 180 || [...Array(180)].some((_, index) => !uniqueDays.has(index + 1))) throw new Error("Mission days must uniquely cover Day 1 through Day 180.");

const sql = `-- Generated from the authoritative FarmConnect Premium Rooster 180-day operations file.
-- Do not hand-edit mission rows; regenerate with scripts/care-plan/build-mission-seed.mjs.

begin;

insert into public.care_mission_templates (
  day_number, life_stage, primary_mission, feed_grams_min, feed_grams_max, time_schedule, needed_today, feeding_standard,
  supplement_checklist, vaccine_checklist, operations_checklist, housing_checklist,
  health_checklist, evidence_requirements, emergency_stop_rule, completion_gate, catalog_version
) values
${rows.join(",\n")}
on conflict (catalog_version, day_number) do update set
  life_stage=excluded.life_stage, primary_mission=excluded.primary_mission,
  feed_grams_min=excluded.feed_grams_min, feed_grams_max=excluded.feed_grams_max,
  time_schedule=excluded.time_schedule, needed_today=excluded.needed_today, feeding_standard=excluded.feeding_standard,
  supplement_checklist=excluded.supplement_checklist, vaccine_checklist=excluded.vaccine_checklist,
  operations_checklist=excluded.operations_checklist, housing_checklist=excluded.housing_checklist,
  health_checklist=excluded.health_checklist, evidence_requirements=excluded.evidence_requirements,
  emergency_stop_rule=excluded.emergency_stop_rule, completion_gate=excluded.completion_gate, updated_at=now();

do $$ begin
  if (select count(*) from public.care_mission_templates where catalog_version='farmconnect-premium-rooster-180-v1') <> 180 then
    raise exception 'MISSION_CATALOG_INCOMPLETE';
  end if;
end $$;

commit;

select jsonb_build_object('catalog_version','farmconnect-premium-rooster-180-v1','mission_count',count(*),'first_day',min(day_number),'last_day',max(day_number)) verification
from public.care_mission_templates where catalog_version='farmconnect-premium-rooster-180-v1';
`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, sql, "utf8");
console.log(JSON.stringify({ outputPath, missionCount: rows.length, firstDay: 1, lastDay: 180 }, null, 2));
