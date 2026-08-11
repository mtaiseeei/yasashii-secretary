#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const MEMORY = join(ROOT, "plugins/secretary/skills/memory-care/scripts/memory-tools.mjs");
const WORKSPACE = join(ROOT, "plugins/secretary/scripts/workspace-tools.mjs");
const PROJECT = join(ROOT, "plugins/secretary/scripts/project-tools.mjs");
const requireWindows = process.argv.includes("--require-windows");
let pass = 0;
let fail = 0;

function check(label, action) {
  try { action(); pass += 1; console.log(`PASS ${label}`); }
  catch (error) { fail += 1; console.error(`FAIL ${label}: ${error.message}`); }
}

function run(script, args, { input = "", env = {}, expected = 0 } = {}) {
  const result = spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8", input, env: { ...process.env, CC_SECRETARY_NOW: "2026-08-10T14:20:00+09:00", ...env }, shell: false,
  });
  assert.equal(result.status, expected, `${script} ${args.join(" ")}\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  return result;
}

function count(path, pattern) { return (readFileSync(path, "utf8").match(pattern) || []).length; }
function digest(path) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }
function fixtureEntries(path) {
  return readdirSync(path, { withFileTypes: true }).sort((a, b) => (a.name === b.name ? 0 : a.name < b.name ? -1 : 1));
}

function copyFixtureTree(source, destination) {
  mkdirSync(destination, { recursive: true });
  for (const entry of fixtureEntries(source)) {
    const sourcePath = join(source, entry.name);
    const destinationPath = join(destination, entry.name);
    if (entry.isDirectory()) copyFixtureTree(sourcePath, destinationPath);
    else if (entry.isFile()) copyFileSync(sourcePath, destinationPath);
    else throw new Error(`unsupported fixture entry: ${sourcePath}`);
  }
}

function fixtureSnapshot(root, relative = "") {
  const snapshot = [];
  for (const entry of fixtureEntries(join(root, relative))) {
    const entryRelative = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      snapshot.push(`directory:${entryRelative}`);
      snapshot.push(...fixtureSnapshot(root, entryRelative));
    } else if (entry.isFile()) snapshot.push(`file:${entryRelative}:${digest(join(root, entryRelative))}`);
    else snapshot.push(`other:${entryRelative}`);
  }
  return snapshot;
}

const sandbox = mkdtempSync(join(tmpdir(), "agentic secretary Windows 日本語-"));
const secretary = join(sandbox, "secretary");
try {
  const templates = join(ROOT, "plugins/secretary/templates");
  copyFixtureTree(templates, secretary);

  check("native OS metadata", () => {
    console.log(`OS=${process.platform} arch=${process.arch} node=${process.version} workspace=${secretary}`);
    if (requireWindows) assert.equal(process.platform, "win32", "Windowsネイティブrunnerではありません");
    if (process.platform === "win32") assert.match(secretary, /^[A-Za-z]:\\/u);
    assert.match(secretary, /Windows 日本語/u);
    assert.deepEqual(fixtureSnapshot(secretary), fixtureSnapshot(templates));
  });

  const placeholder = join(secretary, "memory/decisions/_first-decision.md");
  if (existsSync(placeholder)) renameSync(placeholder, join(secretary, "memory/decisions/2026-07-08-decisions.md"));

  check("project create and journal are one operation", () => {
    run(PROJECT, ["create-light", secretary, "顧客まとめ", "--overview", "複数文書の整理", "--goal", "まとめ文書", "--success", "たたき台完成", "--current", "資料確認済み", "--next", "構成を整える", "--confirm"]);
    const project = join(secretary, "projects/open/顧客まとめ/PROJECT.md");
    const journal = join(secretary, "memory/journal/2026-08-10.md");
    assert.ok(existsSync(project)); assert.equal(count(journal, /プロジェクト「顧客まとめ」をライト運用で作成/gu), 1);
  });

  check("project decision, TODO and deliverables use Node-native boundary", () => {
    const existingDirectory = join(secretary, "projects/open/顧客まとめ/作業 資料/日本語");
    const existingFile = join(existingDirectory, "既存ファイル.txt");
    mkdirSync(existingDirectory, { recursive: true });
    writeFileSync(existingFile, "transaction前からある内容\n", "utf8");
    const existingDigest = digest(existingFile);
    run(PROJECT, ["add-decision", secretary, "顧客まとめ", "--decision", "章立てを3部にする", "--current", "章立て確定", "--next", "本文作成", "--confirm"]);
    assert.equal(digest(existingFile), existingDigest, "project transactionのfile-by-file stage copyで既存treeを保持する");
    run(PROJECT, ["add-note", secretary, "顧客まとめ", "--note", "一次資料は3文書", "--confirm"]);
    run(PROJECT, ["promote-full", secretary, "顧客まとめ", "--hard-to-read", "--confirm"]);
    run(PROJECT, ["add-decision", secretary, "顧客まとめ", "--decision", "要約を先頭に置く", "--current", "本文確認中", "--next", "確定版を作る", "--confirm"]);
    run(PROJECT, ["add-todo", secretary, "顧客まとめ", "--todo", "本文を確認", "--source", "利用者依頼 | local-1 | 2026-08-10"]);
    run(PROJECT, ["save-work", secretary, "顧客まとめ", "--title", "構成案"], { input: "作業中の本文\n" });
    run(PROJECT, ["archive-file", secretary, "顧客まとめ", "2026-08-10_構成案.md", "--confirm"]);
    run(PROJECT, ["save-output", secretary, "顧客まとめ", "--title", "まとめ文書"], { input: "確定本文\n" });
    run(PROJECT, ["complete", secretary, "顧客まとめ", "--result", "たたき台完成", "--remaining", "利用者確認", "--confirm"]);
    run(PROJECT, ["reopen", secretary, "顧客まとめ", "--reason", "修正依頼", "--next", "指摘を反映", "--confirm"]);
    run(PROJECT, ["create-dev-pointer", secretary, "Windows連携開発", "--repo", "C:/workspace/source", "--entry", "README.md", "--overview", "参照だけを置く", "--current", "調査中", "--visibility", "private", "--confirm"]);
    assert.match(readFileSync(join(secretary, "inbox/todo.md"), "utf8"), /PJ: 顧客まとめ/u);
    assert.ok(existsSync(join(secretary, "projects/open/顧客まとめ/AGENTS.md")));
    assert.ok(existsSync(join(secretary, "projects/open/顧客まとめ/archive/2026-08-10_構成案.md")));
    assert.ok(existsSync(join(secretary, "projects/open/顧客まとめ/outputs/2026-08-10_まとめ文書.md")));
    assert.ok(existsSync(join(secretary, "projects/open/Windows連携開発/PROJECT.md")));
  });

  check("memory, settings, standalone document and retry are idempotent", () => {
    const preferences = join(secretary, "memory/preferences.md");
    const preferenceBefore = `${readFileSync(preferences, "utf8").trimEnd()}\n- 手書きメモ: CRLFでも保持する\n`.replace(/\r?\n/gu, "\r\n");
    writeFileSync(preferences, preferenceBefore, "utf8");
    run(MEMORY, ["remember-decision", secretary, "2026-08-10", "WindowsでもNode.js境界を使う"]);
    run(MEMORY, ["remember-decision", secretary, "2026-08-10", "WindowsでもNode.js境界を使う"]);
    run(MEMORY, ["topic-add", secretary, "Windows確認", "空白と日本語pathで成功"]);
    run(MEMORY, ["pref-set", secretary, "言葉遣い", "報告の詳しさ", "くわしく"]);
    run(WORKSPACE, ["todo-add", secretary, "回帰を確認", "local | windows-1 | 2026-08-10"]);
    run(WORKSPACE, ["todo-add", secretary, "回帰を確認", "local | windows-1 | 2026-08-10"]);
    run(WORKSPACE, ["todo-add", secretary, "翌日に持ち越す", "local | windows-2 | 2026-08-10"]);
    run(WORKSPACE, ["save-deliverable", secretary, "2026-08-10", "Windows 保存", "Windows,回帰"], { input: "本文\n" });
    run(WORKSPACE, ["save-deliverable", secretary, "2026-08-10", "Windows 保存", "Windows,回帰"], { input: "本文\n" });
    run(WORKSPACE, ["todo-list", secretary]);
    run(WORKSPACE, ["todo-done", secretary, "2", "--confirm"]);
    run(WORKSPACE, ["todo-carry", secretary, "2", "2026-08-11", "--confirm"]);
    const decision = join(secretary, "memory/decisions/2026-08-10-decisions.md");
    const todo = join(secretary, "inbox/todo.md");
    assert.equal(count(decision, /WindowsでもNode\.js境界を使う/gu), 1);
    assert.equal(count(todo, /回帰を確認/gu), 1);
    assert.match(readFileSync(todo, "utf8"), /完了: 2026-08-10/u);
    assert.match(readFileSync(todo, "utf8"), /繰越: 2026-08-11/u);
    const preferenceAfter = readFileSync(preferences, "utf8");
    assert.equal((preferenceAfter.match(/^## 言葉遣い\r?$/gmu) || []).length, 1);
    assert.match(preferenceAfter, /- 報告の詳しさ: くわしく\r?$/mu);
    assert.match(preferenceAfter, /- 手書きメモ: CRLFでも保持する\r?$/mu);
    assert.doesNotMatch(preferenceAfter, /(^|[^\r])\n/u, "CRLF preferencesへLFを混在させない");
  });

  check("timeline, weekly, archive, reindex and resume use the native boundary", () => {
    run(MEMORY, ["journal-add", secretary, "did", "7月の確認"], { env: { CC_SECRETARY_NOW: "2026-07-10T10:00:00+09:00" } });
    assert.match(run(MEMORY, ["timeline", secretary, "--from", "2026-07-01", "--to", "2026-08-10", "--type", "all"]).stdout, /7月の確認/u);
    assert.match(run(MEMORY, ["weekly", secretary, "--week", "2026-08-10"]).stdout, /週次ふりかえり/u);
    assert.match(run(MEMORY, ["archive-plan", secretary, "2026-07"]).stdout, /2026-07/u);
    run(MEMORY, ["archive-month", secretary, "2026-07", "--confirm"]);
    assert.ok(existsSync(join(secretary, "memory/archive/journal/2026-07/2026-07-10.md")));
    run(MEMORY, ["reindex", secretary]);
    run(MEMORY, ["resume-write", secretary, "Windows確認", "回帰を実行", "なし"]);
    assert.match(run(MEMORY, ["resume-read", secretary]).stdout, /Windows確認/u);
    run(MEMORY, ["resume-check", secretary]);
    run(MEMORY, ["resume-clear", secretary]);
    run(MEMORY, ["resume-check", secretary], { expected: 1 });
  });

  check("protected memory update and two-step delete keep their contract", () => {
    run(MEMORY, ["pref-note-add", secretary, "Windowsでも同じ保存境界"]);
    const preferences = readFileSync(join(secretary, "memory/preferences.md"), "utf8");
    assert.equal((preferences.match(/^## 秘書のメモ\r?$/gmu) || []).length, 1);
    assert.match(preferences, /- Windowsでも同じ保存境界\r?$/mu);
    assert.match(preferences, /- 手書きメモ: CRLFでも保持する\r?$/mu);
    assert.doesNotMatch(preferences, /(^|[^\r])\n/u, "pref-note-addもCRLFを維持する");
    run(MEMORY, ["guarded-write", secretary, "topics/delete-me.md"], { input: "削除確認用\n" });
    run(MEMORY, ["delete", secretary, "topics/delete-me.md"], { expected: 3 });
    assert.ok(existsSync(join(secretary, "memory/topics/delete-me.md")));
    run(MEMORY, ["delete", secretary, "topics/delete-me.md", "--confirm"]);
    assert.ok(!existsSync(join(secretary, "memory/topics/delete-me.md")));
    const deleteTree = join(secretary, "memory/topics/削除 tree/入れ子");
    mkdirSync(deleteTree, { recursive: true }); writeFileSync(join(deleteTree, "記録.md"), "削除確認用\n");
    run(MEMORY, ["delete", secretary, "topics/削除 tree", "--confirm"]);
    assert.ok(!existsSync(join(secretary, "memory/topics/削除 tree")));
  });

  check("journal failure rolls project creation back", () => {
    const journal = join(secretary, "memory/journal/2026-08-10.md"); const before = digest(journal);
    run(PROJECT, ["create-light", secretary, "失敗注入", "--overview", "rollback確認", "--goal", "残さない", "--success", "副作用0", "--current", "開始", "--next", "停止", "--confirm"], { env: { CC_SECRETARY_FAIL_AT: "journal-after-write" }, expected: 3 });
    assert.ok(!existsSync(join(secretary, "projects/open/失敗注入"))); assert.equal(digest(journal), before);
    const project = join(secretary, "projects/open/顧客まとめ/PROJECT.md");
    const decisions = join(secretary, "projects/open/顧客まとめ/DECISIONS.md");
    const nested = join(secretary, "projects/open/顧客まとめ/作業 資料/日本語/既存ファイル.txt");
    const updateBefore = [digest(project), digest(decisions), digest(nested), digest(journal)];
    run(PROJECT, ["add-decision", secretary, "顧客まとめ", "--decision", "rollbackで残らない", "--current", "rollback確認", "--next", "開始前へ戻す", "--confirm"], { env: { CC_SECRETARY_FAIL_AT: "journal-after-write" }, expected: 3 });
    assert.deepEqual([digest(project), digest(decisions), digest(nested), digest(journal)], updateBefore);
    assert.doesNotMatch(readFileSync(project, "utf8"), /rollbackで残らない/u);
  });

  check("TODO failure rolls main file and journal back", () => {
    const todo = join(secretary, "inbox/todo.md"), journal = join(secretary, "memory/journal/2026-08-10.md"); const before = [digest(todo), digest(journal)];
    run(WORKSPACE, ["todo-add", secretary, "残らないTODO", "local | fail | 2026-08-10"], { env: { CC_SECRETARY_FAIL_AT: "todo-before-journal" }, expected: 3 });
    assert.deepEqual([digest(todo), digest(journal)], before);
  });

  check("decision, settings and document failures restore every touched file", () => {
    const journal = join(secretary, "memory/journal/2026-08-10.md");
    const index = join(secretary, "memory/MEMORY.md");
    const preferences = join(secretary, "memory/preferences.md");
    const beforeDecision = [digest(journal), digest(index)];
    run(MEMORY, ["remember-decision", secretary, "2026-08-10", "残らない決定"], { env: { CC_SECRETARY_FAIL_AT: "decision-before-journal" }, expected: 3 });
    assert.deepEqual([digest(journal), digest(index)], beforeDecision);
    assert.doesNotMatch(readFileSync(join(secretary, "memory/decisions/2026-08-10-decisions.md"), "utf8"), /残らない決定/u);
    const beforePreference = [digest(preferences), digest(index)];
    run(MEMORY, ["pref-set", secretary, "言葉遣い", "報告の詳しさ", "みじかく"], { env: { CC_SECRETARY_FAIL_AT: "pref-before-index" }, expected: 3 });
    assert.deepEqual([digest(preferences), digest(index)], beforePreference);
    const beforeDocument = [digest(journal), digest(index)];
    run(WORKSPACE, ["save-deliverable", secretary, "2026-08-10", "残らない文書", "失敗注入"], { input: "残らない本文\n", env: { CC_SECRETARY_FAIL_AT: "deliverable-before-journal" }, expected: 3 });
    assert.ok(!existsSync(join(secretary, "docs/2026/08/2026-08-10_残らない文書.md")));
    assert.deepEqual([digest(journal), digest(index)], beforeDocument);
  });

  check("traversal and prefix sibling are rejected", () => {
    run(MEMORY, ["guarded-write", secretary, "../outside.md"], { input: "拒否", expected: 3 });
    const sibling = `${secretary}-other`; mkdirSync(sibling); const canary = join(sibling, "canary.txt"); writeFileSync(canary, "unchanged");
    run(MEMORY, ["guarded-write", secretary, `../../${sibling.slice(dirname(sibling).length + 1)}/canary.txt`], { input: "拒否", expected: 3 });
    assert.equal(readFileSync(canary, "utf8"), "unchanged");
    if (process.platform === "win32") run(MEMORY, ["journal-add", dirname(secretary).slice(0, 3), "did", "drive rootを拒否"], { expected: 3 });
  });

  check("external symlink or junction is rejected with zero outside writes", () => {
    const external = join(sandbox, "external"); mkdirSync(external); const canary = join(external, "canary.txt"); writeFileSync(canary, "unchanged");
    const linkedRoot = join(sandbox, "linked-secretary"); symlinkSync(secretary, linkedRoot, process.platform === "win32" ? "junction" : "dir");
    run(MEMORY, ["journal-add", linkedRoot, "did", "外へ書かない"], { expected: 3 });
    const nestedLink = join(secretary, "memory/topics/external-link"); symlinkSync(external, nestedLink, process.platform === "win32" ? "junction" : "dir");
    run(MEMORY, ["guarded-write", secretary, "topics/external-link/out.md"], { input: "外へ書かない", expected: 3 });
    assert.ok(!existsSync(join(external, "out.md")));
    assert.equal(readFileSync(canary, "utf8"), "unchanged");
  });

  check("no Bash dependency in native entrypoints", () => {
    for (const path of [MEMORY, WORKSPACE, PROJECT, join(ROOT, "plugins/secretary/scripts/owner-name-transaction.mjs")]) {
      assert.doesNotMatch(readFileSync(path, "utf8"), /runExternalSync\(["']bash["']|spawnSync\(["']bash["']/u);
    }
    assert.doesNotMatch(readFileSync(PROJECT, "utf8"), /cpSync\([^\n]*recursive:\s*true/u);
    assert.doesNotMatch(readFileSync(MEMORY, "utf8"), /cpSync\([^\n]*recursive:\s*true/u);
  });
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}

console.log(`SPRINT038_PATCH002_WINDOWS_PASS=${pass} FAIL=${fail} OS=${process.platform}`);
process.exitCode = fail ? 1 : 0;
