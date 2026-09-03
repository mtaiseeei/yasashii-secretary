#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { appendEvent, history, status } from "../plugins/secretary/scripts/lib/clarity-core.mjs";
import {
  dailyClarityRollup,
  portfolioRollup,
  weeklyClarityRollup,
} from "../plugins/secretary/scripts/lib/clarity-secretary.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const gitFreeArchive = !existsSync(join(repo, ".git"));
const projectTool = join(repo, "plugins/secretary/scripts/project-tools.mjs");
const adapterCli = join(repo, "plugins/secretary/scripts/clarity-secretary.mjs");
const templates = join(repo, "plugins/secretary/templates");
const work = mkdtempSync(join(tmpdir(), "agentic-s045-"));
const fixedNow = "2026-08-28T09:00:00.000Z";
const results = [];
const suiteCache = new Map();

process.env.CLARITY_NOW = fixedNow;
process.env.CC_SECRETARY_NOW = fixedNow;

function registry() {
  const text = readFileSync(join(repo, "scripts/fixtures/sprint-042/clarity-acceptance.md"), "utf8");
  const body = text.match(/<!-- clarity-acceptance-registry:start -->\s*```json\s*([\s\S]*?)\s*```/u)?.[1];
  assert(body, "registry JSON");
  return JSON.parse(body).primaryCaseIds["sprint-045"];
}

const expected = registry();

function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function json(path) { return JSON.parse(readFileSync(path, "utf8")); }
function lines(path) { return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse); }
function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd || repo,
    encoding: "utf8",
    timeout: options.timeout || 120_000,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...(options.env || {}) },
  });
}
function runJson(command, args, expectedStatus = 0, options = {}) {
  const result = run(command, args, options);
  assert.equal(result.status, expectedStatus, `${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return JSON.parse(expectedStatus === 0 ? result.stdout : result.stderr);
}
function tree(root) {
  const rows = [];
  function visit(dir) {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name); const rel = path.slice(root.length + 1); const stat = lstatSync(path);
      if (stat.isSymbolicLink()) rows.push([rel, "link"]);
      else if (stat.isDirectory()) { rows.push([rel, "dir"]); visit(path); }
      else rows.push([rel, sha(readFileSync(path))]);
    }
  }
  visit(root);
  return sha(JSON.stringify(rows));
}
function secretary(label) {
  const root = join(work, label);
  mkdirSync(root, { recursive: true });
  cpSync(templates, root, { recursive: true });
  mkdirSync(join(root, "projects/open"), { recursive: true });
  mkdirSync(join(root, "projects/closed"), { recursive: true });
  mkdirSync(join(root, "inbox"), { recursive: true });
  if (!existsSync(join(root, "inbox/todo.md"))) writeFileSync(join(root, "inbox/todo.md"), "# TODO（クイックキャプチャ）\n");
  return root;
}
function createProject(root, name) {
  const result = run(process.execPath, [projectTool, "create-light", root, name, "--overview", `${name}の概要`, "--goal", `${name}を完了する`, "--success", "確認済み", "--current", "進行中", "--next", "次を確認", "--confirm"]);
  assert.equal(result.status, 0, result.stderr);
  return join(root, "projects/open", name);
}
function init(root, name) {
  const result = runJson(process.execPath, [adapterCli, "init", root, name, "--apply", "--json"]);
  return { ...result, root: join(root, "projects/open", name, "clarity") };
}
function itemId(clarityRoot) { return status(clarityRoot).attention.top[0]?.itemId || json(join(clarityRoot, ".clarity/state.json")).items[0].itemId; }
function appendFixtureItem(clarityRoot, suffix, overrides = {}) {
  const base = structuredClone(json(join(clarityRoot, ".clarity/state.json")).items[0]);
  const item = {
    ...base,
    ...overrides,
    itemId: `ci_${String(suffix).padStart(20, "0")}`,
    title: overrides.title || `追加Item ${suffix}`,
    timestamps: { createdAt: fixedNow, updatedAt: fixedNow },
  };
  appendEvent(clarityRoot, { type: "item.discovered", itemId: item.itemId, actor: "sprint-045-fixture", payload: { item } });
  return item.itemId;
}
function suite(key, command, args) {
  if (!suiteCache.has(key)) suiteCache.set(key, run(command, args, { timeout: 300_000 }));
  const result = suiteCache.get(key);
  assert.equal(result.status, 0, `${key} exit=${result.status}\n${result.stdout.slice(-6000)}\n${result.stderr.slice(-3000)}`);
  return result;
}
async function test(id, title, fn) {
  assert(expected.includes(id), `unexpected ID ${id}`);
  assert(!results.some((row) => row.id === id), `duplicate ID ${id}`);
  try { await fn(); results.push({ id, ok: true }); process.stdout.write(`PASS ${id} ${title}\n`); }
  catch (error) { results.push({ id, ok: false }); process.stdout.write(`FAIL ${id} ${title}: ${error?.stack || error}\n`); }
}

try {
  await test("SL-001", "generic open Project内だけにClarityを作る", () => {
    const root = secretary("sl001"); const project = createProject(root, "営業改善"); const before = tree(root);
    const preview = runJson(process.execPath, [adapterCli, "init", root, "営業改善", "--json"]);
    assert.equal(preview.status, "preview"); assert.equal(tree(root), before); init(root, "営業改善");
    assert(existsSync(join(project, "clarity/.clarity/project.json"))); assert.equal(json(join(project, "clarity/.clarity/project.json")).mode, "secretary-local");
    assert.equal(existsSync(join(root, ".clarity")), false);
  });

  await test("SL-002", "legacyはresolverどおりread-only", () => {
    const root = secretary("sl002"); const legacy = join(root, "projects/旧案件"); mkdirSync(legacy); writeFileSync(join(legacy, "PROJECT.md"), "# 旧案件\n");
    const before = tree(root); const preview = runJson(process.execPath, [adapterCli, "init", root, "旧案件", "--json"]);
    assert.equal(preview.resolver.selected, "legacy"); assert.equal(run(process.execPath, [adapterCli, "init", root, "旧案件", "--apply", "--json"]).status, 3); assert.equal(tree(root), before);
  });

  await test("SL-003", "openとlegacy競合はopenを採用して報告", () => {
    const root = secretary("sl003"); createProject(root, "競合案件"); const legacy = join(root, "projects/競合案件"); mkdirSync(legacy); writeFileSync(join(legacy, "PROJECT.md"), "# legacy\n");
    const preview = runJson(process.execPath, [adapterCli, "init", root, "競合案件", "--json"]);
    assert.equal(preview.resolver.selected, "open"); assert.equal(preview.resolver.conflict.reason, "open-preferred");
  });

  await test("SL-004", "closedは通常探索しない", () => {
    const root = secretary("sl004"); const closed = join(root, "projects/closed/過去案件"); mkdirSync(closed); writeFileSync(join(closed, "PROJECT.md"), "---\nstatus: completed\n---\n# 過去案件\n");
    const report = portfolioRollup(root); assert.equal(report.projectCount, 0); assert.equal(report.closedIncluded, false); assert(!JSON.stringify(report).includes("過去案件"));
  });

  await test("SL-005", "closed明示時だけ指定Projectを参照", () => {
    const root = secretary("sl005"); createProject(root, "完了案件"); const initialized = init(root, "完了案件");
    const complete = run(process.execPath, [projectTool, "complete", root, "完了案件", "--result", "完了", "--remaining", "なし", "--confirm"]); assert.equal(complete.status, 0, complete.stderr);
    const report = runJson(process.execPath, [adapterCli, "status", root, "完了案件", "--closed", "--json"]); assert.equal(report.clarityProjectId, initialized.clarityProjectId); assert.equal(report.project.scope, "closed");
  });

  await test("SL-006", "Secretary-local lifecycle込みで既存Decision seamへ一度だけ委譲", () => {
    const root = secretary("sl006"); const project = createProject(root, "価格方針"); const clarity = init(root, "価格方針"); const decision = "価格は月額制にする";
    const args = [adapterCli, "decide", root, "価格方針", "--decision", decision, "--current", "価格確定", "--next", "案内更新", "--json"];
    const first = runJson(process.execPath, args); const second = runJson(process.execPath, args);
    assert.equal(first.status, "saved"); assert.equal(second.status, "unchanged");
    const projectBody = readFileSync(join(project, "PROJECT.md"), "utf8"); assert.equal(projectBody.split(decision).length - 1, 1);
    assert(!readFileSync(join(root, "memory/MEMORY.md"), "utf8").includes(decision));
    assert(!readFileSync(join(clarity.root, ".clarity/events.jsonl"), "utf8").includes(decision));
    assert.equal(history(clarity.root).events.filter((event) => event.type === "decision.confirmed").length, 1);

    createProject(root, "確定後partial"); const after = init(root, "確定後partial"); const afterDecision = "対象地域は関西にする";
    const afterArgs = [adapterCli, "decide", root, "確定後partial", "--decision", afterDecision, "--current", "地域確認", "--next", "候補抽出", "--json"];
    const afterPartial = runJson(process.execPath, afterArgs, 4, { env: { CLARITY_DECISION_FAIL_AT: "clarity-finalize" } });
    assert.equal(afterPartial.changed, true); assert.deepEqual(afterPartial.completed, ["project-decision"]); assert.deepEqual(afterPartial.pending, ["clarity-confirmation"]); assert.match(afterPartial.nextAction, /再実行/u);
    assert.equal(runJson(process.execPath, afterArgs, 4, { env: { CLARITY_DECISION_FAIL_AT: "clarity-finalize" } }).changed, false);
    assert.notEqual(status(after.root).attention.top[0]?.reasons?.includes("confirmed_but_not_executed"), true);
    assert.equal(runJson(process.execPath, afterArgs).status, "saved");
    assert.equal(readFileSync(join(root, "projects/open/確定後partial/PROJECT.md"), "utf8").split(afterDecision).length - 1, 1);
    assert.equal(history(after.root).events.filter((event) => event.type === "decision.confirmed").length, 1);

    createProject(root, "正本前partial"); const before = init(root, "正本前partial"); const beforeDecision = "公開日は10月1日にする";
    const beforeArgs = [adapterCli, "decide", root, "正本前partial", "--decision", beforeDecision, "--current", "日付確認", "--next", "告知準備", "--json"];
    const beforePartial = runJson(process.execPath, beforeArgs, 4, { env: { CLARITY_DECISION_FAIL_AT: "decision-write" } });
    assert.equal(beforePartial.changed, true); assert.deepEqual(beforePartial.completed, ["clarity-pending"]); assert.deepEqual(beforePartial.pending, ["project-decision", "clarity-confirmation"]); assert.match(beforePartial.nextAction, /再実行/u);
    assert.equal(runJson(process.execPath, beforeArgs, 4, { env: { CLARITY_DECISION_FAIL_AT: "decision-write" } }).changed, false);
    assert(!readFileSync(join(root, "projects/open/正本前partial/PROJECT.md"), "utf8").includes(beforeDecision));
    assert(!history(before.root).events.some((event) => event.type === "decision.confirmed"));
    assert.equal(runJson(process.execPath, beforeArgs).status, "saved");
    assert.equal(readFileSync(join(root, "projects/open/正本前partial/PROJECT.md"), "utf8").split(beforeDecision).length - 1, 1);
  });

  await test("SL-007", "Item作成はtask 0、明示時だけfixed handoff", () => {
    const root = secretary("sl007"); createProject(root, "タスク境界"); const clarity = init(root, "タスク境界"); const todo = join(root, "inbox/todo.md"); const before = readFileSync(todo, "utf8"); const id = itemId(clarity.root);
    const added = [];
    for (let index = 1; index <= 4; index += 1) added.push(appendFixtureItem(clarity.root, index));
    const nonAttention = appendFixtureItem(clarity.root, 5, { disposition: "idea", title: "Attention外Item" });
    const visible = new Set(status(clarity.root).attention.top.map((item) => item.itemId));
    const allIds = [id, ...added, nonAttention];
    const outsideTop = allIds.find((candidate) => candidate !== nonAttention && !visible.has(candidate)); assert(outsideTop);
    const implicit = runJson(process.execPath, [adapterCli, "task-route", root, "タスク境界", "--item-id", id, "--target", "downstream-task", "--json"]); assert.equal(implicit.status, "not-routed"); assert.equal(implicit.taskWrites, 0);
    const local = runJson(process.execPath, [adapterCli, "task-route", root, "タスク境界", "--item-id", outsideTop, "--target", "local-todo", "--explicit", "--json"]); assert.equal(local.route, "project-tools:add-todo");
    const explicit = runJson(process.execPath, [adapterCli, "task-route", root, "タスク境界", "--item-id", nonAttention, "--target", "downstream-task", "--explicit", "--json"]); assert.equal(explicit.status, "fixed-handoff-required"); assert.equal(explicit.confirmationBoundary, "existing");
    const missing = runJson(process.execPath, [adapterCli, "task-route", root, "タスク境界", "--item-id", "ci_ffffffffffffffffffff", "--target", "local-todo", "--explicit", "--json"], 3); assert.equal(missing.code, "item-missing");
    assert.equal(readFileSync(todo, "utf8"), before);
  });

  await test("SL-008", "public adapterはdownstream保護値を実装しない", () => {
    const adapter = json(join(repo, "plugins/secretary/clarity/secretary-adapter.json"));
    assert.equal(adapter.downstream.implementationIncluded, false); assert.equal(adapter.downstream.protectedValuesIncluded, false);
    const sources = ["plugins/secretary/scripts/lib/clarity-secretary.mjs", "plugins/secretary/scripts/clarity-secretary.mjs", "plugins/secretary/clarity/secretary-adapter.json"].map((path) => readFileSync(join(repo, path), "utf8")).join("\n");
    const protectedLiterals = [`0${5}/0${2}`, `1${0}_${"sources"}`, `${"Not"}ion`];
    for (const literal of protectedLiterals) assert.equal(sources.includes(literal), false, literal);
  });

  await test("SL-009", "Project表示はmode・Attention・link healthの短いsummary", () => {
    const root = secretary("sl009"); createProject(root, "表示案件"); init(root, "表示案件"); const shown = run(process.execPath, [projectTool, "show", root, "表示案件"]);
    assert.equal(shown.status, 0); assert.match(shown.stdout, /mode: secretary-local/u); assert.match(shown.stdout, /Attention:/u); assert.match(shown.stdout, /link health:/u);
  });

  await test("SL-010", "PROJECT正本へ全Item本文を埋め込まない", () => {
    const root = secretary("sl010"); const project = createProject(root, "非埋込"); const before = readFileSync(join(project, "PROJECT.md"), "utf8"); init(root, "非埋込"); assert.equal(readFileSync(join(project, "PROJECT.md"), "utf8"), before);
    assert(!before.includes("Project Clarity"));
  });

  await test("SL-011", "完了時もClarity IDと履歴を伴ってclosedへ移る", () => {
    const root = secretary("sl011"); createProject(root, "完了移動"); const clarity = init(root, "完了移動"); const beforeEvents = readFileSync(join(clarity.root, ".clarity/events.jsonl"), "utf8");
    assert.equal(run(process.execPath, [projectTool, "complete", root, "完了移動", "--result", "達成", "--remaining", "なし", "--confirm"]).status, 0);
    const moved = join(root, "projects/closed/完了移動/clarity"); const project = json(join(moved, ".clarity/project.json")); assert.equal(project.clarityProjectId, clarity.clarityProjectId); assert.equal(project.secretaryLink.projectRef, "PROJECT.md"); assert.equal(project.secretaryLink.referenceBase, "secretary-project-root"); assert.equal(readFileSync(join(moved, ".clarity/events.jsonl"), "utf8"), beforeEvents);
    const closedStatus = runJson(process.execPath, [adapterCli, "status", root, "完了移動", "--closed", "--json"]); assert.equal(closedStatus.linkHealth, "local-reference-healthy"); assert(existsSync(join(root, "projects/closed/完了移動", project.secretaryLink.projectRef)));
    const staleProject = { ...project, secretaryLink: { ...project.secretaryLink, projectRef: "projects/open/完了移動/PROJECT.md", referenceBase: "secretary-root" } }; writeFileSync(join(moved, ".clarity/project.json"), `${JSON.stringify(staleProject, null, 2)}\n`);
    assert.equal(runJson(process.execPath, [adapterCli, "status", root, "完了移動", "--closed", "--json"]).linkHealth, "local-reference-stale");
  });

  await test("SL-012", "再開時にClarity履歴を再作成しない", () => {
    const root = secretary("sl012"); createProject(root, "再開案件"); const clarity = init(root, "再開案件"); const beforeProject = readFileSync(join(clarity.root, ".clarity/project.json"), "utf8");
    assert.equal(run(process.execPath, [projectTool, "complete", root, "再開案件", "--result", "一旦完了", "--remaining", "追加確認", "--confirm"]).status, 0);
    assert.equal(run(process.execPath, [projectTool, "reopen", root, "再開案件", "--reason", "追加対応", "--next", "確認", "--confirm"]).status, 0);
    const reopened = join(root, "projects/open/再開案件/clarity"); const project = json(join(reopened, ".clarity/project.json")); assert.equal(project.clarityProjectId, clarity.clarityProjectId); assert.equal(project.secretaryLink.projectRef, "PROJECT.md"); assert.equal(readFileSync(join(reopened, ".clarity/project.json"), "utf8"), beforeProject); assert.equal(lines(join(reopened, ".clarity/events.jsonl")).length, 1);
    const reopenedStatus = runJson(process.execPath, [adapterCli, "status", root, "再開案件", "--json"]); assert.equal(reopenedStatus.linkHealth, "local-reference-healthy"); assert(existsSync(join(root, "projects/open/再開案件", project.secretaryLink.projectRef)));
  });

  await test("PF-001", "複数open ProjectのPortfolio rollup", () => {
    const root = secretary("pf001"); for (const name of ["A案件", "B案件"]) { createProject(root, name); init(root, name); }
    const report = portfolioRollup(root); assert.equal(report.mode, "portfolio"); assert.equal(report.projectCount, 2); assert.deepEqual(report.projects.map((row) => row.name), ["A案件", "B案件"]);
  });

  await test("PF-002", "closedは通常Portfolioから除外", () => {
    const root = secretary("pf002"); createProject(root, "open案件"); init(root, "open案件"); createProject(root, "closed案件"); init(root, "closed案件");
    const legacy = join(root, "projects/legacy案件"); mkdirSync(legacy); writeFileSync(join(legacy, "PROJECT.md"), "# legacy案件\n");
    assert.equal(run(process.execPath, [projectTool, "complete", root, "closed案件", "--result", "完了", "--remaining", "なし", "--confirm"]).status, 0);
    const report = portfolioRollup(root); assert.deepEqual(report.projects.map((row) => row.name), ["open案件"]); assert.equal(report.closedIncluded, false); assert(!JSON.stringify(report).includes("legacy案件"));
  });

  await test("PF-003", "morningは独立した今日の要確認section", () => {
    const root = secretary("pf003"); createProject(root, "朝案件"); init(root, "朝案件"); const result = run(process.execPath, [adapterCli, "daily", root, "--mode", "morning"]); const report = runJson(process.execPath, [adapterCli, "daily", root, "--mode", "morning", "--json"]);
    assert.equal(result.status, 0); assert.match(result.stdout, /^## 今日の要確認$/mu); assert.match(result.stdout, /理由:/u); assert.match(result.stdout, /根拠:/u); assert.match(result.stdout, /選択:/u); assert.equal(report.section, "今日の要確認"); assert(report.items[0].conclusion); assert(report.items[0].evidence.length > 0); assert(report.items[0].choices.length > 0);
  });

  await test("PF-004", "TODOとAttentionが同内容でも自動task化しない", () => {
    const root = secretary("pf004"); createProject(root, "重複境界"); const clarity = init(root, "重複境界"); const todo = join(root, "inbox/todo.md"); writeFileSync(todo, `${readFileSync(todo, "utf8")}\n- [ ] 重複境界の現在状況\n`); const before = readFileSync(todo, "utf8");
    dailyClarityRollup(root); assert.equal(readFileSync(todo, "utf8"), before); assert.equal(status(clarity.root).attention.activeCount, 1);
  });

  await test("PF-005", "Criticalを理由付きで最優先表示", () => {
    const root = secretary("pf005"); createProject(root, "重大案件"); const clarity = init(root, "重大案件"); const id = itemId(clarity.root);
    appendEvent(clarity.root, { type: "validation.changed", itemId: id, actor: "test", payload: { status: "failed" } });
    const report = runJson(process.execPath, [adapterCli, "portfolio", root, "--json"]); assert.equal(report.attention.top[0].level, "critical"); assert(report.attention.top[0].reasonLabels.some((label) => label.includes("検証"))); assert(report.attention.top[0].conclusion); assert(report.attention.top[0].evidence.length > 0); assert(report.attention.top[0].choices.length > 0);
    const plain = run(process.execPath, [adapterCli, "portfolio", root]); assert.equal(plain.status, 0); assert.match(plain.stdout, /理由:/u); assert.match(plain.stdout, /根拠:/u); assert.match(plain.stdout, /選択:/u);
  });

  await test("PF-006", "Attentionなしは簡潔に現在判断不要", () => {
    const root = secretary("pf006"); createProject(root, "安定案件"); const clarity = init(root, "安定案件"); const id = itemId(clarity.root);
    appendEvent(clarity.root, { type: "disposition.changed", itemId: id, actor: "test", payload: { disposition: "idea" } });
    const report = dailyClarityRollup(root); assert.equal(report.items.length, 0); assert.equal(report.conclusion, "現在判断不要です");
  });

  await test("PF-007", "eveningはDecision・実装・候補・Driftを分離", () => {
    const root = secretary("pf007"); createProject(root, "夕方案件"); init(root, "夕方案件"); const report = dailyClarityRollup(root, { mode: "evening" });
    for (const key of ["decisions", "execution", "candidates", "drift", "carriedAttention"]) assert(Array.isArray(report[key])); assert.equal(report.connectorReads, 0);
  });

  await test("PF-008", "weeklyはAttention増減と解消を独立表示", () => {
    const root = secretary("pf008"); createProject(root, "週次案件"); const clarity = init(root, "週次案件"); const id = itemId(clarity.root);
    appendEvent(clarity.root, { type: "attention.resolved", itemId: id, actor: "test", payload: { operationId: "weekly-1", reason: "possible_drift" } });
    const report = weeklyClarityRollup(root, { attention: { activeCount: 3 } }); assert.equal(report.section, "Project Clarity"); assert.equal(typeof report.attention.change, "number"); assert.equal(report.resolvedDrift, 1); assert(Array.isArray(report.lag)); assert(Array.isArray(report.longRunning));
  });

  await test("PF-010", "source failureは取得済みと未確認を分離", () => {
    const root = secretary("pf010"); createProject(root, "正常案件"); init(root, "正常案件"); createProject(root, "破損案件"); const broken = init(root, "破損案件"); writeFileSync(join(broken.root, ".clarity/events.jsonl"), "not-json\n");
    const report = portfolioRollup(root); assert(report.projects.some((row) => row.name === "正常案件")); assert(report.unverifiedSources.some((row) => row.project === "破損案件"));
  });

  await test("PF-011", "Portfolioは全Item数でなくAttention中心", () => {
    const root = secretary("pf011"); createProject(root, "件数案件"); init(root, "件数案件"); const report = portfolioRollup(root); const serialized = JSON.stringify(report);
    assert(Object.hasOwn(report.projects[0], "attentionCount")); assert(!serialized.includes("itemCount")); assert(!serialized.includes('"_rank"')); assert.equal(report.itemBodiesIncluded, false);
  });

  await test("PF-012", "dailyは全stateを読み上げずbounded", () => {
    const root = secretary("pf012-single"); createProject(root, "単一案件"); const clarity = init(root, "単一案件");
    for (let index = 1; index < 6; index += 1) appendFixtureItem(clarity.root, 100 + index);

    const canonical = runJson(process.execPath, [adapterCli, "status", root, "単一案件", "--json"]);
    assert.equal(canonical.attention.activeCount, 6); assert.equal(canonical.attention.top.length, 3); assert.equal(canonical.attention.otherCount, 3);

    const portfolioJson = runJson(process.execPath, [adapterCli, "portfolio", root, "--json"]);
    assert.equal(portfolioJson.attention.activeCount, 6); assert.equal(portfolioJson.attention.top.length, 3); assert.equal(portfolioJson.attention.otherCount, 3);
    assert.equal(portfolioJson.itemBodiesIncluded, false); assert.equal(portfolioJson.connectorReads, 0);
    const portfolioPlain = run(process.execPath, [adapterCli, "portfolio", root]);
    assert.equal(portfolioPlain.status, 0); assert.match(portfolioPlain.stdout, /Attention 6件/u); assert.match(portfolioPlain.stdout, /その他 3件/u); assert.equal((portfolioPlain.stdout.match(/理由:/gu) || []).length, 3);

    const dailyJson = runJson(process.execPath, [adapterCli, "daily", root, "--mode", "morning", "--json"]);
    assert.equal(dailyJson.conclusion, "今日確認したい項目は6件です"); assert.equal(dailyJson.items.length, 3); assert.equal(dailyJson.otherCount, 3);
    assert.equal(dailyJson.itemBodiesIncluded, false); assert.equal(dailyJson.connectorReads, 0);
    const dailyPlain = run(process.execPath, [adapterCli, "daily", root, "--mode", "morning"]);
    assert.equal(dailyPlain.status, 0); assert.match(dailyPlain.stdout, /今日確認したい項目は6件です/u); assert.match(dailyPlain.stdout, /その他 3件/u); assert.equal((dailyPlain.stdout.match(/理由:/gu) || []).length, 3); assert(dailyPlain.stdout.length < 3000);

    const multiRoot = secretary("pf012-multi");
    for (let index = 0; index < 8; index += 1) { const name = `案件${index}`; createProject(multiRoot, name); init(multiRoot, name); }
    const multiJson = runJson(process.execPath, [adapterCli, "daily", multiRoot, "--mode", "morning", "--json"]);
    assert.equal(multiJson.conclusion, "今日確認したい項目は8件です"); assert.deepEqual(multiJson.items.map((item) => item.project), ["案件0", "案件1", "案件2"]); assert.equal(multiJson.items.length, 3); assert.equal(multiJson.otherCount, 5);
    assert.equal(multiJson.itemBodiesIncluded, false); assert.equal(multiJson.connectorReads, 0);
  });

  await test("RG-001", "Clarity Item作成で外部task write 0", () => {
    const root = secretary("rg001"); createProject(root, "自動作成なし"); const todo = join(root, "inbox/todo.md"); const before = readFileSync(todo, "utf8"); init(root, "自動作成なし"); assert.equal(readFileSync(todo, "utf8"), before);
  });

  await test("RG-002", "明示タスク化だけ既存確認境界へ委譲", () => {
    const root = secretary("rg002"); createProject(root, "明示委譲"); const clarity = init(root, "明示委譲"); const id = itemId(clarity.root);
    const result = runJson(process.execPath, [adapterCli, "task-route", root, "明示委譲", "--item-id", id, "--target", "downstream-task", "--explicit", "--json"]); assert.equal(result.route, "downstream-task-adapter"); assert.equal(result.confirmationBoundary, "existing"); assert.equal(result.taskWrites, 0);
  });

  await test("RG-003", "projects create・complete・reopen回帰", () => { suite("projects", "bash", ["scripts/sprint-015-regression.sh"]); });
  await test("RG-004", "daily既存予定・TODO回帰", () => { suite("daily", "bash", ["scripts/sprint-010-regression.sh"]); });
  await test("RG-005", "weekly既存集計回帰", () => { suite("weekly", "bash", ["scripts/sprint-012-regression.sh"]); });
  await test("RG-006", "memory authorizationはClarity scopeへ漏れない", () => { suite("memory", process.execPath, ["scripts/sprint-040-test.mjs"]); });
  await test("RG-007", "Chatwork config・workflow・history境界回帰", () => {
    suite("chatwork-causality", process.execPath, ["scripts/sprint-024-data-causality-test.mjs"]);
    for (const path of ["plugins/secretary/skills/chatwork/scripts/config-transaction.mjs", "plugins/secretary/skills/chatwork/scripts/search-flow.mjs", "plugins/secretary/workspace-templates/chatwork/scripts/chatwork-sync.mjs"]) suite(`chatwork-check-${path}`, process.execPath, ["--check", path]);
  });
  await test("RG-008", "Google Chat OAuth・space・history境界回帰", () => {
    if (gitFreeArchive) {
      suite("google-chat-runtime", process.execPath, ["scripts/sprint-020-google-chat-test.mjs"]);
      suite("google-chat-adversarial", process.execPath, ["scripts/sprint-020-adversarial-test.mjs"]);
    } else suite("google-chat", "bash", ["scripts/sprint-020-regression.sh"]);
  });

  await test("RG-009", "downstream sourceはread-only fixed handoff", () => {
    const adapter = json(join(repo, "plugins/secretary/clarity/secretary-adapter.json")); assert.equal(adapter.downstream.status, "fixed-handoff-required"); assert.equal(adapter.downstream.implementationIncluded, false);
  });

  await test("RG-010", "identity・rename回帰", () => { suite("identity", "bash", ["scripts/sprint-039-regression.sh"]); });
  await test("RG-011", "plugin update・migration・version gate回帰", () => {
    suite("update-config", process.execPath, ["scripts/sprint-030-update-config-test.mjs"]);
    if (gitFreeArchive) {
      suite("update-current-release-integrity", "python3", ["scripts/check-release-integrity.py"]);
      assert.equal(json(join(repo, "plugins/secretary/migrations/0.7.0-to-0.8.0.json")).toVersion, "0.8.0");
    } else suite("update-gate", process.execPath, ["scripts/sprint-032-update-gate-test.mjs"]);
    for (const path of ["plugins/secretary/scripts/update-diagnose.mjs", "plugins/secretary/scripts/update-apply.mjs", "plugins/secretary/scripts/update-ledger.mjs"]) suite(`update-check-${path}`, process.execPath, ["--check", path]);
  });

  await test("RG-012", "SecretaryへHarness本体を同梱しない", () => {
    const plugin = join(repo, "plugins/secretary");
    assert.equal(existsSync(join(plugin, "agents")), false); assert.equal(existsSync(join(plugin, "scripts/harness.mjs")), false); assert.equal(existsSync(join(plugin, ".harness")), false);
    const edition = json(join(plugin, "edition.json")); assert(edition.harness.hosts.codex.installId.includes("harness"));
  });
} finally {
  delete process.env.CLARITY_NOW;
  delete process.env.CC_SECRETARY_NOW;
  rmSync(work, { recursive: true, force: true });
}

assert.deepEqual(results.map((row) => row.id), expected, "Sprint 045 registry order/count mismatch");
const duplicate = results.length - new Set(results.map((row) => row.id)).size;
const missing = expected.filter((id) => !results.some((row) => row.id === id));
const extra = results.filter((row) => !expected.includes(row.id));
const failed = results.filter((row) => !row.ok);
process.stdout.write(`SPRINT045_CASE_PASS=${results.length - failed.length} FAIL=${failed.length} TOTAL=${results.length}\n`);
process.stdout.write(`SPRINT045_REGISTRY_MISSING=${missing.length} DUPLICATE=${duplicate} EXTRA=${extra.length}\n`);
if (failed.length || missing.length || duplicate || extra.length) process.exit(1);
