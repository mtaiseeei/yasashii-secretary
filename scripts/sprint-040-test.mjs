#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, cpSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  canonicalMeaning,
  classifyIntent,
  compareMeaning,
  createPendingMemory,
  executeConversation,
  isMemoryDestination,
  resolvePendingMemory,
} from "../plugins/secretary/scripts/lib/conversation-contract.mjs";
import { runConversationScenario } from "./lib/sprint-038-conversation-runner.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const memoryTool = join(root, "plugins/secretary/skills/memory-care/scripts/memory-tools.mjs");
const templates = join(root, "plugins/secretary/templates");
let pass = 0;
let fail = 0;

function check(label, fn) {
  try { fn(); pass += 1; console.log(`PASS ${label}`); }
  catch (error) { fail += 1; console.error(`FAIL ${label}: ${error.stack || error.message}`); }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: options.cwd ?? root, encoding: "utf8", env: { ...process.env, ...options.env } });
  if (options.expected === undefined ? result.status !== 0 : result.status !== options.expected) {
    throw new Error(`${command} ${args.join(" ")} exit=${result.status}\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

function git(workspace, args) { return run("git", ["-C", workspace, ...args]); }

function workspace(label) {
  const temporary = mkdtempSync(join(tmpdir(), `sprint-040-${label}-`));
  const secretary = join(temporary, "secretary");
  mkdirSync(secretary, { recursive: true });
  cpSync(templates, secretary, { recursive: true });
  writeFileSync(join(temporary, "unrelated.txt"), "base\n");
  git(temporary, ["init", "-q"]);
  git(temporary, ["config", "user.name", "Sprint 040"]);
  git(temporary, ["config", "user.email", "sprint040@example.invalid"]);
  git(temporary, ["add", "secretary", "unrelated.txt"]);
  git(temporary, ["commit", "-qm", "base"]);
  return { temporary, secretary };
}

function save(secretary, kind, title, meaning, display, extra = [], expected = 0, clock = "2026-08-25T10:00:00+09:00") {
  const result = run(process.execPath, [memoryTool, "save-memory", secretary, kind, "2026-08-25", title, JSON.stringify(meaning), display, ...extra], {
    expected,
    env: { CC_SECRETARY_NOW: clock },
  });
  return JSON.parse(result.stdout.trim());
}

check("request hedgeとcontent hedgeをintentで分離", () => {
  assert.equal(classifyIntent({ requestHedge: true, target: "企画", destination: "memory" }), "ambiguous");
  assert.equal(classifyIntent({ explicitMemoryRequest: true, target: "Rokunabe", speculation: true }), "explicit");
  assert.equal(classifyIntent({ explicitMemoryRequest: true, target: "開始は9月", hearsay: true }), "explicit");
  assert.equal(classifyIntent({ explicitMemoryRequest: true, target: "金曜", correction: true }), "explicit");
});

check("memory authorizationはmemory内routeだけrun-once、scope変更は質問前0件", () => {
  for (const destination of [undefined, "memory", "decision", "topic", "memory/topics"]) assert.equal(isMemoryDestination(destination), true);
  for (const destination of ["TODO", "Notion TaskDB", "project"]) {
    const observed = executeConversation({
      classifierInput: { explicitMemoryRequest: true, target: "開始は9月", destination, scopeChange: true },
      beforeSnapshot: { writes: 0 },
      changes: [{ key: "writes", delta: 1 }],
    });
    assert.deepEqual([observed.response, observed.sideEffectCount, observed.afterSnapshot.writes], ["question", 0, 0], destination);
  }
  for (const destination of ["TODO", "Notion TaskDB", "project"]) {
    const observed = executeConversation({
      classifierInput: { explicitMemoryRequest: true, target: "開始は9月", destination },
      beforeSnapshot: { writes: 0 },
      changes: [{ key: "writes", delta: 1 }],
    });
    assert.deepEqual([observed.response, observed.sideEffectCount, observed.afterSnapshot.writes], ["question", 0, 0], destination);
  }
  for (const destination of ["memory", "decision", "topic"]) {
    for (const scopeChange of [false, true]) {
      const observed = executeConversation({
        classifierInput: { explicitMemoryRequest: true, target: "開始は9月", destination, scopeChange },
        beforeSnapshot: { writes: 0 },
        changes: [{ key: "writes", delta: 1 }],
      });
      assert.deepEqual([observed.response, observed.sideEffectCount, observed.afterSnapshot.writes], ["saved", 1, 1], `${destination}:${scopeChange}`);
    }
  }
});

check("旧互換explicit分類もdestination allowlistでmemory scopeを守る", () => {
  for (const destination of ["TODO", "Notion TaskDB", "project"]) {
    for (const scopeChange of [undefined, false, true]) {
      const observed = executeConversation({
        classifierInput: { explicit: true, operation: "save-memory", target: "開始は9月", destination, scopeChange },
        beforeSnapshot: { writes: 0 },
        changes: [{ key: "writes", delta: 1 }],
      });
      assert.deepEqual([observed.intent, observed.response, observed.sideEffectCount, observed.afterSnapshot.writes], ["explicit", "question", 0, 0], `${destination}:${scopeChange}`);
    }
  }
  for (const destination of ["memory", "decision", "topic"]) {
    for (const scopeChange of [undefined, false, true]) {
      const observed = executeConversation({
        classifierInput: { explicit: true, operation: "save-memory", target: "開始は9月", destination, scopeChange },
        beforeSnapshot: { writes: 0 },
        changes: [{ key: "writes", delta: 1 }],
      });
      assert.deepEqual([observed.intent, observed.response, observed.sideEffectCount, observed.afterSnapshot.writes], ["explicit", "saved", 1, 1], `${destination}:${scopeChange}`);
    }
  }
});

check("Sprint 038既存6操作はmemory allowlistと独立してrun-once", () => {
  const cases = [
    { operation: "save", target: "会議は対面開催", destination: "memory/decisions" },
    { operation: "pref-set", target: "口調=フランク", destination: "preferences.md" },
    { operation: "create-task", target: "見積を送る", destination: "Notion TaskDB" },
    { operation: "complete", target: "見積TODO", destination: "inbox/todo.md" },
    { operation: "carry", target: "見積TODO", destination: "inbox/todo.md" },
    { operation: "create", target: "見積", destination: "docs" },
  ];
  for (const classifierInput of cases) {
    const observed = executeConversation({
      classifierInput: { explicit: true, ...classifierInput },
      beforeSnapshot: { writes: 0 },
      changes: [{ key: "writes", delta: 1 }],
    });
    assert.deepEqual(
      [observed.intent, observed.response, observed.sideEffectCount, observed.afterSnapshot.writes],
      ["explicit", "saved", 1, 1],
      classifierInput.operation,
    );
  }
});

check("Sprint 038 runnerはgolden classifierInputの実runtime判定で副作用を制御", () => {
  const request = "7月31日の決定として、会議は対面開催と記憶に保存して";
  const precondition = "destinationと内容が一意";
  const negative = runConversationScenario({
    input: request,
    precondition,
    classifierInput: { operation: "save", target: "会議は対面開催", destination: "memory/decisions" },
  });
  const positive = runConversationScenario({
    input: request,
    precondition,
    classifierInput: { explicit: true, operation: "save", target: "会議は対面開催", destination: "memory/decisions" },
  });
  try {
    assert.deepEqual([negative.intent, negative.response, negative.sideEffectCount, negative.afterSnapshot.decisionCount], ["inferred", "question", 0, 0]);
    assert.deepEqual([positive.intent, positive.response, positive.sideEffectCount, positive.afterSnapshot.decisionCount], ["explicit", "saved", 1, 1]);
  } finally {
    rmSync(negative.workspace, { recursive: true, force: true });
    rmSync(positive.workspace, { recursive: true, force: true });
  }
});

check("引用・非現在仮定・取消・過去照会はwrite要求にしない", () => {
  for (const input of [
    { explicitMemoryRequest: true, target: "引用内", quotedRequest: true },
    { explicitMemoryRequest: true, target: "仮定", nonCurrentHypothetical: true },
    { explicitMemoryRequest: true, target: "取消", cancellation: true },
    { explicitMemoryRequest: true, target: "過去", pastInquiry: true },
  ]) assert.equal(classifyIntent(input), "inferred");
});

check("意味tupleは情報源・確実性・訂正関係を比較", () => {
  const base = { subject: "user", action: "remember", target: "開始", source: "田中", certainty: "hearsay", destination: "memory" };
  assert.equal(compareMeaning(base, base).ok, true);
  assert.equal(compareMeaning(base, { ...base, source: "佐藤" }).ok, false);
  assert.equal(compareMeaning(base, { ...base, certainty: "confirmed" }).ok, false);
  assert.notDeepEqual(canonicalMeaning(base), canonicalMeaning({ ...base, correctionOf: "旧予定" }));
});

check("pendingは1件束縛・別話題失効・修正付き了承を同turn実行", () => {
  const pending = createPendingMemory({ content: "開始は9月", scope: "memory", anchor: "launch" });
  assert.deepEqual(resolvePendingMemory(pending, { reply: "はい", anchor: "launch" }), {
    action: "execute", authorization: "explicit", content: "開始は9月", scope: "memory", pending: null, revised: false,
  });
  assert.equal(resolvePendingMemory(pending, { reply: "はい", anchor: "other", topicChanged: true }).action, "expired");
  const revised = resolvePendingMemory(pending, { reply: "はい、ただし開始は10月", anchor: "launch" });
  assert.deepEqual([revised.action, revised.content, revised.revised], ["execute", "開始は10月", true]);
});

check("decisionは内容keyで別turn・表記違い・別operation相当retryを重複しない", () => {
  const item = workspace("decision");
  try {
    const meaning = { subject: "user", action: "remember", target: "Rokunabe", source: "user", certainty: "speculation", destination: "memory" };
    const first = save(item.secretary, "decision", "名称", meaning, "Rokunabeだと思う", ["--checkpoint"]);
    const head = git(item.temporary, ["rev-parse", "HEAD"]).stdout.trim();
    const second = save(item.secretary, "decision", "別の題名", meaning, "Rokunabe だと思う。", ["--checkpoint"], 0, "2026-08-25T11:00:00+09:00");
    assert.deepEqual([first.memoryWrites, first.journalWrites, first.commitWrites], [1, 1, 1]);
    assert.deepEqual([second.memoryWrites, second.journalWrites, second.commitWrites], [0, 0, 0]);
    assert.equal(git(item.temporary, ["rev-parse", "HEAD"]).stdout.trim(), head);
    assert.equal((readFileSync(join(item.secretary, "memory/journal/2026-08-25.md"), "utf8").match(/memory-content-key:/g) || []).length, 1);
  } finally { rmSync(item.temporary, { recursive: true, force: true }); }
});

check("情報源・確実性が異なる内容を誤dedupeしない", () => {
  const item = workspace("distinct");
  try {
    const base = { subject: "user", action: "remember", target: "開始は9月", source: "田中", certainty: "hearsay", destination: "memory" };
    save(item.secretary, "topic", "開始時期", base, "田中さんから開始は9月と聞いた");
    save(item.secretary, "topic", "開始時期", { ...base, source: "公式資料", certainty: "confirmed" }, "公式資料で開始は9月と確認した", [], 0, "2026-08-25T11:00:00+09:00");
    const body = readFileSync(join(item.secretary, "memory/topics/開始時期.md"), "utf8");
    assert.equal((body.match(/memory-content-key:/g) || []).length, 2);
  } finally { rmSync(item.temporary, { recursive: true, force: true }); }
});

check("meaning tupleは表示と整合し、情報源・確実性を正本から復元できる", () => {
  const item = workspace("meaning-persistence");
  try {
    const meaning = { subject: "user", action: "remember", target: "開始は9月", source: "田中", certainty: "hearsay", destination: "memory" };
    const result = save(item.secretary, "topic", "開始時期", meaning, "開始は9月");
    assert.deepEqual([result.memoryWrites, result.journalWrites], [1, 1]);
    const body = readFileSync(join(item.secretary, "memory/topics/開始時期.md"), "utf8");
    const encoded = body.match(/<!-- memory-meaning-v1:([A-Za-z0-9_-]+) -->/u)?.[1];
    assert.ok(encoded, "meaning marker");
    const restored = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    assert.deepEqual([restored.target, restored.source, restored.certainty, restored.destination], ["開始は9月", "田中", "hearsay", "memory"]);
  } finally { rmSync(item.temporary, { recursive: true, force: true }); }
});

check("空tuple・必須意味不足・target不整合は保存前に拒否", () => {
  const item = workspace("invalid-meaning");
  try {
    const before = git(item.temporary, ["status", "--short"]).stdout;
    for (const [meaning, display] of [
      [{}, "内容A"],
      [{}, "内容B"],
      [{ destination: "memory" }, "内容A"],
      [{ target: "開始は10月", destination: "memory" }, "開始は9月"],
      [{ target: "開始は9月", destination: "Notion TaskDB" }, "開始は9月"],
    ]) {
      run(process.execPath, [memoryTool, "save-memory", item.secretary, "topic", "2026-08-25", "不正fixture", JSON.stringify(meaning), display], { expected: 2 });
    }
    assert.equal(git(item.temporary, ["status", "--short"]).stdout, before);
    assert.equal(existsSync(join(item.secretary, "memory/topics/不正fixture.md")), false);
  } finally { rmSync(item.temporary, { recursive: true, force: true }); }
});

check("topic訂正は旧eventを保持してappend-only、訂正retryは0件", () => {
  const item = workspace("correction");
  try {
    const oldMeaning = { subject: "user", action: "remember", target: "開始は9月", certainty: "confirmed", destination: "memory" };
    save(item.secretary, "topic", "開始時期", oldMeaning, "開始は9月");
    const path = join(item.secretary, "memory/topics/開始時期.md");
    const oldLine = "- 開始は9月";
    assert.ok(readFileSync(path, "utf8").includes(oldLine));
    const correction = { ...oldMeaning, target: "開始は10月", correctionOf: "開始は9月", correctionReason: "日程変更" };
    save(item.secretary, "topic", "開始時期", correction, "開始は10月");
    const after = readFileSync(path, "utf8");
    assert.ok(after.includes(oldLine));
    assert.ok(after.includes("訂正: 開始は9月 → 開始は10月（日程変更）"));
    const retry = save(item.secretary, "topic", "開始時期", correction, "開始は10月");
    assert.deepEqual([retry.memoryWrites, retry.journalWrites, retry.commitWrites], [0, 0, 0]);
  } finally { rmSync(item.temporary, { recursive: true, force: true }); }
});

check("checkpoint失敗はpartial、retryはcommit-only、再retryは0", () => {
  const item = workspace("partial");
  try {
    writeFileSync(join(item.temporary, "unrelated.txt"), "利用者のstage\n");
    git(item.temporary, ["add", "unrelated.txt"]);
    const stagedBefore = git(item.temporary, ["diff", "--cached", "--binary"]).stdout;
    const meaning = { subject: "user", action: "remember", target: "開始は9月", source: "田中", certainty: "hearsay", destination: "memory" };
    const partial = save(item.secretary, "topic", "開始時期", meaning, "田中さんから開始は9月と聞いた", ["--checkpoint", "--fail-at", "commit"], 4);
    assert.deepEqual([partial.status, partial.memoryWrites, partial.journalWrites, partial.commitWrites], ["partial", 1, 1, 0]);
    assert.equal(git(item.temporary, ["diff", "--cached", "--binary"]).stdout, stagedBefore);
    const headBeforeRetry = git(item.temporary, ["rev-parse", "HEAD"]).stdout.trim();
    const retry = save(item.secretary, "topic", "開始時期", meaning, "田中さんから開始は9月と聞いた", ["--checkpoint"]);
    assert.deepEqual([retry.memoryWrites, retry.journalWrites, retry.commitWrites], [0, 0, 1]);
    assert.notEqual(git(item.temporary, ["rev-parse", "HEAD"]).stdout.trim(), headBeforeRetry);
    assert.equal(git(item.temporary, ["diff", "--cached", "--binary"]).stdout, stagedBefore);
    const reretry = save(item.secretary, "topic", "開始時期", meaning, "田中さんから開始は9月と聞いた", ["--checkpoint"]);
    assert.deepEqual([reretry.memoryWrites, reretry.journalWrites, reretry.commitWrites], [0, 0, 0]);
  } finally { rmSync(item.temporary, { recursive: true, force: true }); }
});

check("Secretと範囲外pathは保存前に拒否", () => {
  const item = workspace("safety");
  try {
    const before = git(item.temporary, ["status", "--short"]).stdout;
    run(process.execPath, [memoryTool, "save-memory", item.secretary, "topic", "2026-08-25", "資格情報", JSON.stringify({ subject: "user", target: "token", destination: "memory" }), "api_token=actual-secret-value"], { expected: 3 });
    run(process.execPath, [memoryTool, "guarded-write", item.secretary, "../outside.md"], { expected: 3 });
    assert.equal(git(item.temporary, ["status", "--short"]).stdout, before);
    assert.equal(existsSync(join(item.temporary, "outside.md")), false);
  } finally { rmSync(item.temporary, { recursive: true, force: true }); }
});

console.log(`SPRINT040_PASS=${pass} SPRINT040_FAIL=${fail}`);
if (fail) process.exitCode = 1;
