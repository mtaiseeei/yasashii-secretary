#!/usr/bin/env node
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { runPrivateScenario } from "./lib/sprint-038-private-runner.mjs";

let pass = 0;
let fail = 0;
function check(label, fn) {
  try { fn(); pass += 1; console.log(`PASS ${label}`); }
  catch (error) { fail += 1; console.error(`FAIL ${label}: ${error.message}`); }
}

check("番号承認後は1 write、retry/resumeは二重write 0", () => {
  const first = runPrivateScenario({ input: "2番を起票して", precondition: "内容不変で番号承認済み" });
  const second = runPrivateScenario({ input: "2番を起票して", precondition: "内容不変で番号承認済み", workspace: first.workspace });
  try {
    assert.equal(first.response, "saved");
    assert.equal(second.response, "answered");
    assert.equal(second.afterSnapshot.notionWrites, 1);
    assert.equal(second.operationLog.filter((entry) => entry.kind === "connector-write").length, 1);
  } finally { rmSync(first.workspace, { recursive: true, force: true }); }
});

check("明示依頼は質問なし停止せず通常計画を経て1 write", () => {
  const result = runPrivateScenario({ input: "この内容をタスクにして", precondition: "対象一意" });
  try {
    assert.equal(result.response, "saved");
    assert.equal(result.afterSnapshot.notionWrites, 1);
    assert.equal(result.operationLog[0].kind, "plan-preview");
  } finally { rmSync(result.workspace, { recursive: true, force: true }); }
});

check("将来行動はTaskDBへ1 write、local TODOは0", () => {
  const result = runPrivateScenario({ input: "8月10日に請求する", precondition: "将来行動" });
  try {
    assert.equal(result.plan.database, "notion://task-db");
    assert.equal(result.plan.properties.Due, "2026-08-10");
    assert.equal(result.afterSnapshot.notionWrites, 1);
    assert.equal(result.afterSnapshot.localTodoWrites, 0);
  } finally { rmSync(result.workspace, { recursive: true, force: true }); }
});

check("Calendar+vault read-only mergeは成功時write 0", () => {
  const result = runPrivateScenario({ input: "予定とvaultを一緒に調べて", precondition: "read-only横断" });
  try {
    assert.equal(result.response, "answered");
    assert.equal(result.readLog.length, 2);
    assert.equal(result.afterSnapshot.connectorWrites, 0);
  } finally { rmSync(result.workspace, { recursive: true, force: true }); }
});

check("Calendar+vaultの部分失敗はpartialで取得済み結果を保持", () => {
  const result = runPrivateScenario({ input: "予定とvaultを一緒に調べて", precondition: "read-only横断", connectorBehavior: { calendar: "fail" } });
  try {
    assert.equal(result.response, "partial");
    assert.equal(result.readLog.filter((entry) => entry.ok).length, 1);
    assert.equal(result.afterSnapshot.connectorWrites, 0);
  } finally { rmSync(result.workspace, { recursive: true, force: true }); }
});

check("不足一点は利用者向け質問となりwrite 0", () => {
  const result = runPrivateScenario({ input: "これを起票して", precondition: "TaskDB候補だけ複数" });
  try {
    assert.equal(result.response, "question");
    assert.match(result.responseText, /どのTaskDB/);
    assert.deepEqual(result.afterSnapshot, { notionWrites: 0, localTodoWrites: 0, connectorWrites: 0 });
  } finally { rmSync(result.workspace, { recursive: true, force: true }); }
});

check("通常TaskDB/property/relation/plan previewは不変", () => {
  const result = runPrivateScenario({ input: "この内容をタスクにして", precondition: "対象一意" });
  try {
    assert.deepEqual(Object.keys(result.plan.properties), ["Title", "Status", "GTD", "Due", "Project"]);
    assert.deepEqual(result.plan.relation, { property: "Project", pageId: "project-001" });
    assert.equal(result.operationLog[0].kind, "plan-preview");
    assert.equal(result.operationLog[1].kind, "connector-write");
  } finally { rmSync(result.workspace, { recursive: true, force: true }); }
});

check("connector write後page rereadのURL/properties一致を確認", () => {
  const result = runPrivateScenario({ input: "この内容をタスクにして", precondition: "対象一意" });
  try {
    assert.equal(result.verified, true);
    assert.equal(result.page.url, result.reread.url);
    assert.deepEqual(result.page.properties, result.reread.properties);
    assert.equal(result.operationLog.at(-1).kind, "page-reread");
  } finally { rmSync(result.workspace, { recursive: true, force: true }); }
});

check("reread不一致では未確認成功表示0", () => {
  const result = runPrivateScenario({ input: "この内容をタスクにして", precondition: "対象一意", connectorBehavior: { rereadMismatch: true } });
  try {
    assert.equal(result.verified, false);
    assert.equal(result.response, "error");
    assert.equal(result.responseText.includes("成功"), true);
    assert.equal(result.responseText.includes("成功しました"), false);
  } finally { rmSync(result.workspace, { recursive: true, force: true }); }
});

console.log(`SPRINT038_PRIVATE_PASS=${pass} SPRINT038_PRIVATE_FAIL=${fail}`);
process.exitCode = fail === 0 ? 0 : 1;
