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
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectRepoIdentity, previewInit } from "../plugins/secretary/scripts/lib/clarity-core.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const clarityCli = join(repo, "plugins/secretary/scripts/clarity.mjs");
const secretaryCli = join(repo, "plugins/secretary/scripts/clarity-secretary.mjs");
const projectTool = join(repo, "plugins/secretary/scripts/project-tools.mjs");
const templates = join(repo, "plugins/secretary/templates");
const work = mkdtempSync(join(tmpdir(), "agentic-s046-"));
const fixedNow = "2026-08-28T09:00:00.000Z";
const results = [];
const supplemental = [];
const remoteCommandLog = [];

process.env.CLARITY_NOW = fixedNow;
process.env.CC_SECRETARY_NOW = fixedNow;

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function objectDigest(value) { return sha(canonical(value)); }
function redigest(value, key = "bundleDigest") { const next = structuredClone(value); delete next[key]; next[key] = objectDigest(next); return next; }
function json(path) { return JSON.parse(readFileSync(path, "utf8")); }
function jsonLines(path) { return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse); }
function run(command, args, options = {}) {
  if (["fetch", "pull", "push", "gh"].includes(args[0])) remoteCommandLog.push([command, ...args]);
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
function git(root, ...args) {
  const result = run("git", args, { cwd: root, env: { GIT_AUTHOR_NAME: "Sprint 046", GIT_AUTHOR_EMAIL: "s046@example.invalid", GIT_COMMITTER_NAME: "Sprint 046", GIT_COMMITTER_EMAIL: "s046@example.invalid" } });
  assert.equal(result.status, 0, `git ${args.join(" ")}\n${result.stderr}`);
  return result.stdout.trim();
}
function tree(root) {
  const rows = [];
  function visit(dir) {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name); const rel = path.slice(root.length + 1); const stat = lstatSync(path);
      if (stat.isSymbolicLink()) rows.push([rel, "link", readFileSync(path, { encoding: "utf8", flag: "r" })]);
      else if (stat.isDirectory()) { rows.push([rel, "dir"]); visit(path); }
      else rows.push([rel, sha(readFileSync(path))]);
    }
  }
  visit(root);
  return sha(JSON.stringify(rows));
}
function file(value, label) { const path = join(work, `${label}.json`); writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`); return path; }
function registry() {
  const text = readFileSync(join(repo, "scripts/fixtures/sprint-042/clarity-acceptance.md"), "utf8");
  const body = text.match(/<!-- clarity-acceptance-registry:start -->\s*```json\s*([\s\S]*?)\s*```/u)?.[1];
  assert(body, "registry JSON");
  return JSON.parse(body).primaryCaseIds["sprint-046"];
}
function identityRef(identity) {
  const stable = { kind: identity.kind, rootName: identity.rootName, repository: identity.remote?.repository || null };
  return { ...stable, identityId: `cr_${objectDigest(stable).slice(0, 20)}` };
}
async function test(id, title, fn) {
  assert(expected.includes(id), `unexpected ID ${id}`);
  assert(!results.some((row) => row.id === id), `duplicate ID ${id}`);
  try { await fn(); results.push({ id, ok: true }); process.stdout.write(`PASS ${id} ${title}\n`); }
  catch (error) { results.push({ id, ok: false }); process.stdout.write(`FAIL ${id} ${title}: ${error?.stack || error}\n`); }
}
async function extra(id, title, fn) {
  try { await fn(); supplemental.push({ id, ok: true }); process.stdout.write(`PASS ${id} ${title}\n`); }
  catch (error) { supplemental.push({ id, ok: false }); process.stdout.write(`FAIL ${id} ${title}: ${error?.stack || error}\n`); }
}

const expected = registry();
const exact = [
  ...Array.from({ length: 16 }, (_, index) => `LK-${String(index + 1).padStart(3, "0")}`),
  ...Array.from({ length: 13 }, (_, index) => `SY-${String(index + 1).padStart(3, "0")}`),
  "IM-002", "IM-003", "IM-010", "IM-011", "PF-009",
];
assert.deepEqual(expected, exact, "Sprint 046 registry must be the exact 34 IDs");

let secretaryRoot; let secretaryProjectRoot; let repoRoot; let canary; let identityA; let identityB;
let request; let acceptance; let finalization; let linkId; let bundleA; let bundleB; let conflictPreview;

try {
  secretaryRoot = join(work, "secretary-repo");
  mkdirSync(secretaryRoot, { recursive: true }); cpSync(templates, secretaryRoot, { recursive: true });
  mkdirSync(join(secretaryRoot, "projects/open"), { recursive: true }); mkdirSync(join(secretaryRoot, "projects/closed"), { recursive: true }); mkdirSync(join(secretaryRoot, "inbox"), { recursive: true });
  if (!existsSync(join(secretaryRoot, "inbox/todo.md"))) writeFileSync(join(secretaryRoot, "inbox/todo.md"), "# TODO\n");
  git(secretaryRoot, "init", "-q");
  const create = run(process.execPath, [projectTool, "create-light", secretaryRoot, "匿名連携PJ", "--overview", "公開可能な概要", "--goal", "連携を確認する", "--success", "同期確認済み", "--current", "準備中", "--next", "linkする", "--confirm"]);
  assert.equal(create.status, 0, create.stderr);
  runJson(process.execPath, [secretaryCli, "init", secretaryRoot, "匿名連携PJ", "--apply", "--json"]);
  secretaryProjectRoot = join(secretaryRoot, "projects/open/匿名連携PJ/clarity");

  repoRoot = join(work, "external-repo"); mkdirSync(repoRoot); git(repoRoot, "init", "-q"); writeFileSync(join(repoRoot, "README.md"), "# 外部Repo\n\n実装とtestの公開fixtureです。\n");
  const anticipated = previewInit(repoRoot);
  identityA = runJson(process.execPath, [clarityCli, "link-identity", secretaryProjectRoot, "--json"]);
  identityB = { projectId: anticipated.project.clarityProjectId, repositoryIdentity: identityRef(inspectRepoIdentity(repoRoot)) };
  canary = join(work, "filesystem-canary.txt"); writeFileSync(canary, "DO-NOT-CHANGE\n");
  git(secretaryRoot, "add", "."); git(secretaryRoot, "commit", "-qm", "fixture secretary baseline");
  git(repoRoot, "add", "."); git(repoRoot, "commit", "-qm", "fixture repo baseline");

  await test("LK-001", "Secret／absolute path／顧客本文を含まないLink Request", () => {
    const prepared = runJson(process.execPath, [clarityCli, "link-prepare", secretaryProjectRoot, "--target-project-id", identityB.projectId, "--target-repo-identity-json", JSON.stringify(identityB.repositoryIdentity), "--role", "secretary", "--json"]);
    request = prepared.request; linkId = request.linkId;
    assert.equal(prepared.changed, false); assert.equal(prepared.networkCalls, 0); assert.equal(prepared.externalWrites, 0);
    const text = JSON.stringify(request); assert(!text.includes(secretaryRoot)); assert(!text.includes(repoRoot)); assert(!/gh[pousr]_|github_pat_|BEGIN [A-Z ]*PRIVATE KEY|password\s*[:=]|api[_-]?token\s*[:=]|顧客本文/iu.test(text));
  });

  await test("LK-002", "expected target不一致をwrite 0で拒否", () => {
    const bad = structuredClone(request); bad.target.projectId = "cp_ffffffffffffffffffff"; bad.requestDigest = redigest(bad, "requestDigest").requestDigest;
    const before = tree(repoRoot); const rejected = runJson(process.execPath, [clarityCli, "link-accept", repoRoot, "--input-file", file(bad, "wrong-target"), "--apply", "--json"], 3);
    assert.equal(rejected.code, "link-target-mismatch"); assert.equal(rejected.changed, false); assert.equal(tree(repoRoot), before);
  });

  await test("LK-005", "未初期化Repoはpreview後だけ初期化", () => {
    const before = tree(repoRoot); const preview = runJson(process.execPath, [clarityCli, "link-accept", repoRoot, "--input-file", file(request, "request-preview"), "--json"]);
    assert.equal(preview.status, "initialization-preview-required"); assert.equal(preview.requiresInitialization, true); assert.equal(tree(repoRoot), before);
    const applied = runJson(process.execPath, [clarityCli, "link-accept", repoRoot, "--input-file", file(request, "request-apply"), "--apply", "--json"]);
    acceptance = applied.acceptance; assert.equal(applied.status, "accepted"); assert(existsSync(join(repoRoot, ".clarity/project.json")));
  });

  await test("LK-003", "acceptでtargetにreciprocal manifest", () => {
    const manifest = json(join(repoRoot, `.clarity/links/${linkId}.json`)); assert.equal(manifest.state, "accepted"); assert.equal(manifest.local.projectId, identityB.projectId); assert.equal(manifest.peer.projectId, identityA.projectId);
  });

  await test("LK-004", "finalizeで双方ID／identity／digestを照合", () => {
    const badAcceptance = { ...acceptance, acceptanceDigest: "0".repeat(64) }; const beforeA = tree(secretaryRoot);
    const rejectedAcceptance = runJson(process.execPath, [clarityCli, "link-finalize", secretaryProjectRoot, "--input-file", file(badAcceptance, "acceptance-tampered"), "--apply", "--json"], 3); assert.equal(rejectedAcceptance.code, "link-digest-mismatch"); assert.equal(tree(secretaryRoot), beforeA);
    const preview = runJson(process.execPath, [clarityCli, "link-finalize", secretaryProjectRoot, "--input-file", file(acceptance, "acceptance"), "--json"]); assert.equal(preview.status, "finalize-preview");
    const first = runJson(process.execPath, [clarityCli, "link-finalize", secretaryProjectRoot, "--input-file", file(acceptance, "acceptance-apply"), "--apply", "--json"]); finalization = first.finalization;
    const badFinalization = { ...finalization, finalizationDigest: "f".repeat(64) }; const beforeB = tree(repoRoot);
    const rejectedFinalization = runJson(process.execPath, [clarityCli, "link-finalize", repoRoot, "--input-file", file(badFinalization, "finalization-tampered"), "--apply", "--json"], 3); assert.equal(rejectedFinalization.code, "link-digest-mismatch"); assert.equal(tree(repoRoot), beforeB);
    const second = runJson(process.execPath, [clarityCli, "link-finalize", repoRoot, "--input-file", file(finalization, "finalization"), "--apply", "--json"]);
    assert.equal(first.manifest.peer.repositoryIdentity.identityId, identityB.repositoryIdentity.identityId); assert.equal(second.manifest.peer.repositoryIdentity.identityId, identityA.repositoryIdentity.identityId);
    assert.equal(first.manifest.acceptanceDigest, second.manifest.acceptanceDigest); assert.equal(first.manifest.finalizationDigest, second.manifest.finalizationDigest);
  });

  await test("LK-006", "既存Standalone Project IDを維持", () => {
    assert.equal(json(join(repoRoot, ".clarity/project.json")).clarityProjectId, identityB.projectId); assert.equal(json(join(repoRoot, ".clarity/project.json")).mode, "linked-external");
    assert.equal(json(join(secretaryProjectRoot, ".clarity/project.json")).clarityProjectId, identityA.projectId);
  });

  await test("LK-012", "duplicate prepare／accept／finalizeは冪等", () => {
    const beforeA = tree(secretaryProjectRoot); const beforeB = tree(repoRoot);
    const later = { env: { CLARITY_NOW: "2026-09-03T12:00:00.000Z" } };
    const againAccept = runJson(process.execPath, [clarityCli, "link-accept", repoRoot, "--input-file", file(request, "request-retry"), "--apply", "--json"], 0, later); assert.equal(againAccept.changed, false); assert.equal(againAccept.acceptance.acceptanceDigest, acceptance.acceptanceDigest);
    const againA = runJson(process.execPath, [clarityCli, "link-finalize", secretaryProjectRoot, "--input-file", file(acceptance, "acceptance-retry"), "--apply", "--json"], 0, later); assert.equal(againA.changed, false); assert.equal(againA.finalization.finalizationDigest, finalization.finalizationDigest);
    const againB = runJson(process.execPath, [clarityCli, "link-finalize", repoRoot, "--input-file", file(finalization, "finalization-retry"), "--apply", "--json"], 0, later); assert.equal(againB.changed, false);
    assert.equal(tree(secretaryProjectRoot), beforeA); assert.equal(tree(repoRoot), beforeB);
  });

  await test("IM-003", "same finalize retryでlink／Event追加0", () => {
    assert.equal(readdirSync(join(repoRoot, ".clarity/links")).filter((name) => name.endsWith(".json")).length, 1);
    assert.equal(jsonLines(join(repoRoot, ".clarity/events.jsonl")).filter((event) => event.type === "link.finalized").length, 1);
    assert.equal(jsonLines(join(secretaryProjectRoot, ".clarity/events.jsonl")).filter((event) => event.type === "link.finalized").length, 1);
  });

  await test("LK-009", "absolute pathはgitignored local mappingだけ", () => {
    const a = runJson(process.execPath, [clarityCli, "link-map", secretaryProjectRoot, "--link-id", linkId, "--peer-root", repoRoot, "--apply", "--json"]); const b = runJson(process.execPath, [clarityCli, "link-map", repoRoot, "--link-id", linkId, "--peer-root", secretaryProjectRoot, "--apply", "--json"]);
    assert.equal(a.storage, ".git/clarity-links.json"); assert.equal(b.storage, ".git/clarity-links.json"); assert.equal(a.tracked, false); assert.equal(b.tracked, false);
    assert(readFileSync(join(secretaryRoot, ".git/clarity-links.json"), "utf8").includes(repoRoot));
    for (const root of [secretaryProjectRoot, repoRoot]) for (const rel of [".clarity/project.json", `.clarity/links/${linkId}.json`]) assert(!readFileSync(join(root, rel), "utf8").includes(work));
  });

  await test("LK-011", "manual bundleだけでnetworkなしlink／sync", () => {
    bundleA = runJson(process.execPath, [clarityCli, "link-export", secretaryProjectRoot, "--link-id", linkId, "--json"]).bundle;
    bundleB = runJson(process.execPath, [clarityCli, "link-export", repoRoot, "--link-id", linkId, "--json"]).bundle;
    assert.equal(remoteCommandLog.length, 0); assert.equal(bundleA.target.projectId, identityB.projectId); assert.equal(bundleB.target.projectId, identityA.projectId);
  });

  await test("LK-010", "GitHub read-only adapterは明示許可前0", () => {
    const denied = runJson(process.execPath, [clarityCli, "github-read-adapter", repoRoot, "--json"]); assert.equal(denied.status, "permission-required"); assert.equal(denied.networkCalls, 0);
    const allowed = runJson(process.execPath, [clarityCli, "github-read-adapter", repoRoot, "--allow-read", "--input-file", file(bundleA, "adapter-bundle"), "--json"]); assert.equal(allowed.status, "adapter-fixture-read"); assert.equal(allowed.networkCalls, 0); assert.equal(allowed.verifiedExternal, false);
  });

  await test("SY-001", "sync previewはwrite 0で候補を表示", () => {
    const before = tree(repoRoot); const preview = runJson(process.execPath, [clarityCli, "sync-preview", repoRoot, "--input-file", file(bundleA, "sync-a-preview"), "--json"]);
    assert.equal(preview.status, "ready"); assert.equal(preview.writeCount, 0); assert(preview.changes.newItems.length > 0); assert.equal(tree(repoRoot), before);
  });

  await test("SY-002", "applyは自Repo imports／projectionだけ", () => {
    const peerBefore = tree(secretaryRoot); const canaryBefore = readFileSync(canary, "utf8"); const result = runJson(process.execPath, [clarityCli, "sync-apply", repoRoot, "--input-file", file(bundleA, "sync-a-apply"), "--apply", "--json"]);
    assert.equal(result.status, "applied"); assert(existsSync(join(repoRoot, `.clarity/imports/${linkId}/bundle.json`))); assert(existsSync(join(repoRoot, `.clarity/projections/linked/${linkId}.json`)));
    assert.equal(tree(secretaryRoot), peerBefore); assert.equal(readFileSync(canary, "utf8"), canaryBefore);
  });

  await test("LK-007", "cross-rootとcanary write 0", () => {
    const peerBefore = tree(repoRoot); const canaryBefore = readFileSync(canary, "utf8"); const result = runJson(process.execPath, [clarityCli, "sync-apply", secretaryProjectRoot, "--input-file", file(bundleB, "sync-b-apply"), "--apply", "--json"]);
    assert.equal(result.status, "applied"); assert.equal(tree(repoRoot), peerBefore); assert.equal(readFileSync(canary, "utf8"), canaryBefore);
    const alias = join(work, "peer-symlink"); symlinkSync(repoRoot, alias, "dir"); const localBefore = tree(secretaryRoot);
    const rejected = runJson(process.execPath, [clarityCli, "link-map", secretaryProjectRoot, "--link-id", linkId, "--peer-root", alias, "--apply", "--json"], 3);
    assert.equal(rejected.code, "working-root-unsafe"); assert.match(rejected.message, /symlink/u); assert.equal(tree(secretaryRoot), localBefore); assert.equal(readFileSync(canary, "utf8"), canaryBefore);
  });

  await test("LK-008", "link／syncでremote pushなし", () => {
    assert.equal(remoteCommandLog.length, 0); assert.equal(git(secretaryRoot, "remote"), ""); assert.equal(git(repoRoot, "remote"), "");
    assert.equal(git(secretaryRoot, "rev-list", "--count", "HEAD"), "1"); assert.equal(git(repoRoot, "rev-list", "--count", "HEAD"), "1");
  });

  await test("SY-004", "Repo Primary実装をSecretary projection候補へ反映", () => {
    const preview = runJson(process.execPath, [clarityCli, "sync-preview", secretaryProjectRoot, "--input-file", file(bundleB, "repo-primary"), "--json"]);
    assert(preview.projection.items.some((item) => Object.hasOwn(item.fieldValues, "implementation"))); assert.equal(preview.projection.sourceProjectId, identityB.projectId);
  });

  await test("SY-003", "Secretary Primary競合をCritical Attentionにする", () => {
    const item = bundleA.items[0]; const localItem = bundleB.items[0]; const bad = structuredClone(bundleA);
    bad.items[0].itemId = localItem.itemId; bad.items[0].fieldValues.goal = `${localItem.fieldValues.goal}-競合`; bad.authorityClaims.goal = "secretary";
    conflictPreview = runJson(process.execPath, [clarityCli, "sync-preview", repoRoot, "--input-file", file(redigest(bad), "authority-conflict"), "--json"]);
    assert.equal(conflictPreview.status, "conflict"); assert(conflictPreview.conflicts.some((row) => row.type === "authority_conflict")); assert.equal(conflictPreview.attention.top[0].level, "critical"); assert.equal(conflictPreview.attention.top[0].reason, "authority_conflict"); assert.equal(item.itemId.length, 23);
  });

  await extra("AT-008", "実authority conflictのreason／level／ranking", () => {
    const top = conflictPreview.attention.top[0]; assert.equal(top.reason, "authority_conflict"); assert.equal(top.level, "critical"); assert.equal(top.rank, 1); assert.equal(conflictPreview.attention.ranking, "level-desc-conflict-id-asc");
  });

  await test("SY-006", "last-write-winsせずconflictを保持", () => {
    const before = tree(repoRoot); const apply = runJson(process.execPath, [clarityCli, "sync-apply", repoRoot, "--input-file", file(redigest({ ...bundleA, parentRevision: "bogus-revision" }), "sync-conflict-apply"), "--apply", "--json"], 3);
    assert.equal(apply.code, "sync-conflict"); assert.equal(tree(repoRoot), before);
  });

  await extra("AT-009", "実sync conflictのreason／level／ranking", () => {
    const bad = redigest({ ...bundleA, parentRevision: "bogus-revision" }); const preview = runJson(process.execPath, [clarityCli, "sync-preview", repoRoot, "--input-file", file(bad, "sync-conflict-preview"), "--json"]);
    const row = preview.attention.top.find((item) => item.reason === "sync_conflict"); assert(row); assert.equal(row.level, "high"); assert(Number.isInteger(row.rank));
  });

  await test("SY-005", "same field both Primaryをschema拒否", () => {
    const bad = structuredClone(bundleA); bad.authorityProfile.fields.goal.primary = ["secretary", "repo"];
    const rejected = runJson(process.execPath, [clarityCli, "sync-preview", repoRoot, "--input-file", file(redigest(bad), "primary-duplicate"), "--json"], 3); assert.equal(rejected.code, "authority-primary-conflict");
    const duplicated = redigest({ ...bundleA, items: [bundleA.items[0], bundleA.items[0], ...bundleA.items.slice(1)] }); const before = tree(repoRoot);
    const duplicateRejected = runJson(process.execPath, [clarityCli, "sync-preview", repoRoot, "--input-file", file(duplicated, "duplicate-item"), "--json"], 3); assert.equal(duplicateRejected.code, "sync-duplicate-item"); assert.equal(tree(repoRoot), before);
  });

  await test("SY-007", "古いsource sequenceをstale表示", () => {
    const bad = redigest({ ...bundleA, sourceSequence: 0, sourceRevision: "older-revision" }); const preview = runJson(process.execPath, [clarityCli, "sync-preview", repoRoot, "--input-file", file(bad, "stale"), "--json"]);
    assert.equal(preview.status, "stale"); assert.equal(preview.stale, true); assert.equal(preview.writeCount, 0);
  });

  await test("SY-008", "readerより新しいschemaを安全停止", () => {
    const bad = redigest({ ...bundleA, schemaVersion: 99 }); const preview = runJson(process.execPath, [clarityCli, "sync-preview", repoRoot, "--input-file", file(bad, "newer-schema"), "--json"]);
    assert.equal(preview.status, "incompatible"); assert.equal(preview.newerSchema, true); assert.equal(preview.writeCount, 0);
  });

  await test("SY-009", "unknown fieldを保持してroundtrip", () => {
    const changed = redigest({ ...bundleA, futureEnvelope: { version: 7, keep: true } }); const applied = runJson(process.execPath, [clarityCli, "sync-apply", repoRoot, "--input-file", file(changed, "unknown-field"), "--apply", "--json"]);
    assert.equal(applied.status, "applied"); assert.deepEqual(json(join(repoRoot, `.clarity/projections/linked/${linkId}.json`)).unknownFields.futureEnvelope, { version: 7, keep: true }); assert.deepEqual(json(join(repoRoot, `.clarity/imports/${linkId}/bundle.json`)).futureEnvelope, { version: 7, keep: true });
    bundleA = changed;
  });

  await test("SY-010", "same sync retryはduplicateなし", () => {
    const before = tree(repoRoot); const eventsBefore = jsonLines(join(repoRoot, ".clarity/events.jsonl")).length; const retry = runJson(process.execPath, [clarityCli, "sync-apply", repoRoot, "--input-file", file(bundleA, "sync-retry"), "--apply", "--json"]);
    assert.equal(retry.status, "unchanged"); assert.equal(retry.writeCount, 0); assert.equal(tree(repoRoot), before); assert.equal(jsonLines(join(repoRoot, ".clarity/events.jsonl")).length, eventsBefore);
  });

  await test("IM-002", "retryでimport／event重複0", () => {
    assert.equal(readdirSync(join(repoRoot, `.clarity/imports/${linkId}`)).filter((name) => name === "bundle.json").length, 1);
    assert.equal(jsonLines(join(repoRoot, ".clarity/events.jsonl")).filter((event) => event.type === "sync.applied").length, 2);
  });

  await test("SY-011", "tombstoneは黙って削除せずconflict", () => {
    const itemId = bundleA.items[0].itemId; const bad = redigest({ ...bundleA, sourceSequence: bundleA.sourceSequence + 1, sourceRevision: "tombstone-revision", items: bundleA.items.slice(1), tombstones: [itemId] }); const before = tree(repoRoot);
    const preview = runJson(process.execPath, [clarityCli, "sync-preview", repoRoot, "--input-file", file(bad, "tombstone"), "--json"]); assert.equal(preview.status, "conflict"); assert(preview.conflicts.some((row) => row.type === "tombstone_conflict")); assert.equal(tree(repoRoot), before);
  });

  await test("SY-012", "split resolutionはrelationとhistoryをEvent化", () => {
    const id = conflictPreview.conflicts[0].conflictId; const preview = runJson(process.execPath, [clarityCli, "sync-resolve", repoRoot, "--link-id", linkId, "--conflict-id", id, "--choice", "split", "--json"]); assert.equal(preview.changed, false);
    const applied = runJson(process.execPath, [clarityCli, "sync-resolve", repoRoot, "--link-id", linkId, "--conflict-id", id, "--choice", "split", "--apply", "--json"]); assert.equal(applied.status, "resolved"); assert.equal(applied.event.payload.relation.type, "split-from-conflict");
    const retry = runJson(process.execPath, [clarityCli, "sync-resolve", repoRoot, "--link-id", linkId, "--conflict-id", id, "--choice", "split", "--apply", "--json"]); assert.equal(retry.changed, false);
    for (const choice of ["secretary", "repo", "new-decision", "defer"]) {
      const resolution = runJson(process.execPath, [clarityCli, "sync-resolve", repoRoot, "--link-id", linkId, "--conflict-id", id, "--choice", choice, "--apply", "--json"]);
      assert.equal(resolution.event.payload.choice, choice); assert.equal(resolution.status, choice === "defer" ? "deferred" : "resolved");
    }
    const choices = jsonLines(join(repoRoot, ".clarity/events.jsonl")).filter((event) => event.type === "sync.conflict.resolved" && event.payload.conflictId === id).map((event) => event.payload.choice).sort();
    assert.deepEqual(choices, ["defer", "new-decision", "repo", "secretary", "split"]);
  });

  await test("SY-013", "authority変更はpreviewと人間確認が必要", () => {
    const bad = structuredClone(bundleA); bad.authorityProfile.fields.priority = { kind: "reference", primary: null }; const preview = runJson(process.execPath, [clarityCli, "sync-preview", repoRoot, "--input-file", file(redigest(bad), "authority-change"), "--json"]);
    assert.equal(preview.status, "authority-change-preview"); assert.equal(preview.confirmationRequired, true); assert.equal(preview.writeCount, 0);
  });

  await test("LK-015", "linkId改ざんsync拒否", () => {
    const bad = redigest({ ...bundleA, linkId: "cl_ffffffffffffffffffff" }); const before = tree(repoRoot); const rejected = runJson(process.execPath, [clarityCli, "sync-preview", repoRoot, "--input-file", file(bad, "tamper-link-id"), "--json"], 3);
    assert.equal(rejected.code, "link-not-active"); assert.equal(tree(repoRoot), before);
  });

  await test("LK-016", "repository identity改ざんsync拒否", () => {
    const bad = structuredClone(bundleA); bad.source.repositoryIdentity.identityId = "cr_ffffffffffffffffffff"; const before = tree(repoRoot); const rejected = runJson(process.execPath, [clarityCli, "sync-preview", repoRoot, "--input-file", file(redigest(bad), "tamper-identity"), "--json"], 3);
    assert.equal(rejected.code, "link-peer-mismatch"); assert.equal(tree(repoRoot), before);
  });

  await test("IM-010", "doctor healthyにmode／schema／Hook／link／Xmind", () => {
    const doctor = runJson(process.execPath, [clarityCli, "doctor", repoRoot, "--host", "codex", "--hook-state", "supported", "--json"]);
    assert.equal(doctor.mode, "linked-external"); assert.equal(doctor.schemaStatus, "current"); assert.equal(doctor.capabilities.hook.status, "supported"); assert.equal(doctor.capabilities.link.status, "healthy"); assert.equal(doctor.capabilities.xmind.status, "disabled"); assert.equal(doctor.ok, true);
  });

  await test("PF-009", "stale linked ProjectをPortfolio表示", () => {
    const metaPath = join(secretaryProjectRoot, `.clarity/imports/${linkId}/meta.json`); const meta = json(metaPath); meta.importedAt = "2000-01-01T00:00:00.000Z"; writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
    const report = runJson(process.execPath, [secretaryCli, "portfolio", secretaryRoot, "--json"]); const row = report.projects.find((project) => project.name === "匿名連携PJ"); assert(row); assert.equal(row.linkHealth, "broken"); assert.equal(row.linkStale, true);
  });

  await test("LK-014", "link先unreachableをstale表示しlocal継続", () => {
    const mappingPath = join(secretaryRoot, ".git/clarity-links.json"); const mappings = json(mappingPath); delete mappings.links[linkId]; writeFileSync(mappingPath, `${JSON.stringify(mappings, null, 2)}\n`);
    const doctor = runJson(process.execPath, [clarityCli, "link-doctor", secretaryProjectRoot, "--link-id", linkId, "--json"]); assert.equal(doctor.status, "broken"); assert(doctor.links[0].issues.includes("peer-unreachable")); assert(runJson(process.execPath, [clarityCli, "status", secretaryProjectRoot, "--json"]).clarityProjectId);
  });

  await test("IM-011", "doctor broken linkに原因と修復候補", () => {
    const doctor = runJson(process.execPath, [clarityCli, "link-doctor", secretaryProjectRoot, "--link-id", linkId, "--json"]); assert.equal(doctor.healthy, false); assert(doctor.links[0].issues.length > 0); assert(doctor.links[0].repairChoices.length >= 3); assert.match(doctor.nextAction, /mapping|manual sync|unlink/u);
  });

  await test("LK-013", "unlink後も履歴とStandalone IDを維持", () => {
    const projectBefore = json(join(repoRoot, ".clarity/project.json")); const historyBefore = jsonLines(join(repoRoot, ".clarity/events.jsonl")).length; const conflictId = conflictPreview.conflicts[0].conflictId;
    const result = runJson(process.execPath, [clarityCli, "sync-resolve", repoRoot, "--link-id", linkId, "--conflict-id", conflictId, "--choice", "unlink", "--apply", "--json"]); assert.equal(result.status, "disabled");
    const projectAfter = json(join(repoRoot, ".clarity/project.json")); assert.equal(projectAfter.clarityProjectId, projectBefore.clarityProjectId); assert.equal(projectAfter.mode, "standalone"); assert.equal(projectAfter.secretaryLink, null); assert(jsonLines(join(repoRoot, ".clarity/events.jsonl")).length > historyBefore); assert.equal(json(join(repoRoot, `.clarity/links/${linkId}.json`)).state, "disabled");
  });

  const actual = results.map((row) => row.id);
  const missing = expected.filter((id) => !actual.includes(id)); const extraIds = actual.filter((id) => !expected.includes(id)); const duplicate = actual.filter((id, index) => actual.indexOf(id) !== index);
  const failed = results.filter((row) => !row.ok); const supplementalFailed = supplemental.filter((row) => !row.ok);
  assert.deepEqual({ missing, extra: extraIds, duplicate }, { missing: [], extra: [], duplicate: [] });
  assert.equal(results.length, 34); assert.equal(failed.length, 0, `failed cases: ${failed.map((row) => row.id).join(", ")}`); assert.equal(supplementalFailed.length, 0, `failed supplemental: ${supplementalFailed.map((row) => row.id).join(", ")}`);
  assert.equal(remoteCommandLog.length, 0); assert.equal(readFileSync(canary, "utf8"), "DO-NOT-CHANGE\n");
  process.stdout.write(`SPRINT046_TEST_PASS=${results.length} FAIL=0 REGISTRY_MISSING=0 REGISTRY_DUPLICATE=0 REGISTRY_EXTRA=0 SUPPLEMENTAL=${supplemental.length} REMOTE_COMMANDS=0 CANARY=UNCHANGED\n`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
