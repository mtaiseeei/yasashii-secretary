#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { routeSecretaryIntent } from "../plugins/secretary/scripts/lib/collaboration-router.mjs";
import { digestSurface, loadCollaborationInventory, validateCollaborationInventory } from "./lib/sprint-049-inventory.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "agentic-s049-"));
const projectTool = join(repo, "plugins/secretary/scripts/project-tools.mjs");
const claritySecretary = join(repo, "plugins/secretary/scripts/clarity-secretary.mjs");
const templates = join(repo, "plugins/secretary/templates");
const results = [];
const critical = new Set(["CLX-001", "CLX-002", "CLX-004", "CLX-005", "CLX-006", "CLX-009", "CLX-010", "CLX-011", "CLX-012", "CLX-013", "CLX-016", "CLX-017", "CLX-018", "CLX-019", "CLX-020"]);
const fixedNow = "2026-08-28T09:00:00.000Z";

function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function json(path) { return JSON.parse(readFileSync(path, "utf8")); }
function text(path) { return readFileSync(path, "utf8"); }
function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd || repo,
    encoding: "utf8",
    timeout: options.timeout || 180_000,
    maxBuffer: 128 * 1024 * 1024,
    env: { ...process.env, CLARITY_NOW: fixedNow, CC_SECRETARY_NOW: fixedNow, ...(options.env || {}) },
  });
}
function runJson(command, args, status = 0, options = {}) {
  const result = run(command, args, options);
  assert.equal(result.status, status, `${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return JSON.parse(status === 0 ? result.stdout : result.stderr);
}
function registry() {
  const source = text(join(repo, "scripts/fixtures/sprint-042/clarity-acceptance.md"));
  const body = source.match(/<!-- clarity-acceptance-registry:start -->\s*```json\s*([\s\S]*?)\s*```/u)?.[1];
  assert(body, "acceptance registry JSON missing");
  const parsed = JSON.parse(body);
  const ids = parsed.collaborationCaseIds["sprint-049"];
  const primary = Object.values(parsed.primaryCaseIds).flat();
  assert.equal(primary.length, 250);
  assert.equal(new Set(primary).size, 250);
  assert(primary.every((id) => !ids.includes(id)), "CLX must not enter primary 250");
  return ids;
}
const expected = registry();

function tree(root) {
  const rows = [];
  function visit(directory) {
    for (const name of readdirSync(directory).sort((a, b) => Buffer.from(a).compare(Buffer.from(b)))) {
      const absolute = join(directory, name); const rel = relative(root, absolute).replaceAll("\\", "/"); const stat = lstatSync(absolute);
      if (stat.isSymbolicLink()) rows.push([rel, "link"]);
      else if (stat.isDirectory()) { rows.push([rel, "dir"]); visit(absolute); }
      else rows.push([rel, sha(readFileSync(absolute))]);
    }
  }
  visit(root);
  return sha(JSON.stringify(rows));
}
function secretary(label) {
  const root = join(work, label); mkdirSync(root, { recursive: true }); cpSync(templates, root, { recursive: true });
  mkdirSync(join(root, "projects/open"), { recursive: true }); mkdirSync(join(root, "projects/closed"), { recursive: true }); mkdirSync(join(root, "inbox"), { recursive: true });
  if (!existsSync(join(root, "inbox/todo.md"))) writeFileSync(join(root, "inbox/todo.md"), "# TODO（クイックキャプチャ）\n");
  return root;
}
function createProject(root, name) {
  const result = run(process.execPath, [projectTool, "create-light", root, name, "--overview", `${name}の概要`, "--goal", `${name}を完了する`, "--success", "確認済み", "--current", "進行中", "--next", "次を確認", "--confirm"]);
  assert.equal(result.status, 0, result.stderr);
  return join(root, "projects/open", name);
}
function initClarity(root, name) { return runJson(process.execPath, [claritySecretary, "init", root, name, "--apply", "--json"]); }
function state(root, name, scope = "open") { return json(join(root, `projects/${scope}/${name}/clarity/.clarity/state.json`)); }
function project(root, name, scope = "open") { return json(join(root, `projects/${scope}/${name}/clarity/.clarity/project.json`)); }
function events(root, name, scope = "open") { return text(join(root, `projects/${scope}/${name}/clarity/.clarity/events.jsonl`)); }
function zeroEffect(value) { assert.deepEqual(value.sideEffect, { performed: false, fileWrites: 0, adapterCalls: 0, commandCalls: 0, externalCalls: 0 }); }
function expectFailure(fn, prefix) { assert.throws(fn, (error) => error instanceof Error && error.message.startsWith(prefix), `expected ${prefix}`); }
function refreshSurface(root, inventory, id) { const surface = inventory.surfaces.find((entry) => entry.id === id); surface.contentDigest = digestSurface(root, surface.paths); }
function hookFiles(root) {
  const output = [];
  function visit(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const absolute = join(dir, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && entry.name === "hooks.json") output.push(relative(root, absolute).replaceAll("\\", "/"));
    }
  }
  visit(join(root, "plugins/secretary"));
  return output.sort();
}
async function test(id, title, fn) {
  assert(expected.includes(id), `unexpected target ${id}`); assert(!results.some((entry) => entry.id === id), `duplicate target ${id}`);
  try { await fn(); results.push({ id, ok: true }); process.stdout.write(`PASS ${id} ${title}\n`); }
  catch (error) { results.push({ id, ok: false }); process.stdout.write(`FAIL ${id} ${title}: ${error?.stack || error}\n`); }
}

try {
  await test("CLX-001", "Clarity intentを選び既存用件を横取りしない", () => {
    const fixtures = [
      ["今、人間が考える必要があることを見せて", "clarity", "clarity-manual-entry"],
      ["Project Clarityを作って", "clarity", "clarity-manual-entry"],
      ["プロジェクトの状況を見せて", "projects", "project-lifecycle"],
      ["今日やることを整理して", "daily", "daily-existing-entry"],
      ["覚えておいて", "memory-care", "memory-explicit-entry"],
      ["最新版を確認して", "update", "update-read-only-diagnosis"],
      ["アプリを作って", "build", "harness-entry"],
      ["今日のProject Clarityの要確認をまとめて", "daily", "daily-existing-entry"],
      ["今週のProject Clarityを振り返って", "weekly", "weekly-existing-entry"],
      ["DecisionとExecutionの状態を見せて", "clarity", "clarity-manual-entry"],
      ["Validationが失敗している項目を見せて", "clarity", "clarity-manual-entry"],
      ["Driftを確認して", "clarity", "clarity-manual-entry"],
      ["Show Decision status", "clarity", "clarity-manual-entry"],
      ["Show Execution status", "clarity", "clarity-manual-entry"],
      ["Show failed Validation items", "clarity", "clarity-manual-entry"],
      ["Show Attention items", "clarity", "clarity-manual-entry"],
      ["Check Drift", "clarity", "clarity-manual-entry"],
      ["このClarity ItemをTODOにして", "projects", "local-todo-handoff"],
      ["このClarityの決定は覚えておいて", "memory-care", "clarity-reference-no-duplicate-memory"],
      ["Clarityの状況を使ってアプリを作って", "build", "harness-entry"],
      ["Clarity連携を含むagentic-secretaryの最新版を確認して", "update", "update-read-only-diagnosis"],
      ["Clarity付きプロジェクトを完了にして", "projects", "project-lifecycle"],
    ];
    for (const [input, skill, route] of fixtures) { const observed = routeSecretaryIntent(input); assert.equal(observed.selectedSkill, skill, input); assert.equal(observed.route, route, input); zeroEffect(observed); }
  });

  await test("CLX-002", "Project作成は既存確認境界を維持しClarityを無断初期化しない", () => {
    const root = secretary("clx002"); const before = tree(root);
    const noConfirm = run(process.execPath, [projectTool, "create-light", root, "新規案件", "--overview", "概要", "--goal", "完了", "--success", "確認", "--current", "開始", "--next", "確認"]);
    assert.equal(noConfirm.status, 3); assert.equal(tree(root), before);
    const folder = createProject(root, "新規案件"); assert(existsSync(join(folder, "PROJECT.md"))); assert.equal(existsSync(join(folder, "clarity")), false);
  });

  await test("CLX-003", "Project表示はbounded Clarity pointerを添え全Itemを埋め込まない", () => {
    const root = secretary("clx003"); const folder = createProject(root, "表示案件"); initClarity(root, "表示案件");
    const before = text(join(folder, "PROJECT.md")); const shown = run(process.execPath, [projectTool, "show", root, "表示案件"]);
    assert.equal(shown.status, 0); assert.match(shown.stdout, /mode: secretary-local/u); assert.match(shown.stdout, /Attention:/u); assert.match(shown.stdout, /link health:/u); assert.match(shown.stdout, /詳細:/u);
    assert.equal(text(join(folder, "PROJECT.md")), before); assert.equal(shown.stdout.includes("itemId"), false); assert.equal(shown.stdout.split(state(root, "表示案件").items[0].title).length - 1 <= 1, true);
  });

  await test("CLX-004", "完了でClarity ID／履歴を保持しclosed通常探索を維持", () => {
    const root = secretary("clx004"); createProject(root, "完了案件"); const initialized = initClarity(root, "完了案件"); const beforeEvents = events(root, "完了案件");
    const complete = run(process.execPath, [projectTool, "complete", root, "完了案件", "--result", "達成", "--remaining", "なし", "--confirm"]); assert.equal(complete.status, 0, complete.stderr);
    assert.equal(project(root, "完了案件", "closed").clarityProjectId, initialized.clarityProjectId); assert.equal(events(root, "完了案件", "closed"), beforeEvents);
    const portfolio = runJson(process.execPath, [claritySecretary, "portfolio", root, "--json"]); assert.equal(portfolio.projectCount, 0); assert.equal(JSON.stringify(portfolio).includes("完了案件"), false);
  });

  await test("CLX-005", "再開で既存Clarity ID／履歴を保持し再作成しない", () => {
    const root = secretary("clx005"); createProject(root, "再開案件"); const initialized = initClarity(root, "再開案件"); const beforeEvents = events(root, "再開案件");
    assert.equal(run(process.execPath, [projectTool, "complete", root, "再開案件", "--result", "一旦完了", "--remaining", "追加対応", "--confirm"]).status, 0);
    assert.equal(run(process.execPath, [projectTool, "reopen", root, "再開案件", "--reason", "追加対応", "--next", "確認", "--confirm"]).status, 0);
    assert.equal(project(root, "再開案件").clarityProjectId, initialized.clarityProjectId); assert.equal(events(root, "再開案件"), beforeEvents);
  });

  await test("CLX-006", "canonicalRepoはprojects正本のlink候補で相手Repo操作0", () => {
    const root = secretary("clx006"); const external = join(work, "external-canonical"); mkdirSync(external); writeFileSync(join(external, "canary"), "unchanged\n"); const externalBefore = tree(external);
    const created = run(process.execPath, [projectTool, "create-dev-pointer", root, "開発案件", "--repo", external, "--entry", "AGENTS.md", "--overview", "開発", "--current", "計画中", "--visibility", "private", "--confirm"]);
    assert.equal(created.status, 0, created.stderr); const body = text(join(root, "projects/open/開発案件/PROJECT.md")); assert(body.includes(external)); assert.equal(tree(external), externalBefore);
    const routed = routeSecretaryIntent("開発案件のcanonicalRepoを確認して"); assert.equal(routed.selectedSkill, "projects"); zeroEffect(routed);
  });

  await test("CLX-007", "dailyは予定／TODOと別の今日の要確認をbounded表示", () => {
    const routed = routeSecretaryIntent("今日のProject Clarityの要確認をまとめて"); assert.equal(routed.selectedSkill, "daily"); assert.equal(routed.route, "daily-existing-entry"); zeroEffect(routed);
    const root = secretary("clx007"); for (const name of ["A", "B", "C", "D"]) { createProject(root, name); initClarity(root, name); }
    const before = tree(root); const report = runJson(process.execPath, [claritySecretary, "daily", root, "--mode", "morning", "--json"]); assert.equal(tree(root), before);
    assert.equal(report.section, "今日の要確認"); assert(report.items.length <= 3); assert.equal(report.connectorReads, 0); assert.equal(report.itemBodiesIncluded, false);
    assert(report.items.every((item) => item.conclusion && item.reasonLabels.length && item.evidence.length && item.choices.length));
  });

  await test("CLX-008", "weeklyはjournal集計と別にAttention増減／Drift解消を集計", () => {
    const routed = routeSecretaryIntent("今週のProject Clarityを振り返って"); assert.equal(routed.selectedSkill, "weekly"); assert.equal(routed.route, "weekly-existing-entry"); zeroEffect(routed);
    const root = secretary("clx008"); createProject(root, "週次案件"); initClarity(root, "週次案件"); const journalBefore = text(join(root, "memory/journal/.gitkeep"));
    const report = runJson(process.execPath, [claritySecretary, "weekly", root, "--json"]); assert.equal(report.section, "Project Clarity"); assert.equal(report.attention.comparison, "前回集計なし"); assert(Array.isArray(report.longRunning)); assert.equal(report.connectorReads, 0); assert.equal(text(join(root, "memory/journal/.gitkeep")), journalBefore);
  });

  await test("CLX-009", "Notion Taskは明示時だけ既存downstream境界へ委譲", () => {
    const root = secretary("clx009"); createProject(root, "Notion境界"); initClarity(root, "Notion境界"); const id = state(root, "Notion境界").items[0].itemId; const before = tree(root);
    const implicit = runJson(process.execPath, [claritySecretary, "task-route", root, "Notion境界", "--item-id", id, "--target", "downstream-task", "--json"]); assert.equal(implicit.status, "not-routed"); assert.equal(tree(root), before);
    const routed = routeSecretaryIntent("このClarity ItemをNotionタスクにして"); assert.equal(routed.selectedSkill, "projects"); assert.equal(routed.route, "notion-task-not-included"); assert.equal(routed.delegation, "project-tools:add-todo-after-user-choice"); zeroEffect(routed);
    const explicit = runJson(process.execPath, [claritySecretary, "task-route", root, "Notion境界", "--item-id", id, "--target", "downstream-task", "--explicit", "--json"]); assert.equal(explicit.status, "fixed-handoff-required"); assert.equal(explicit.taskWrites, 0); assert.equal(tree(root), before);
  });

  await test("CLX-010", "local TODOは明示時だけ既存seamへ委譲", () => {
    const root = secretary("clx010"); createProject(root, "TODO境界"); initClarity(root, "TODO境界"); const id = state(root, "TODO境界").items[0].itemId; const todo = join(root, "inbox/todo.md"); const before = readFileSync(todo);
    const routed = routeSecretaryIntent("このClarity ItemをTODOにして"); assert.equal(routed.selectedSkill, "projects"); assert.equal(routed.route, "local-todo-handoff"); zeroEffect(routed);
    const explicit = runJson(process.execPath, [claritySecretary, "task-route", root, "TODO境界", "--item-id", id, "--target", "local-todo", "--explicit", "--json"]); assert.equal(explicit.route, "project-tools:add-todo"); assert.equal(explicit.taskWrites, 0); assert(readFileSync(todo).equals(before));
  });

  await test("CLX-011", "memory-careはProject Decision／Clarity Eventを二重保存せずHookへ意味判定を移さない", () => {
    const root = secretary("clx011"); createProject(root, "記憶境界"); initClarity(root, "記憶境界"); const before = tree(root); const routed = routeSecretaryIntent("このClarityの決定は覚えておいて");
    assert.equal(routed.selectedSkill, "memory-care"); assert.equal(routed.route, "clarity-reference-no-duplicate-memory"); zeroEffect(routed); assert.equal(tree(root), before);
    assert.match(text(join(repo, "plugins/secretary/skills/memory-care/SKILL.md")), /一般memoryへ複製しない/u);
  });

  await test("CLX-012", "buildはClarity contextでHarness正本を置換しない", () => {
    const routed = routeSecretaryIntent("Clarityの状況を使ってアプリを作って"); assert.equal(routed.selectedSkill, "build"); assert.equal(routed.route, "harness-entry"); zeroEffect(routed);
    const body = text(join(repo, "plugins/secretary/skills/build/SKILL.md")); for (const token of ["docs/spec/**", "docs/sprints/state.md", "Planner → Generator → Evaluator", "置き換えず"]) assert(body.includes(token), token);
  });

  await test("CLX-013", "updateはClarity Hook／毎sessionから起動せず自動更新しない", () => {
    const routed = routeSecretaryIntent("agentic-secretaryの最新版を確認して"); assert.equal(routed.selectedSkill, "update"); assert.equal(routed.route, "update-read-only-diagnosis"); zeroEffect(routed);
    const body = text(join(repo, "plugins/secretary/skills/update/SKILL.md")); assert.match(body, /毎session.*network/u); assert.match(body, /自動更新/u);
    const hooks = text(join(repo, "plugins/secretary/hooks/hooks.json")); assert.equal(/update-(?:apply|diagnose)|skills\/update/u.test(hooks), false);
  });

  await test("CLX-014", "onboarding／templatesはClarity optionalとedition Xmind defaultを説明", () => {
    const onboarding = text(join(repo, "plugins/secretary/skills/onboarding/SKILL.md")); const agents = text(join(repo, "plugins/secretary/templates/AGENTS.md")); const claude = text(join(repo, "plugins/secretary/templates/CLAUDE.md"));
    for (const body of [onboarding, agents, claude]) { assert.match(body, /Project Clarity.*任意|Clarity.*任意/u); assert.match(body, /Xmind integration既定はOFF/u); }
    const release = json(join(repo, "plugins/secretary/release-inventory.json")); const defaults = Object.fromEntries(release.xmind.editions.map((entry) => [entry.id, entry.defaultEnabled])); assert.deepEqual(defaults, { "agentic-secretary": false, "yasashii-secretary": false, "agentic-secretary-my-vault": true });
  });

  await test("CLX-015", "rules／serializerはboundedな結論→理由→根拠→選択を維持", () => {
    const common = text(join(repo, "plugins/secretary/rules/common-language.md")); const style = text(join(repo, "plugins/secretary/rules/styles/yasashii.md")); const manifest = json(join(repo, "plugins/secretary/rules/rule-manifest.json"));
    for (const token of ["3件", "結論→理由→根拠→選択", "推定", "未検証"]) assert(common.includes(token), token);
    assert(style.includes("最終応答serializer")); assert(style.includes("../common-language.md")); for (const token of ["clarityOwnership", "claritySideEffectBoundary", "xmindApprovalBoundary"]) assert(manifest.forbiddenStyleOverrides.includes(token));
  });

  await test("CLX-016", "host inventoryはsupported／verified／degraded／manual fallbackを分離", () => {
    const host = json(join(repo, "plugins/secretary/host-inventory.json")); assert.equal(host.collaborationInventory, "collaboration-inventory.json"); assert.equal(host.collaborationRouting.execution, "selection-only"); zeroEffect({ sideEffect: { performed: false, ...host.collaborationRouting.sideEffect } });
    for (const surface of [host.clarityHook.hosts.claudeCode.desktop, host.clarityHook.hosts.claudeCode.cli, host.clarityHook.hosts.codex.app, host.clarityHook.hosts.codex.cli]) assert.deepEqual([surface.supported, surface.verified, surface.degraded], [true, false, false]);
    for (const degraded of [host.clarityHook.hosts.claudeCode.disabled, host.clarityHook.hosts.codex.untrusted, host.clarityHook.hosts.codex.disabled]) assert.deepEqual([degraded.verified, degraded.degraded, degraded.canonicalWrite], [false, true, false]);
    assert(host.clarityHook.manualFallback.length > 0);
  });

  await test("CLX-017", "edition handoffはcommon／protectedを分離しdownstream writeを閉じる", () => {
    const release = json(join(repo, "plugins/secretary/release-inventory.json")); const receipt = json(join(repo, "scripts/fixtures/sprint-041/yasashii-prewrite-receipt.json"));
    assert.equal(release.collaborationMarker, "yasashii-secretary:clarity-collaboration:release:v1"); assert.equal(release.fixedSource.publicEvaluatorPass, false); assert.equal(release.publicationStatus, "candidate-unverified");
    assert.equal(receipt.authorization.writesAuthorized, false); assert.equal(receipt.authorization.releaseAuthorized, false); assert.equal(receipt.authorization.nextScope.operation, "yasashii-product-apply-only");
  });

  await test("CLX-018", "Clarityからconnectorを暗黙実行せず明示serviceだけ既存入口へroute", () => {
    const clarityOnly = routeSecretaryIntent("Clarity Itemを見せて"); assert.equal(clarityOnly.selectedSkill, "clarity"); zeroEffect(clarityOnly);
    const clarityFixtures = [
      "Chatwork連携のClarity Itemを見せて",
      "Google Chat連携のクラリティを確認して",
      "Googleカレンダー連携について今、人間が考える必要があることを見せて",
    ];
    for (const input of clarityFixtures) { const routed = routeSecretaryIntent(input); assert.equal(routed.selectedSkill, "clarity", input); assert.equal(routed.route, "clarity-manual-entry", input); zeroEffect(routed); }
    const fixtures = [
      ["Chatworkで探して", "chatwork"], ["Chatworkにつないで", "chatwork"], ["Chatworkと連携して", "chatwork"],
      ["Google Chatにつないで", "google-chat"], ["Google Chatで探して", "google-chat"],
      ["Googleカレンダーを見て", "setup-google"], ["Google Driveからファイルを取得して", "setup-google"], ["Gmailを設定して", "setup-google"], ["Googleカレンダーと連携して", "setup-google"],
      ["Outlookにつないで", "setup-microsoft"], ["Microsoft 365を設定して", "setup-microsoft"],
      ["Notionにつないで", "setup-notion"], ["Notionを設定して", "setup-notion"],
    ];
    for (const [input, skill] of fixtures) { const routed = routeSecretaryIntent(input); assert.equal(routed.selectedSkill, skill, input); assert.equal(routed.delegation, "existing-explicit-connector-entry"); zeroEffect(routed); }
    const connectorPaths = ["chatwork", "google-chat", "connections", "setup-google", "setup-microsoft", "setup-notion"];
    for (const skill of connectorPaths) assert(text(join(repo, `plugins/secretary/skills/${skill}/SKILL.md`)).includes("yasashii-secretary:clarity-collaboration:connector:v1"));
  });

  await test("CLX-019", "Clarity専用Hook 1組以外0、memory意味判定／network／update 0", () => {
    assert.deepEqual(hookFiles(repo), ["plugins/secretary/hooks/hooks.json"]); const hooks = json(join(repo, "plugins/secretary/hooks/hooks.json"));
    const commands = Object.values(hooks.hooks).flat().flatMap((entry) => entry.hooks || []).map((entry) => entry.command); assert(commands.length > 0); assert(commands.every((command) => command.includes("scripts/clarity-hook.mjs")));
    const sources = ["plugins/secretary/scripts/clarity-hook.mjs", "plugins/secretary/scripts/lib/clarity-hook.mjs", "plugins/secretary/hooks/hooks.json"].map((path) => text(join(repo, path))).join("\n");
    for (const forbidden of [/memory-tools|save-memory|remember-decision|topic-add/u, /node:https|node:http|\bfetch\s*\(/u, /update-apply|update-diagnose/u, /chatwork|google-chat|setup-notion/u, /xmind/u]) assert.equal(forbidden.test(sources), false, String(forbidden));
  });

  await test("CLX-020", "tracked inventoryは実path／marker／digest／testと双方向一致し負例を拒否", () => {
    const inventory = loadCollaborationInventory(repo); const valid = validateCollaborationInventory(repo, inventory); assert.deepEqual(valid, { surfaceCount: 17, caseCount: 20, digestsValid: true, markersValid: true });
    const omitted = structuredClone(inventory); omitted.surfaces.pop(); expectFailure(() => validateCollaborationInventory(repo, omitted), "inventory-surface-omission-or-extra");
    const stale = structuredClone(inventory); stale.surfaces[0].contentDigest = "0".repeat(64); expectFailure(() => validateCollaborationInventory(repo, stale), "inventory-digest-stale");
    const marker = structuredClone(inventory); marker.surfaces[0].markers[0].token = "missing-marker"; expectFailure(() => validateCollaborationInventory(repo, marker), "inventory-marker-stale");

    const fixture = join(work, "inventory-negative"); cpSync(repo, fixture, { recursive: true, filter: (source) => { const rel = relative(repo, source).replaceAll("\\", "/"); return rel !== ".git" && !rel.startsWith(".git/"); } });
    let candidate = loadCollaborationInventory(fixture); const routerPath = join(fixture, "plugins/secretary/scripts/lib/collaboration-router.mjs"); writeFileSync(routerPath, `${text(routerPath)}\n// topic-save=confirm-first\n`); refreshSurface(fixture, candidate, "secretary-router"); expectFailure(() => validateCollaborationInventory(fixture, candidate), "inventory-old-contract");
    writeFileSync(routerPath, text(join(repo, "plugins/secretary/scripts/lib/collaboration-router.mjs")) + "\n// vault/10_sources\n"); candidate = loadCollaborationInventory(fixture); refreshSurface(fixture, candidate, "secretary-router"); expectFailure(() => validateCollaborationInventory(fixture, candidate), "inventory-private-literal");

    const release = json(join(repo, "plugins/secretary/release-inventory.json")); const receipt = json(join(repo, "scripts/fixtures/sprint-041/yasashii-prewrite-receipt.json")); assert.equal(release.collaborationInventory, "plugins/secretary/collaboration-inventory.json");
    assert.deepEqual(release.xmind.providers.map((entry) => entry.id), ["xmind-mcp", "local-native"]); assert.equal(release.xmind.providers[1].explicitApprovalRequired, true); assert.equal(release.xmind.providers[1].writeWithoutApproval, false);
    assert.equal(receipt.authorization.releaseAuthorized, false); assert.equal(receipt.authorization.publicPatchAuthorized, false);
  });

  const actual = results.map((entry) => entry.id); const failed = results.filter((entry) => !entry.ok); const missing = expected.filter((id) => !actual.includes(id)); const extra = actual.filter((id) => !expected.includes(id)); const duplicate = actual.filter((id, index) => actual.indexOf(id) !== index);
  assert.deepEqual({ missing, extra, duplicate }, { missing: [], extra: [], duplicate: [] }); assert.equal(results.length, 20); assert.equal(failed.length, 0, `failed targets: ${failed.map((entry) => entry.id).join(",")}`);
  assert.equal(results.filter((entry) => critical.has(entry.id) && entry.ok).length, critical.size);
  process.stdout.write(`SPRINT049_PASS=20 FAIL=0 REGISTRY_MISSING=0 REGISTRY_DUPLICATE=0 REGISTRY_EXTRA=0 CRITICAL_PASS=${critical.size} CRITICAL_NOT_RUN=0 AC_EXECUTED=6 AC_NOT_RUN=0 SIDE_EFFECT_VIOLATIONS=0\n`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
