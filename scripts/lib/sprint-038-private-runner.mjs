import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TASK_DB = "notion://task-db";
const DEFAULT_RELATION = { property: "Project", pageId: "project-001" };

function readLines(path) {
  return existsSync(path) ? readFileSync(path, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line)) : [];
}
function append(path, entry) {
  appendFileSync(path, `${JSON.stringify(entry)}\n`);
}

export function createPrivateWorkspace(root = null) {
  const workspace = root ?? mkdtempSync(join(tmpdir(), "sprint-038-private-"));
  mkdirSync(workspace, { recursive: true });
  for (const name of ["operations.jsonl", "notion-pages.jsonl", "local-todo.jsonl", "reads.jsonl"]) {
    const path = join(workspace, name);
    if (!existsSync(path)) writeFileSync(path, "");
  }
  return workspace;
}

function taskFromInput(input) {
  if (/2番/.test(input)) return { operationId: "triage-candidate-2", title: "候補2", due: null, approved: true };
  if (/8月10日に請求/.test(input)) return { operationId: "future-invoice-2026-08-10", title: "請求する", due: "2026-08-10", approved: true };
  return { operationId: "explicit-this-content", title: "この内容", due: null, approved: true };
}

function planTask(input) {
  const task = taskFromInput(input);
  return {
    operationId: task.operationId,
    database: TASK_DB,
    properties: {
      Title: task.title,
      Status: "未着手",
      GTD: "Next Action",
      Due: task.due,
      Project: DEFAULT_RELATION.pageId,
    },
    relation: DEFAULT_RELATION,
  };
}

function snapshot(workspace) {
  return {
    notionWrites: readLines(join(workspace, "notion-pages.jsonl")).length,
    localTodoWrites: readLines(join(workspace, "local-todo.jsonl")).length,
    connectorWrites: readLines(join(workspace, "operations.jsonl")).filter((entry) => entry.kind === "connector-write").length,
  };
}

export function runPrivateScenario({ input, precondition, workspace = null, connectorBehavior = {} }) {
  if (typeof input !== "string" || typeof precondition !== "string") throw new Error("natural-language-input-and-precondition-required");
  const root = createPrivateWorkspace(workspace);
  const beforeSnapshot = snapshot(root);
  const operationsPath = join(root, "operations.jsonl");
  const pagesPath = join(root, "notion-pages.jsonl");
  const readsPath = join(root, "reads.jsonl");

  if (/予定とvaultを一緒に調べて/.test(input)) {
    const calendar = connectorBehavior.calendar === "fail" ? { ok: false, error: "calendar-unavailable" } : { ok: true, items: ["10:00 会議"] };
    const vault = connectorBehavior.vault === "fail" ? { ok: false, error: "vault-unavailable" } : { ok: true, items: ["会議メモ"] };
    append(readsPath, { source: "calendar", ...calendar });
    append(readsPath, { source: "vault", ...vault });
    const successful = [calendar, vault].filter((result) => result.ok).length;
    return {
      intent: "explicit",
      response: successful === 2 ? "answered" : successful === 1 ? "partial" : "error",
      responseText: successful === 2 ? "Calendarとvaultの統合結果です。" : successful === 1 ? "取得できた情報を返します。もう一方は取得できませんでした。" : "Calendarとvaultの取得に失敗しました。",
      beforeSnapshot,
      afterSnapshot: snapshot(root),
      readLog: readLines(readsPath),
      operationLog: readLines(operationsPath),
      workspace: root,
    };
  }

  if (/これを起票して/.test(input) && precondition.includes("複数")) {
    return { intent: "ambiguous", response: "question", responseText: "どのTaskDBですか？", beforeSnapshot, afterSnapshot: snapshot(root), plan: null, operationLog: [], workspace: root };
  }

  const plan = planTask(input);
  append(operationsPath, { kind: "plan-preview", plan });
  const completed = readLines(operationsPath).some((entry) => entry.kind === "connector-write" && entry.operationId === plan.operationId);
  if (completed) {
    return { intent: "explicit", response: "answered", responseText: "同じ承認済みタスクはすでに起票済みです。", beforeSnapshot, afterSnapshot: snapshot(root), plan, operationLog: readLines(operationsPath), workspace: root };
  }

  const page = { id: `page-${plan.operationId}`, url: `https://notion.test/${plan.operationId}`, database: plan.database, properties: plan.properties };
  append(operationsPath, { kind: "connector-write", operationId: plan.operationId, database: plan.database, properties: plan.properties, relation: plan.relation });
  append(pagesPath, page);
  const reread = connectorBehavior.rereadMismatch ? { ...page, properties: { ...page.properties, Status: "不一致" } } : page;
  append(operationsPath, { kind: "page-reread", operationId: plan.operationId, page: reread });
  const verified = reread.url === page.url && JSON.stringify(reread.properties) === JSON.stringify(plan.properties);
  return {
    intent: "explicit",
    response: verified ? "saved" : "error",
    responseText: verified ? `${page.url} にタスクを作成し、propertiesを再確認しました。` : "作成後の再確認が一致しないため、成功とは表示しません。",
    beforeSnapshot,
    afterSnapshot: snapshot(root),
    plan,
    page,
    reread,
    verified,
    operationLog: readLines(operationsPath),
    workspace: root,
  };
}
