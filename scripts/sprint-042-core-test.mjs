#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  ClarityError,
  appendEvidence,
  appendEvent,
  applyInit,
  decideGenericProject,
  doctor,
  history,
  previewInit,
  rebuildState,
  scanRepository,
  status,
} from "../plugins/secretary/scripts/lib/clarity-core.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const clarityCli = join(repo, "plugins/secretary/scripts/clarity.mjs");
const projectTool = join(repo, "plugins/secretary/scripts/project-tools.mjs");
const work = mkdtempSync(join(tmpdir(), "agentic-s041-"));
const fixedNow = "2026-08-28T10:30:00.000Z";
process.env.CLARITY_NOW = fixedNow;
process.env.CC_SECRETARY_NOW = fixedNow;

const expected = [
  ...Array.from({ length: 15 }, (_, index) => `ST-${String(index + 1).padStart(3, "0")}`),
  ...Array.from({ length: 14 }, (_, index) => `QM-${String(index + 1).padStart(3, "0")}`),
  ...Array.from({ length: 14 }, (_, index) => `DE-${String(index + 1).padStart(3, "0")}`),
];
const results = [];

function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function write(path, value) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); }
function json(path) { return JSON.parse(readFileSync(path, "utf8")); }
function lines(path) { return readFileSync(path, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse); }
function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: "utf8", timeout: 30_000, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, ...(options.env || {}) }, cwd: options.cwd || repo });
}
function tree(root, { git = false } = {}) {
  const rows = [];
  function visit(dir) {
    for (const name of readdirSync(dir).sort()) {
      if (!git && name === ".git") continue;
      const path = join(dir, name); const rel = path.slice(root.length + 1); const stat = lstatSync(path);
      if (stat.isSymbolicLink()) rows.push([rel, "link", readlinkSync(path)]);
      else if (stat.isDirectory()) { rows.push([rel, "dir"]); visit(path); }
      else rows.push([rel, "file", sha(readFileSync(path))]);
    }
  }
  visit(root); return sha(JSON.stringify(rows));
}
function fixture(name, files = { "README.md": `# ${name}\n` }) {
  const root = join(work, name); mkdirSync(root, { recursive: true });
  for (const [path, value] of Object.entries(files)) write(join(root, path), value);
  return root;
}
function initialized(name, files) { const root = fixture(name, files); applyInit(root); return root; }
function item(root) { return json(join(root, ".clarity/state.json")).items[0]; }
function event(root, type, payload, actor = "human-user") {
  return appendEvent(root, { type, itemId: item(root).itemId, actor, payload });
}
function expectCode(fn, code) {
  let caught; try { fn(); } catch (error) { caught = error; }
  assert(caught instanceof ClarityError); assert.equal(caught.code, code); return caught;
}
async function test(id, title, fn) {
  assert(expected.includes(id), `unknown case: ${id}`);
  assert(!results.some((row) => row.id === id), `duplicate case: ${id}`);
  try { await fn(); results.push({ id, title, ok: true }); process.stdout.write(`PASS ${id} ${title}\n`); }
  catch (error) { results.push({ id, title, ok: false, error }); process.stdout.write(`FAIL ${id} ${title}: ${error?.message || error}\n`); }
}
function cloneFixture(name) {
  const target = join(work, name);
  if (existsSync(join(repo, ".git"))) {
    const cloned = run("git", ["clone", "--quiet", "--no-hardlinks", repo, target]);
    assert.equal(cloned.status, 0, cloned.stderr);
    assert.equal(run("git", ["-C", target, "remote", "remove", "origin"]).status, 0);
  } else {
    cpSync(repo, target, { recursive: true });
    assert.equal(run("git", ["init", "-q", "-b", "main"], { cwd: target }).status, 0);
    const env = { GIT_AUTHOR_NAME: "Sprint 041", GIT_AUTHOR_EMAIL: "s041@example.invalid", GIT_COMMITTER_NAME: "Sprint 041", GIT_COMMITTER_EMAIL: "s041@example.invalid" };
    assert.equal(run("git", ["add", "."], { cwd: target, env }).status, 0);
    assert.equal(run("git", ["commit", "-qm", "Git-free archive fixture"], { cwd: target, env }).status, 0);
  }
  return target;
}
function secretaryProject(name) {
  const secretary = fixture(`${name}-secretary`, {
    "memory/MEMORY.md": "# Memory\n",
    "inbox/todo.md": "# TODO（クイックキャプチャ）\n",
  });
  for (const rel of ["memory/decisions", "memory/journal", "memory/topics", "projects/open", "docs"]) mkdirSync(join(secretary, rel), { recursive: true });
  const projectName = `PJ-${name}`;
  const made = run(process.execPath, [projectTool, "create-light", secretary, projectName, "--overview", "既存案件の概要", "--goal", "合意した成果を得る", "--success", "完了条件を満たす", "--current", "確認中", "--next", "次の確認を行う", "--questions", "残る判断", "--confirm"]);
  assert.equal(made.status, 0, made.stderr);
  const root = join(secretary, "projects/open", projectName); applyInit(root);
  return { secretary, projectName, root };
}
function countText(root, needle) {
  let count = 0;
  function visit(dir) { for (const name of readdirSync(dir)) { const path = join(dir, name); const stat = lstatSync(path); if (stat.isDirectory()) visit(path); else if (stat.isFile()) count += readFileSync(path, "utf8").split(needle).length - 1; } }
  visit(root); return count;
}

try {
  const gitRoot = cloneFixture("git-no-remote");

  await test("ST-001", "init default is read-only preview", () => {
    const before = tree(gitRoot); const gitBefore = run("git", ["-C", gitRoot, "status", "--porcelain=v1"]).stdout;
    const preview = previewInit(gitRoot);
    assert.equal(preview.action, "initialize"); assert.equal(tree(gitRoot), before);
    assert.equal(run("git", ["-C", gitRoot, "status", "--porcelain=v1"]).stdout, gitBefore);
  });
  await test("ST-002", "preview and cancel keep zero writes", () => {
    const before = tree(gitRoot);
    const result = run(process.execPath, [clarityCli, "init", gitRoot, "--cancel", "--json"]);
    assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).status, "canceled"); assert.equal(tree(gitRoot), before);
  });
  await test("ST-003", "apply creates canonical data from the real repository", () => {
    const root = fixture("st003", { "README.md": "# 顧客管理改善\n\n進行中の案件。\n", "src/index.js": "export const ready = true;\n" }); const applied = run(process.execPath, [clarityCli, "init", root, "--apply", "--json"]); assert.equal(applied.status, 0, applied.stderr); assert.equal(JSON.parse(applied.stdout).status, "initialized");
    for (const path of ["project.json", "events.jsonl", "evidence.jsonl", "state.json"]) assert(existsSync(join(root, ".clarity", path)));
    assert(item(root).areaPath); assert.notEqual(item(root).title, "Item 1"); for (const command of ["status", "history", "rebuild"]) { const result = run(process.execPath, [clarityCli, command, root, "--json"]); assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).ok, true); }
  });
  await test("ST-004", "Git repository without remote is diagnosed safely", () => {
    const preview = previewInit(gitRoot); assert.equal(preview.project.repoIdentity.kind, "git"); assert.equal(preview.project.repoIdentity.remote.status, "missing"); applyInit(gitRoot); assert.equal(doctor(gitRoot).remoteStatus, "missing");
  });
  await test("ST-005", "non-Git repository initializes standalone", () => {
    const root = initialized("st005"); assert.equal(json(join(root, ".clarity/project.json")).repoIdentity.kind, "non-git"); assert.equal(status(root).mode, "standalone");
  });
  await test("ST-006", "bounded scan reports what was not inspected", () => {
    const files = { "README.md": "# Large\n" }; for (let i = 0; i < 650; i += 1) files[`bulk/f-${String(i).padStart(4, "0")}.txt`] = `row ${i}\n`;
    const started = performance.now(); const report = scanRepository(fixture("st006", files)); const elapsedMs = performance.now() - started; assert.equal(report.truncated, true); assert(report.entriesSeen <= report.limits.maxEntries); assert(report.uninspected.some((row) => row.reason === "scan-limit-reached")); assert(elapsedMs < 5_000);
  });
  await test("ST-007", "Secret-looking files and values never enter canonical data", () => {
    const marker = "api_key=not-a-real-but-sensitive-value"; const root = fixture("st007", { "README.md": "# Safe\n", ".env": marker, "credentials.txt": marker, "notes.txt": marker });
    const preview = previewInit(root); assert(preview.excluded.some((row) => row.path === ".env")); assert(preview.excluded.some((row) => row.path === "notes.txt" && row.reason === "secret-like-content")); assert(!JSON.stringify(preview).includes(marker)); applyInit(root); assert(!readFileSync(join(root, ".clarity/events.jsonl"), "utf8").includes(marker));
  });
  await test("ST-008", "symlinks are excluded and not followed", () => {
    const outside = fixture("st008-outside", { "private.txt": "outside-marker-041" }); const root = fixture("st008", { "README.md": "# Safe\n" }); symlinkSync(outside, join(root, "linked"));
    const preview = previewInit(root); assert(preview.excluded.some((row) => row.path === "linked" && row.reason === "symlink-not-followed")); assert(!JSON.stringify(preview).includes("outside-marker-041"));
  });
  await test("ST-009", "existing unmanaged CLARITY file is preserved", () => {
    const original = "# Team-owned Clarity\nDo not overwrite.\n"; const root = fixture("st009", { "README.md": "# Work\n", "CLARITY.md": original }); const preview = previewInit(root); assert(preview.conflicts.some((row) => row.path === "CLARITY.md")); const result = applyInit(root);
    assert.equal(result.status, "initialized-with-root-entry-conflict"); assert.equal(readFileSync(join(root, "CLARITY.md"), "utf8"), original); assert.equal(json(join(root, ".clarity/project.json")).rootEntry.status, "external-conflict");
  });
  await test("ST-010", "accepted ADR is reused as confirmation evidence", () => {
    const adr = "# ADR 1\n\nStatus: Accepted\n\nUse SQLite.\n"; const root = initialized("st010", { "README.md": "# Existing\n", "docs/adr/0001-storage.md": adr });
    const selected = json(join(root, ".clarity/state.json")).items.find((row) => row.areaPath.includes("0001-storage")); assert.equal(selected.decision.status, "confirmed"); assert.equal(readFileSync(join(root, "docs/adr/0001-storage.md"), "utf8"), adr); assert(!existsSync(join(root, "DECISIONS.md")));
  });
  await test("ST-011", "spec alone remains proposed", () => {
    const root = initialized("st011", { "docs/spec/payment.md": "# Payment spec\n\nDraft behavior.\n" }); assert.equal(item(root).decision.status, "proposed"); assert.equal(item(root).decision.humanConfirmed, false);
  });
  await test("ST-012", "accepted ADR becomes confirmed with ADR Evidence", () => {
    const root = initialized("st012", { "docs/adr/0002-api.md": "# API\n\nstatus: accepted\n" }); assert.equal(item(root).decision.status, "confirmed"); assert.equal(item(root).decision.humanConfirmed, false); assert.equal(item(root).decision.source, "accepted-canonical"); assert.equal(lines(join(root, ".clarity/evidence.jsonl"))[0].type, "adr");
  });
  await test("ST-013", "binary file content is excluded", () => {
    const root = fixture("st013", { "README.md": "# Safe\n" }); writeFileSync(join(root, "asset.bin"), Buffer.from([0, 1, 2, 3])); const preview = previewInit(root); assert(preview.excluded.some((row) => row.path === "asset.bin" && row.reason === "binary"));
  });
  await test("ST-014", "repeat apply is byte-idempotent", () => {
    const root = gitRoot; const before = tree(root); const head = run("git", ["-C", root, "rev-parse", "HEAD"]).stdout; const counts = [lines(join(root, ".clarity/events.jsonl")).length, lines(join(root, ".clarity/evidence.jsonl")).length]; const result = applyInit(root);
    assert.equal(result.status, "unchanged"); assert.equal(tree(root), before); assert.equal(run("git", ["-C", root, "rev-parse", "HEAD"]).stdout, head); assert.deepEqual(counts, [lines(join(root, ".clarity/events.jsonl")).length, lines(join(root, ".clarity/evidence.jsonl")).length]);
  });
  await test("ST-015", "partial init reports completed work and converges on retry", () => {
    const root = fixture("st015"); process.env.CLARITY_FAIL_AT = "after-canonical"; const error = expectCode(() => applyInit(root), "init-partial"); delete process.env.CLARITY_FAIL_AT;
    assert.equal(error.exitCode, 4); assert.deepEqual(error.details.completed, [".clarity/"]); assert(!existsSync(join(root, "CLARITY.md"))); assert.equal(applyInit(root).status, "repaired"); assert.equal(doctor(root).ok, true);
  });

  await test("QM-001", "confirmed plus implemented maps to stabilize", () => { const root = initialized("qm001", { "src/a.js": "ok\n" }); event(root, "decision.confirmed", { source: "user", humanConfirmed: true }); assert.equal(item(root).quadrant, "stabilize"); assert.equal(item(root).quadrantLabel, "定着・検証"); });
  await test("QM-002", "confirmed plus not-started maps to execute", () => { const root = initialized("qm002"); event(root, "decision.confirmed", { source: "user", humanConfirmed: true }); assert.equal(item(root).quadrant, "execute"); assert.equal(item(root).quadrantLabel, "実行待ち"); });
  await test("QM-003", "unconfirmed plus implemented maps to validate", () => { const root = initialized("qm003", { "src/a.js": "ok\n" }); assert.equal(item(root).quadrant, "validate"); assert.equal(item(root).quadrantLabel, "暫定実装・要再確認"); });
  await test("QM-004", "unknown plus not-started maps to decide", () => { const root = initialized("qm004", { "src/a.js": "ok\n" }); event(root, "execution.changed", { status: "not_started" }); assert.equal(item(root).decision.status, "unknown"); assert.equal(item(root).quadrant, "decide"); assert.equal(item(root).quadrantLabel, "設計・意思決定"); });
  await test("QM-005", "in-progress is visible inside execute", () => { const root = initialized("qm005"); event(root, "decision.confirmed", { source: "user", humanConfirmed: true }); event(root, "execution.changed", { status: "in_progress" }); assert.equal(item(root).quadrant, "execute"); assert.equal(item(root).inProgress, true); });
  await test("QM-006", "verified implementation without confirmation maps to validate", () => { const root = initialized("qm006"); event(root, "execution.changed", { status: "verified" }); assert.equal(item(root).quadrant, "validate"); });
  await test("QM-007", "rolled-back execution is not treated as implemented", () => { const root = initialized("qm007", { "src/a.js": "ok\n" }); event(root, "execution.changed", { status: "rolled_back" }); assert.equal(item(root).quadrant, "decide"); });
  await test("QM-008", "rebuild repairs a tampered quadrant", () => { const root = initialized("qm008"); const path = join(root, ".clarity/state.json"); const state = json(path); state.items[0].quadrant = "stabilize"; writeFileSync(path, JSON.stringify(state)); assert.equal(doctor(root).ok, false); rebuildState(root); assert.equal(doctor(root).ok, true); assert.equal(item(root).quadrant, "decide"); });
  await test("QM-009", "superseded item leaves active matrix but history remains", () => { const root = initialized("qm009"); event(root, "decision.superseded", { humanConfirmed: true }); assert.equal(item(root).activeMatrix, false); assert(history(root).events.some((row) => row.type === "decision.superseded")); });
  await test("QM-010", "idea disposition is excluded from attention", () => { const root = initialized("qm010", { "src/a.js": "ok\n" }); event(root, "disposition.changed", { disposition: "idea" }); assert.equal(item(root).attentionEligible, false); });
  await test("QM-011", "future deferral is excluded from attention", () => { const root = initialized("qm011", { "src/a.js": "ok\n" }); event(root, "disposition.changed", { disposition: "deferred", deferredUntil: "2026-09-30" }); assert.equal(item(root).attentionEligible, false); });
  await test("QM-012", "due deferral re-enters reevaluation", () => { const root = initialized("qm012"); event(root, "disposition.changed", { disposition: "deferred", deferredUntil: "2026-08-28" }); assert(item(root).attentionReasons.includes("deferred_due")); });
  await test("QM-013", "unknown remains explicitly unconfirmed", () => { const root = initialized("qm013", { "src/a.js": "ok\n" }); assert.equal(item(root).decision.status, "unknown"); assert.equal(item(root).decision.humanConfirmed, false); assert(item(root).attentionReasons.includes("implemented_without_confirmed_decision")); });
  await test("QM-014", "repeated rebuild is byte-stable", () => { const root = initialized("qm014", { "src/a.js": "ok\n" }); const first = rebuildState(root); const second = rebuildState(root); assert.equal(first.digest, second.digest); assert.equal(first.bytes, second.bytes); assert.equal(second.changed, false); });

  await test("DE-001", "AI proposal never becomes confirmed", () => { const root = initialized("de001"); event(root, "decision.proposed", { source: "agent-inference" }, "ai-agent"); assert.equal(item(root).decision.status, "proposed"); assert.equal(item(root).decision.humanConfirmed, false); });
  await test("DE-002", "existing generic project Decision seam updates both canonical views", () => { const f = secretaryProject("de002"); const decision = "価格方針は月額制にする"; const result = decideGenericProject(f.root, { secretaryRoot: f.secretary, projectName: f.projectName, decision, current: "価格を確定", next: "案内を更新" }); assert.equal(result.status, "saved"); assert.equal(countText(f.root, decision), 1); assert(readFileSync(join(f.root, "PROJECT.md"), "utf8").includes(decision)); assert(history(f.root).events.some((row) => row.type === "decision.confirmed")); assert.equal(item(f.root).decision.status, "confirmed"); });
  await test("DE-003", "failure after Decision write retries without duplication", () => { const f = secretaryProject("de003"); const decision = "対象地域は関西にする"; const error = expectCode(() => decideGenericProject(f.root, { secretaryRoot: f.secretary, projectName: f.projectName, decision, current: "対象確認", next: "候補抽出", failAt: "clarity-finalize" }), "decision-partial"); assert(error.details.completed.includes("project-decision")); assert.equal(item(f.root).decision.status, "proposed"); decideGenericProject(f.root, { secretaryRoot: f.secretary, projectName: f.projectName, decision, current: "対象確認", next: "候補抽出" }); assert.equal(countText(f.root, decision), 1); assert.equal(item(f.root).decision.status, "confirmed"); });
  await test("DE-004", "failure before Decision write does not show false confirmation", () => { const f = secretaryProject("de004"); const decision = "公開日は10月1日にする"; expectCode(() => decideGenericProject(f.root, { secretaryRoot: f.secretary, projectName: f.projectName, decision, current: "日付確認", next: "告知準備", failAt: "decision-write" }), "decision-partial"); assert.equal(countText(f.root, decision), 0); assert(history(f.root).events.some((row) => row.type === "decision.pending")); assert(!history(f.root).events.some((row) => row.type === "decision.confirmed")); assert.notEqual(item(f.root).decision.status, "confirmed"); decideGenericProject(f.root, { secretaryRoot: f.secretary, projectName: f.projectName, decision, current: "日付確認", next: "告知準備" }); assert.equal(countText(f.root, decision), 1); assert.equal(item(f.root).decision.status, "confirmed"); });
  await test("DE-005", "draft ADR remains proposed", () => { const root = initialized("de005", { "docs/adr/0001.md": "# Draft ADR\n\nstatus: draft\n" }); assert.equal(item(root).decision.status, "proposed"); assert.equal(lines(join(root, ".clarity/evidence.jsonl"))[0].type, "adr"); });
  await test("DE-006", "superseded ADR is inactive", () => { const root = initialized("de006", { "docs/adr/0001.md": "# Old ADR\n\nstatus: superseded\n" }); assert.equal(item(root).decision.status, "superseded"); assert.equal(item(root).activeMatrix, false); });
  await test("DE-007", "meeting transcript body is not copied", () => { const marker = "full-transcript-private-body-041"; const root = initialized("de007", { "README.md": "# Meeting\n", "meetings/transcript.txt": marker }); const proof = appendEvidence(root, { type: "meeting-reference", source: "meeting-index", locator: { path: "meetings/transcript.txt", id: "transcript-041" }, summary: "会議記録への参照", contentDigest: sha(marker) }).evidence; assert.equal(proof.contentDigest, sha(marker)); assert(!readFileSync(join(root, ".clarity/events.jsonl"), "utf8").includes(marker)); assert(!readFileSync(join(root, ".clarity/evidence.jsonl"), "utf8").includes(marker)); });
  await test("DE-008", "meeting evidence stores a locator and short summary", () => { const root = initialized("de008"); const result = appendEvidence(root, { type: "meeting-reference", source: "meeting-index", locator: { path: "meetings/2026-08-28.md", id: "M-041", date: "2026-08-28" }, summary: "価格方針を確認した会議", contentDigest: sha("meeting-M-041") }); assert.equal(result.evidence.locator.id, "M-041"); assert.equal(result.evidence.summary, "価格方針を確認した会議"); assert(!Object.hasOwn(result.evidence, "body")); });
  await test("DE-009", "Git evidence is traceable by repository SHA and path", () => { const root = initialized("de009"); const result = appendEvidence(root, { type: "git-commit", source: "local-git", locator: { repository: "example/project", sha: "abcdef1234567", paths: "src/index.js" }, summary: "実装commitを確認", contentDigest: sha("abcdef1234567") }); assert.deepEqual(result.evidence.locator, { repository: "example/project", sha: "abcdef1234567", paths: "src/index.js" }); });
  await test("DE-010", "test Evidence records command result and observation time", () => { const root = initialized("de010"); const result = appendEvidence(root, { type: "test-run", source: "local-test", locator: { command: "node test.mjs", status: "pass", time: fixedNow }, summary: "回帰testが成功", contentDigest: sha("test-pass") }); assert.equal(result.evidence.locator.status, "pass"); assert.equal(result.evidence.observedAt, fixedNow); });
  await test("DE-011", "Secret-like Evidence is rejected without partial write", () => { const root = initialized("de011"); const path = join(root, ".clarity/evidence.jsonl"); const before = sha(readFileSync(path)); expectCode(() => appendEvidence(root, { type: "file-reference", source: "manual", locator: { path: ".env" }, summary: "api_key=secret-value-must-not-save" }), "secret-detected"); assert.equal(sha(readFileSync(path)), before); });
  await test("DE-012", "superseding preserves the older Decision Event", () => { const root = initialized("de012", { "docs/adr/0001.md": "# Accepted\n\nstatus: accepted\n" }); const before = history(root).events.length; event(root, "decision.superseded", { humanConfirmed: true, successor: "ADR-2" }); assert.equal(history(root).events.length, before + 1); assert.equal(item(root).decision.status, "superseded"); });
  await test("DE-013", "unreachable Evidence remains traceable and enters attention", () => { const root = initialized("de013"); const proof = appendEvidence(root, { type: "file-reference", source: "external-reference", locator: { path: "references/missing.md" }, summary: "参照元へ現在到達できない", availability: "source_unreachable", contentDigest: sha("missing") }).evidence; event(root, "evidence.linked", { section: "decision", evidenceId: proof.evidenceId }); assert(item(root).attentionReasons.includes("source_unreachable")); assert.equal(history(root).evidence.find((row) => row.evidenceId === proof.evidenceId).availability, "source_unreachable"); });
  await test("DE-014", "doctor detects forged human confirmation", () => { const root = initialized("de014"); event(root, "decision.confirmed", { source: "user", humanConfirmed: true }); const path = join(root, ".clarity/state.json"); const forged = json(path); forged.items[0].decision.humanConfirmed = false; writeFileSync(path, JSON.stringify(forged)); const report = doctor(root); assert.equal(report.ok, false); assert.equal(report.stateError, "human-confirmation-invalid"); assert.equal(report.humanConfirmationMismatch, true); });
} finally {
  delete process.env.CLARITY_FAIL_AT;
  rmSync(work, { recursive: true, force: true });
}

assert.deepEqual(results.map((row) => row.id), expected, "43-case registry order/count mismatch");
const failed = results.filter((row) => !row.ok);
process.stdout.write(`SPRINT041_CASE_PASS=${results.length - failed.length} FAIL=${failed.length} TOTAL=${results.length}\n`);
if (failed.length) process.exit(1);
