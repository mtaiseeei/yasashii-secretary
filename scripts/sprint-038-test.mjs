#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareMeaning, meaningTuple } from "../plugins/secretary/scripts/lib/conversation-contract.mjs";
import { runConversationScenario } from "./lib/sprint-038-conversation-runner.mjs";
import { applyConversationMigration, planConversationMigration, rollbackConversationMigration, sha256 as migrationSha } from "../plugins/secretary/scripts/lib/conversation-migration.mjs";
import { mkdtempSync, readFileSync as read, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixture = JSON.parse(readFileSync(join(root, "scripts/fixtures/sprint-038/conversation-golden.json"), "utf8"));
const negatives = JSON.parse(readFileSync(join(root, "scripts/fixtures/sprint-038/meaning-negative.json"), "utf8"));
let pass = 0;
function check(label, fn) { try { fn(); pass += 1; console.log(`PASS ${label}`); } catch (error) { console.error(`FAIL ${label}: ${error.message}`); process.exitCode = 1; } }
function sha(path) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }
function sameMeaning(left, right) { return JSON.stringify(meaningTuple(left)) === JSON.stringify(meaningTuple(right)); }

check("golden schema and required evidence fields", () => {
  assert.equal(fixture.schemaVersion, 1);
  for (const item of fixture.cases) for (const key of ["caseId", "edition", "input", "precondition", "expected", "requiredResponseElements", "forbiddenPhrases", "meaning", "beforeSnapshot", "afterSnapshot"]) assert.ok(Object.hasOwn(item, key), `${item.caseId}:${key}`);
});

for (const item of fixture.cases) {
  check(`${item.caseId}: natural-language runner intent, response, side effect, snapshots and meaning`, () => {
    // The runner receives only the natural-language request and its natural-language
    // precondition. Expected values, labels, response fragments and snapshots stay
    // exclusively on this oracle side of the comparison.
    const observed = runConversationScenario({ input: item.input, precondition: item.precondition });
    try {
      assert.equal(observed.intent, item.expected.intent);
      assert.equal(observed.response, item.expected.response);
      assert.equal(observed.sideEffectCount, item.expected.sideEffectCount);
      assert.deepEqual(observed.beforeSnapshot, item.beforeSnapshot);
      assert.deepEqual(observed.afterSnapshot, item.afterSnapshot);
      for (const required of item.requiredResponseElements) assert.ok(observed.responseText.includes(required), `required:${required}`);
      for (const forbidden of item.forbiddenPhrases) assert.equal(observed.responseText.includes(forbidden), false, `forbidden:${forbidden}`);
      assert.equal(compareMeaning(item.meaning, observed.meaning).ok, true);
      const expectedWrites = item.expected.sideEffectCount === 1 || item.expected.sideEffectCount === "partial" ? 1 : 0;
      assert.equal(observed.operationLog.filter((entry) => entry.status === "completed").length, expectedWrites + (item.caseId === "duplicate-create" ? 1 : 0));
    } finally {
      rmSync(observed.workspace, { recursive: true, force: true });
    }
  });
}

check("golden set covers all contract axes and named boundaries", () => {
  const intents = new Set(fixture.cases.map((item) => item.expected.intent));
  const responses = new Set(fixture.cases.map((item) => item.expected.response));
  const effects = new Set(fixture.cases.map((item) => String(item.expected.sideEffectCount)));
  assert.deepEqual([...intents].sort(), ["ambiguous", "destructive", "explicit", "external", "inferred"]);
  assert.deepEqual([...responses].sort(), ["answered", "error", "partial", "question", "saved"]);
  assert.deepEqual([...effects].sort(), ["0", "1", "partial"]);
  const ids = fixture.cases.map((item) => item.caseId).join(" ");
  for (const boundary of ["quote", "hearsay", "hypothetical", "correction", "cancel-unsaved", "cancel-saved", "past-inquiry", "duplicate", "secret", "notify", "todo-complete", "todo-carry", "closed", "closing-zero", "setup-connected", "setup-unknown", "resume", "private-1", "private-2", "private-3", "private-4", "private-5"]) assert.match(ids, new RegExp(boundary));
});

check("actual operation log prevents retry/resume duplicate side effect", () => {
  const first = runConversationScenario({ input: "7月31日の決定として、会議は対面開催と記憶に保存して", precondition: "destinationと内容が一意" });
  const second = runConversationScenario({ input: "7月31日の決定として、会議は対面開催と記憶に保存して", precondition: "destinationと内容が一意", workspace: first.workspace });
  try {
    assert.equal(first.sideEffectCount, 1);
    assert.equal(second.sideEffectCount, 0);
    assert.equal(second.response, "answered");
    assert.equal(second.operationLog.length, 1);
    assert.deepEqual(second.afterSnapshot, { decisionCount: 1 });
  } finally {
    rmSync(first.workspace, { recursive: true, force: true });
  }
});

for (const item of negatives.cases) check(`meaning negative: ${item.id}`, () => assert.equal(sameMeaning(item.base, item.candidate), false));
for (const field of ["subject", "date", "action", "target", "negationCondition", "destination"]) {
  for (const mutation of ["missing", "reversed", "added"]) check(`meaning negative ${field} ${mutation}`, () => {
    const item = fixture.cases.find((entry) => field === "negationCondition" ? entry.caseId === "hypothetical-request" : entry.caseId === "explicit-save-decision");
    const observed = runConversationScenario({ input: item.input, precondition: item.precondition });
    try {
      const mutated = { ...observed.meaning };
      const current = mutated[field];
      if (mutation === "missing") mutated[field] = null;
      if (mutation === "reversed") mutated[field] = `not-${current ?? "none"}`;
      if (mutation === "added") mutated[field] = `${current ?? "none"}+unrequested`;
      const result = compareMeaning(item.meaning, mutated);
      assert.equal(result.ok, false);
      assert.deepEqual(result.differences, [field]);
    } finally {
      rmSync(observed.workspace, { recursive: true, force: true });
    }
  });
}

check("tampered oracle cannot drive observed response, snapshot or meaning", () => {
  const item = fixture.cases.find((entry) => entry.caseId === "explicit-save-decision");
  const tamperedExpected = {
    ...item,
    requiredResponseElements: ["UNREQUESTED_CANARY"],
    afterSnapshot: { decisionCount: 99 },
    meaning: { ...item.meaning, destination: "Slack-unrequested" },
  };
  const observed = runConversationScenario({ input: tamperedExpected.input, precondition: tamperedExpected.precondition });
  try {
    assert.equal(observed.responseText.includes("UNREQUESTED_CANARY"), false);
    assert.notDeepEqual(observed.afterSnapshot, tamperedExpected.afterSnapshot);
    assert.equal(compareMeaning(tamperedExpected.meaning, observed.meaning).ok, false);
  } finally {
    rmSync(observed.workspace, { recursive: true, force: true });
  }
});

check("same precondition with cancel or quote changes observed classification and effects", () => {
  const baseline = runConversationScenario({ input: "7月31日の決定として、会議は対面開催と記憶に保存して", precondition: "destinationと内容が一意" });
  const cancelled = runConversationScenario({ input: "さっきの保存は取り消して", precondition: "destinationと内容が一意・未保存" });
  const quoted = runConversationScenario({ input: "同僚が『会議は対面にして保存して』と言っていた", precondition: "destinationと内容が一意" });
  try {
    assert.deepEqual([baseline.intent, baseline.sideEffectCount], ["explicit", 1]);
    assert.deepEqual([cancelled.intent, cancelled.sideEffectCount], ["inferred", 0]);
    assert.deepEqual([quoted.intent, quoted.sideEffectCount], ["inferred", 0]);
  } finally {
    for (const result of [baseline, cancelled, quoted]) rmSync(result.workspace, { recursive: true, force: true });
  }
});

check("common contract and safety invariants are distributed", () => {
  const contract = readFileSync(join(root, "plugins/secretary/rules/conversation-contract.md"), "utf8");
  const safety = readFileSync(join(root, "plugins/secretary/rules/safety.md"), "utf8");
  const secretary = readFileSync(join(root, "plugins/secretary/skills/secretary/SKILL.md"), "utf8");
  for (const term of ["explicit", "inferred", "ambiguous", "destructive", "external", "answered", "question", "saved", "error", "partial", "atomic write", "rollback", "path guard", "Secret"]) assert.ok(`${contract}\n${safety}`.includes(term), term);
  assert.ok(`${contract}\n${secretary}`.includes("現在の依頼を先に処理"));
});

check("copy schemas are content-dependent", () => {
  for (const name of ["agentic", "yasashii"]) {
    const path = join(root, `plugins/secretary/rules/copy/${name}.json`);
    if (!existsSync(path)) continue;
    const copy = JSON.parse(readFileSync(path, "utf8"));
    assert.equal(copy.schemaVersion, 2);
    assert.deepEqual(Object.keys(copy.surfaces.report.states).sort(), ["answered", "error", "partial", "question", "saved"]);
    assert.equal(Object.hasOwn(copy.surfaces.report, "shortLines"), false);
  }
});

check("0.8 to 0.9 migration manifest is version-specific", () => {
  const migration = JSON.parse(readFileSync(join(root, "plugins/secretary/migrations/0.8.0-to-0.9.0.json"), "utf8"));
  assert.equal(migration.operations.length, 1);
  assert.equal(migration.operations[0].type, "replace-section");
  assert.equal(migration.operations[0].path, "secretary/AGENTS.md");
  assert.match(migration.operations[0].templateFingerprint, /^[a-f0-9]{64}$/);
  const asset = readFileSync(join(root, "plugins/secretary/migrations/assets/conversation-contract-v2.md"), "utf8");
  assert.equal(asset.split(migration.operations[0].marker).length - 1, 1);
});

check("0.8 to 0.9 migration dry-run, ownership, atomicity, rollback and idempotency", () => {
  const temporary = mkdtempSync(join(tmpdir(), "sprint-038-migration-"));
  try {
    const target = join(temporary, "AGENTS.md");
    const oldSection = read(join(root, "plugins/secretary/migrations/assets/conversation-contract-v1.md"), "utf8").trimEnd();
    const newSection = read(join(root, "plugins/secretary/migrations/assets/conversation-contract-v2.md"), "utf8").trimEnd();
    const marker = "<!-- agentic-secretary:conversation-contract:v2:start -->";
    const endMarker = "<!-- agentic-secretary:conversation-contract:v2:end -->";
    const original = Buffer.from(`利用者固有の前置き\n\n${oldSection}\n\n利用者固有の後書き\n`);
    writeFileSync(target, original);
    const plan = planConversationMigration({ body: original.toString(), oldSection, newSection, marker, endMarker, templateFingerprint: "0e613e03e15ae54da6660a4f694aafb66d3a0f9e37238909bf6d649c532efff6" });
    assert.equal(plan.action, "change");
    assert.equal(plan.oldHash, migrationSha(oldSection));
    assert.equal(read(target).equals(original), true, "dry-run must not write");
    const applied = applyConversationMigration({ target, plan, oldSection, newSection });
    const changed = read(target, "utf8");
    assert.ok(changed.startsWith("利用者固有の前置き\n\n"));
    assert.ok(changed.endsWith("\n\n利用者固有の後書き\n"));
    assert.equal(changed.includes(oldSection), false);
    assert.equal(changed.includes(newSection), true);
    assert.equal(planConversationMigration({ body: changed, oldSection, newSection, marker, endMarker, templateFingerprint: plan.templateFingerprint }).action, "already-applied");
    rollbackConversationMigration(target, applied.before);
    assert.equal(read(target).equals(original), true);

    for (const invalid of [
      original.toString().replace("決定の合図", "利用者が編集した決定の合図"),
      `ownership不明\n${newSection.replace(endMarker, "")}\n`,
      `${original.toString()}\n${oldSection}\n`,
    ]) {
      const before = Buffer.from(invalid);
      writeFileSync(target, before);
      const conflict = planConversationMigration({ body: invalid, oldSection, newSection, marker, endMarker, templateFingerprint: plan.templateFingerprint });
      assert.equal(conflict.action, "conflict");
      assert.equal(read(target).equals(before), true);
    }

    writeFileSync(target, original);
    assert.throws(() => applyConversationMigration({ target, plan, oldSection, newSection, simulateFailure: "after-rename" }), /simulated-after-rename/);
    assert.equal(read(target).equals(original), true, "mid-failure rollback");
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

check("current release owners are 0.9.2 and historical 0.8 migration unchanged", () => {
  assert.equal(JSON.parse(readFileSync(join(root, ".claude-plugin/marketplace.json"))).plugins[0].version, "0.9.2");
  assert.equal(JSON.parse(readFileSync(join(root, "plugins/secretary/.claude-plugin/plugin.json"))).version, "0.9.2");
  assert.ok(JSON.parse(readFileSync(join(root, "plugins/secretary/.codex-plugin/plugin.json"))).version.startsWith("0.9.2"));
  assert.equal(JSON.parse(readFileSync(join(root, "plugins/secretary/migrations/0.7.0-to-0.8.0.json"))).toVersion, "0.8.0");
  const changelog = readFileSync(join(root, "plugins/secretary/CHANGELOG.md"), "utf8");
  assert.match(changelog, /^# 変更履歴\n\n## \[0\.9\.2\]/);
  assert.match(changelog, /## \[0\.9\.1\] - 2026-08-03/);
});

check("historical fixtures remain byte-addressable", () => {
  for (const path of ["scripts/fixtures/sprint-029/yasashii-copy-baseline.json", "plugins/secretary/migrations/0.7.0-to-0.8.0.json", "plugins/yasashii-secretary/CHANGELOG.md"]) assert.match(sha(join(root, path)), /^[a-f0-9]{64}$/);
});

console.log(`SPRINT038_PASS=${pass} SPRINT038_FAIL=${process.exitCode ? 1 : 0}`);
