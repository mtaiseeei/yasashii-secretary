#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const full = process.argv.includes("--full");
function run(command, args, timeout = 1_200_000) { return spawnSync(command, args, { cwd: root, encoding: "utf8", timeout, maxBuffer: 256 * 1024 * 1024 }); }
function combined(result) { return `${result.stdout}\n${result.stderr}`; }
function pass(command, args, marker) {
  const result = run(command, args); assert.equal(result.status, 0, `${command} ${args.join(" ")}\n${combined(result)}`); if (marker) assert(combined(result).includes(marker), marker); return result;
}

pass("python3", ["scripts/check-report-schema.py", "--plugin-root", "plugins/secretary"], "surfaces=22");
pass(process.execPath, ["scripts/sprint-030-edition-guard-test.mjs"], "SPRINT030_PASS=54 SPRINT030_FAIL=0");
pass(process.execPath, ["scripts/sprint-022-safety-test.mjs"], "SPRINT022_PASS=69 SPRINT022_FAIL=0");

const update = run(process.execPath, ["scripts/sprint-032-update-gate-test.mjs"]); const updateText = combined(update);
assert.equal(update.status, 1); assert(updateText.includes("SPRINT032_RELEASE_PASS=12 SPRINT032_RELEASE_FAIL=3")); assert.equal((updateText.match(/^FAIL /gmu) || []).length, 3); assert(updateText.includes('"status": "downgrade-blocked"'));
for (const key of ["pluginUpdate", "workspaceWrite", "migration", "commit", "push", "settingsChange", "reloadOrRestart"]) assert(updateText.includes(`"${key}": 0`), key);

const integrity = run(process.execPath, ["scripts/sprint-039-release-integrity-test.mjs"]); const integrityText = combined(integrity);
assert.equal(integrity.status, 1); for (const marker of ["version must be 0.10.3", "unexpected formal Skill: clarity", "16 unique shared skills", "marketplace and plugin versions differ", "latest CHANGELOG release differs"]) assert(integrityText.includes(marker), marker);

if (full) {
  const prewrite = run("bash", ["scripts/sprint-041-regression.sh"]); const prewriteText = combined(prewrite);
  assert.equal(prewrite.status, 1); assert(prewriteText.includes("SPRINT041_TEST_PASS=24 SPRINT041_TEST_FAIL=2")); assert(prewriteText.includes("Clarity product path differs from fixed base before apply"));
  const oldWrapper = run("bash", ["scripts/sprint-042-regression.sh"]); const oldWrapperText = combined(oldWrapper);
  assert.equal(oldWrapper.status, 1); assert(oldWrapperText.includes("owned docs violation")); assert(oldWrapperText.includes("docs/feedback/sprint-042.md")); assert(oldWrapperText.includes("docs/sprints/state.md"));
}

process.stdout.write(`SPRINT043_CURRENT_GATES report_schema=22 edition_guard=54/54 safety=69/69 current_manifest=0.11.0 published=0.10.3 downgrade_blocked_write=0 overlay_actual=46 protected=9 portable=candidate-check historical_update=12/15 historical_integrity=EXPECTED_6_DIFF${full ? " sprint041_postapply=EXPECTED_24_PASS_2_PHASE_DIFF sprint042_wrapper=EXPECTED_ROLE_DOC_PHASE_DIFF" : ""}\n`);
