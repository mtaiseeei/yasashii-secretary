#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
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

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(repo, "plugins/secretary/scripts/clarity.mjs");
const hookCli = join(repo, "plugins/secretary/scripts/clarity-hook.mjs");
const work = mkdtempSync(join(tmpdir(), "agentic-s047-"));
const root = join(work, "drift-repo");
const outside = join(work, "outside");
const fixedNow = "2026-08-28T10:00:00.000Z";
const results = [];
const supplemental = [];
let itemId; let baseHead; let oldSourceCommit;

process.env.CLARITY_NOW = fixedNow;
process.env.CC_SECRETARY_NOW = fixedNow;

function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function json(path) { return JSON.parse(readFileSync(path, "utf8")); }
function lines(path) { return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse); }
function run(command, args, options = {}) {
  return spawnSync(command, args, { cwd: options.cwd || repo, encoding: "utf8", timeout: options.timeout || 120_000, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ...(options.env || {}) }, input: options.input });
}
function runJson(command, args, expected = 0, options = {}) {
  const result = run(command, args, options);
  assert.equal(result.status, expected, `${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return JSON.parse(expected === 0 ? result.stdout : result.stderr);
}
function git(...args) {
  const result = run("git", args, { cwd: root, env: { GIT_AUTHOR_NAME: "Sprint 047", GIT_AUTHOR_EMAIL: "s047@example.invalid", GIT_COMMITTER_NAME: "Sprint 047", GIT_COMMITTER_EMAIL: "s047@example.invalid" } });
  assert.equal(result.status, 0, `git ${args.join(" ")}\n${result.stderr}`);
  return result.stdout.trim();
}
function registry() {
  const text = readFileSync(join(repo, "scripts/fixtures/sprint-042/clarity-acceptance.md"), "utf8");
  const body = text.match(/<!-- clarity-acceptance-registry:start -->\s*```json\s*([\s\S]*?)\s*```/u)?.[1];
  assert(body);
  return JSON.parse(body).primaryCaseIds["sprint-047"];
}
function inputFile(value, name) { const path = join(work, `${name}.json`); writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`); return path; }
function snapshot() {
  return {
    head: git("rev-parse", "HEAD"),
    branch: git("branch", "--show-current"),
    remote: git("remote", "-v"),
    visibility: git("config", "--get", "clarity.visibility"),
    stagedBlob: git("show", ":user-staged.txt"),
    stagedWorktree: readFileSync(join(root, "user-staged.txt"), "utf8"),
    unstaged: readFileSync(join(root, "user-unstaged.txt"), "utf8"),
    untracked: readFileSync(join(root, "user-untracked.txt"), "utf8"),
  };
}
function userStateEqual(actual, expected, { head = true } = {}) {
  if (head) assert.equal(actual.head, expected.head);
  assert.equal(actual.branch, expected.branch); assert.equal(actual.remote, expected.remote); assert.equal(actual.visibility, expected.visibility);
  assert.equal(actual.stagedBlob, expected.stagedBlob); assert.equal(actual.stagedWorktree, expected.stagedWorktree); assert.equal(actual.unstaged, expected.unstaged); assert.equal(actual.untracked, expected.untracked);
}
function comparison({ decisionValue = "email-first", decisionMarkers = ["email first"], implementationValue = "customer_id-first", implementationMarkers = ["customer_id first"], decisionPath = "docs/decision.md", implementationPath = "src/lookup.js", implementationType = "file-reference", implementationSha = null, generated = false, generatedFrom = null, operationId = null } = {}) {
  return {
    schemaVersion: 1,
    itemId,
    ...(operationId ? { operationId } : {}),
    decision: { type: "project-decision", locator: { path: decisionPath, lineStart: 1, lineEnd: 20 }, claim: { field: "customer-lookup-order", value: decisionValue, markers: decisionMarkers } },
    implementation: { type: implementationType, locator: { path: implementationPath, lineStart: 1, lineEnd: 30, ...(implementationSha ? { sha: implementationSha } : {}) }, claim: { field: "customer-lookup-order", value: implementationValue, markers: implementationMarkers }, ...(generated ? { authority: "generated" } : {}), ...(generatedFrom ? { generatedFrom } : {}) },
  };
}
async function test(id, title, fn) {
  assert(expected.includes(id), `unexpected ID ${id}`); assert(!results.some((row) => row.id === id), `duplicate ${id}`);
  try { await fn(); results.push({ id, ok: true }); process.stdout.write(`PASS ${id} ${title}\n`); }
  catch (error) { results.push({ id, ok: false }); process.stdout.write(`FAIL ${id} ${title}: ${error?.stack || error}\n`); }
}
async function extra(id, title, fn) {
  try { await fn(); supplemental.push({ id, ok: true }); process.stdout.write(`PASS ${id} ${title}\n`); }
  catch (error) { supplemental.push({ id, ok: false }); process.stdout.write(`FAIL ${id} ${title}: ${error?.stack || error}\n`); }
}
function spawnAsync(command, args, options = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, { cwd: options.cwd || repo, env: { ...process.env, ...(options.env || {}) }, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = ""; let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; }); child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (status) => resolvePromise({ status, stdout, stderr }));
    if (options.input) child.stdin.end(options.input); else child.stdin.end();
  });
}

const expected = registry();
const exact = [...Array.from({ length: 10 }, (_, index) => `DR-${String(index + 1).padStart(3, "0")}`), ...Array.from({ length: 15 }, (_, index) => `GS-${String(index + 1).padStart(3, "0")}`)];
assert.deepEqual(expected, exact, "Sprint 047 registry must be exact 25 IDs");

try {
  mkdirSync(join(root, "docs"), { recursive: true }); mkdirSync(join(root, "src"), { recursive: true }); mkdirSync(join(root, "generated"), { recursive: true }); mkdirSync(join(root, "templates"), { recursive: true }); mkdirSync(outside);
  writeFileSync(join(root, "README.md"), "# Drift fixture\n");
  writeFileSync(join(root, "docs/decision.md"), "Approved decision: lookup by email first.\n");
  writeFileSync(join(root, "src/lookup.js"), "export const lookupOrder = 'customer_id first';\n");
  writeFileSync(join(root, "src/synonym.js"), "export const lookupOrder = 'primary email before identifier fallback';\n");
  writeFileSync(join(root, "templates/lookup.template"), "lookup order: email first\n");
  writeFileSync(join(root, "generated/lookup.js"), "generated lookup order: customer_id first\n");
  writeFileSync(join(root, "user-staged.txt"), "baseline staged\n"); writeFileSync(join(root, "user-unstaged.txt"), "baseline unstaged\n");
  git("init", "-q", "-b", "main"); git("add", "."); git("commit", "-qm", "source baseline"); oldSourceCommit = git("rev-parse", "HEAD");
  runJson(process.execPath, [cli, "init", root, "--apply", "--json"]); git("add", ".clarity", "CLARITY.md"); git("commit", "-qm", "clarity baseline");
  itemId = json(join(root, ".clarity/state.json")).items[0].itemId;
  runJson(process.execPath, [cli, "event", root, "--event-json", JSON.stringify({ type: "decision.confirmed", itemId, actor: "fixture-human", payload: { source: "accepted-canonical", humanConfirmed: true } }), "--json"]);
  runJson(process.execPath, [cli, "event", root, "--event-json", JSON.stringify({ type: "execution.changed", itemId, actor: "fixture-code", payload: { status: "implemented" } }), "--json"]);
  git("add", ".clarity"); git("commit", "-qm", "item baseline"); baseHead = git("rev-parse", "HEAD");
  git("remote", "add", "origin", "https://example.invalid/drift-fixture.git"); git("config", "clarity.visibility", "private");
  writeFileSync(join(root, "user-staged.txt"), "user staged change\n"); git("add", "user-staged.txt");
  writeFileSync(join(root, "user-unstaged.txt"), "user unstaged change\n"); writeFileSync(join(root, "user-untracked.txt"), "user untracked change\n");

  let actualDrift;
  await test("DR-001", "email-firstとcustomer_id-firstを双方locator付きで検出", () => {
    const before = snapshot(); const input = inputFile(comparison(), "drift-main");
    const preview = runJson(process.execPath, [cli, "drift", root, "--input-file", input, "--json"]); assert.equal(preview.alignment, "drift"); assert.equal(preview.changed, false); assert.equal(preview.decision.locator.path, "docs/decision.md"); assert.equal(preview.implementation.locator.path, "src/lookup.js");
    actualDrift = runJson(process.execPath, [cli, "drift", root, "--input-file", input, "--apply", "--json"]); assert.equal(actualDrift.alignment, "drift"); assert.equal(actualDrift.evidenceIds.length, 2); userStateEqual(snapshot(), before);
  });
  await test("DR-004", "confirmed driftはactual comparator由来Critical Attention", () => {
    assert.equal(actualDrift.attention.reason, "decision_implementation_drift"); assert.equal(actualDrift.attention.level, "critical"); assert(Number.isInteger(actualDrift.attention.rank));
  });
  await extra("AT-003", "actual Drift comparatorからreason／level／ranking再評価", () => {
    assert.deepEqual({ reason: actualDrift.attention.reason, level: actualDrift.attention.level, rank: actualDrift.attention.rank }, { reason: "decision_implementation_drift", level: "critical", rank: 1 }); assert.equal(actualDrift.attention.ranking, "attention-deterministic-rank");
  });
  await test("DR-003", "marker根拠不足はpossible_drift", () => {
    const value = comparison({ implementationMarkers: ["marker not present"], operationId: "possible-1" }); const result = runJson(process.execPath, [cli, "drift", root, "--input-file", inputFile(value, "possible"), "--apply", "--json"]); assert.equal(result.alignment, "possible_drift"); assert.equal(result.attention.reason, "possible_drift"); assert.equal(result.attention.level, "high");
  });
  await extra("AT-004", "actual possible comparatorからreason／level／ranking再評価", () => {
    const report = runJson(process.execPath, [cli, "attention", root, "--limit", "20", "--json"]); const rank = report.items.findIndex((entry) => entry.itemId === itemId) + 1; const row = report.items[rank - 1]; assert.equal(row.reasons[0], "possible_drift"); assert.equal(row.level, "high"); assert.equal(rank, 1);
  });
  await test("DR-002", "同義表現はcanonical valueでaligned", () => {
    const result = runJson(process.execPath, [cli, "drift", root, "--input-file", inputFile(comparison({ implementationPath: "src/synonym.js", implementationValue: "email-first", implementationMarkers: ["primary email before identifier fallback"], operationId: "synonym-1" }), "synonym"), "--json"]); assert.equal(result.alignment, "aligned");
  });
  await test("DR-005", "Decision変更でalignedになり履歴保持", () => {
    writeFileSync(join(root, "docs/decision.md"), "Approved decision: lookup by customer_id first.\n"); const result = runJson(process.execPath, [cli, "drift", root, "--input-file", inputFile(comparison({ decisionValue: "customer_id-first", decisionMarkers: ["customer_id first"], operationId: "decision-aligned" }), "decision-aligned"), "--apply", "--json"]); assert.equal(result.alignment, "aligned"); const h = runJson(process.execPath, [cli, "history", root, "--json"]); assert(h.alignmentHistory.some((row) => row.status === "drift")); assert(h.alignmentHistory.some((row) => row.status === "aligned"));
  });
  await test("DR-006", "実装修正でalignedになり履歴保持", () => {
    writeFileSync(join(root, "docs/decision.md"), "Approved decision: lookup by email first.\n"); runJson(process.execPath, [cli, "drift", root, "--input-file", inputFile(comparison({ operationId: "drift-before-code-fix" }), "drift-before-fix"), "--apply", "--json"]);
    writeFileSync(join(root, "src/lookup.js"), "export const lookupOrder = 'email first';\n"); const result = runJson(process.execPath, [cli, "drift", root, "--input-file", inputFile(comparison({ implementationValue: "email-first", implementationMarkers: ["email first"], operationId: "code-aligned" }), "code-aligned"), "--apply", "--json"]); assert.equal(result.alignment, "aligned"); const h = runJson(process.execPath, [cli, "history", root, "--json"]); assert(h.alignmentHistory.filter((row) => row.status === "drift").length >= 2);
    writeFileSync(join(root, "src/lookup.js"), "export const lookupOrder = 'customer_id first';\n");
  });
  await test("DR-007", "waiverはEvent化し抑制後に期限切れ再出現", () => {
    runJson(process.execPath, [cli, "drift", root, "--input-file", inputFile(comparison({ operationId: "waiver-drift" }), "waiver-drift"), "--apply", "--json"]);
    const beforeEvents = lines(join(root, ".clarity/events.jsonl")).length; const preview = runJson(process.execPath, [cli, "drift-waiver", root, "--item-id", itemId, "--reason", "移行期間の互換対応", "--scope", "customer lookup only", "--expires-at", "2026-08-29T00:00:00.000Z", "--json"]); assert.equal(preview.changed, false);
    const applied = runJson(process.execPath, [cli, "drift-waiver", root, "--item-id", itemId, "--reason", "移行期間の互換対応", "--scope", "customer lookup only", "--expires-at", "2026-08-29T00:00:00.000Z", "--apply", "--json"]); assert.equal(applied.activeAttention, false); assert.equal(lines(join(root, ".clarity/events.jsonl")).length, beforeEvents + 1);
    const expired = runJson(process.execPath, [cli, "attention", root, "--limit", "20", "--json"], 0, { env: { CLARITY_NOW: "2026-08-30T00:00:00.000Z" } }); assert(expired.items.some((row) => row.itemId === itemId && row.reasons.includes("decision_implementation_drift")));
  });
  await test("DR-008", "古いcommitはcurrent implementationと誤認しない", () => {
    const result = runJson(process.execPath, [cli, "drift", root, "--input-file", inputFile(comparison({ implementationType: "git-commit", implementationSha: oldSourceCommit, operationId: "old-commit" }), "old-commit"), "--json"]); assert.equal(result.alignment, "unknown"); assert.equal(result.reason, "historical-implementation-not-current"); assert.equal(result.implementation.current, false);
  });
  await test("DR-009", "generated outputよりsource authorityを優先", () => {
    const source = { type: "file-reference", locator: { path: "templates/lookup.template", lineStart: 1, lineEnd: 10 }, claim: { field: "customer-lookup-order", value: "email-first", markers: ["email first"] } };
    const result = runJson(process.execPath, [cli, "drift", root, "--input-file", inputFile(comparison({ implementationPath: "generated/lookup.js", implementationValue: "customer_id-first", implementationMarkers: ["customer_id first"], generated: true, generatedFrom: source, operationId: "generated" }), "generated"), "--json"]); assert.equal(result.alignment, "aligned"); assert.equal(result.reason, "generated-source-aligned"); assert.equal(result.implementation.generated, true);
  });
  await test("DR-010", "Secret含有sourceは値を露出せず拒否", () => {
    const canary = "S047_CANARY_DO_NOT_EXPOSE_7d2f"; writeFileSync(join(root, "src/leaky.js"), `api_token=${canary}\nlookup order: customer_id first\n`); const before = snapshot();
    const result = run(process.execPath, [cli, "drift", root, "--input-file", inputFile(comparison({ implementationPath: "src/leaky.js", operationId: "leaky" }), "leaky"), "--apply", "--json"]); assert.equal(result.status, 3); assert(!result.stdout.includes(canary)); assert(!result.stderr.includes(canary)); assert(!readFileSync(join(root, ".clarity/evidence.jsonl"), "utf8").includes(canary)); userStateEqual(snapshot(), before);
  });

  await test("GS-001", "preexisting unstagedを成功／失敗後も保持", () => { assert.equal(readFileSync(join(root, "user-unstaged.txt"), "utf8"), "user unstaged change\n"); });
  await test("GS-002", "preexisting staged blobを保持", () => { assert.equal(git("show", ":user-staged.txt"), "user staged change"); });
  await test("GS-003", "明示commitはClarity所有pathだけ", () => {
    const before = snapshot(); const preview = runJson(process.execPath, [cli, "commit", root, "--message", "[clarity] drift checkpoint", "--json"]); assert(preview.paths.length > 0); const committed = runJson(process.execPath, [cli, "commit", root, "--message", "[clarity] drift checkpoint", "--apply", "--json"]); assert(committed.committedPaths.every((path) => path.startsWith(".clarity/") || path === "CLARITY.md")); userStateEqual(snapshot(), before, { head: false }); assert.notEqual(git("rev-parse", "HEAD"), before.head);
  });
  await test("GS-004", "failed applyはuser dirtyへrollbackしない", () => {
    const before = snapshot(); const result = run(process.execPath, [cli, "drift", root, "--input-file", inputFile(comparison({ operationId: "failure-retry" }), "failure"), "--apply", "--json"], { env: { CLARITY_DRIFT_FAIL_AT: "after-evidence" } }); assert.equal(result.status, 4); userStateEqual(snapshot(), before);
    const retry = runJson(process.execPath, [cli, "drift", root, "--input-file", inputFile(comparison({ operationId: "failure-retry" }), "failure-retry"), "--apply", "--json"]); assert(["applied", "unchanged"].includes(retry.status)); userStateEqual(snapshot(), before);
  });
  await test("GS-005", "Clarity操作はpushを実行しない", () => { assert.equal(git("remote", "get-url", "origin"), "https://example.invalid/drift-fixture.git"); const remoteRef = run("git", ["rev-parse", "--verify", "refs/remotes/origin/main"], { cwd: root }); assert.notEqual(remoteRef.status, 0, "remote tracking ref must not exist"); });
  await test("GS-006", "branch／remote／visibilityは不変", () => { const value = snapshot(); assert.equal(value.branch, "main"); assert.equal(value.remote, "origin\thttps://example.invalid/drift-fixture.git (fetch)\norigin\thttps://example.invalid/drift-fixture.git (push)"); assert.equal(value.visibility, "private"); });
  await test("GS-007", "root外symlink locatorを拒否", () => {
    writeFileSync(join(outside, "decision.md"), "email first\n"); symlinkSync(join(outside, "decision.md"), join(root, "docs/outside-link.md")); const before = snapshot(); const rejected = runJson(process.execPath, [cli, "drift", root, "--input-file", inputFile(comparison({ decisionPath: "docs/outside-link.md", operationId: "symlink" }), "symlink"), "--apply", "--json"], 3); assert.equal(rejected.code, "drift-path-symlink"); userStateEqual(snapshot(), before);
  });
  await test("GS-008", "traversal／absolute locatorを拒否", () => {
    for (const path of ["../outside/decision.md", join(outside, "decision.md")]) { const rejected = runJson(process.execPath, [cli, "drift", root, "--input-file", inputFile(comparison({ decisionPath: path, operationId: sha(path).slice(0, 8) }), `path-${sha(path).slice(0, 8)}`), "--json"], 3); assert.equal(rejected.code, "drift-path-invalid"); }
  });
  await test("GS-009", "concurrent Hook／CLI write後もparse・unique・rebuild 100%", async () => {
    const cliJobs = Array.from({ length: 32 }, (_, index) => spawnAsync(process.execPath, [cli, "event", root, "--event-json", JSON.stringify({ type: "attention.override", itemId, actor: "stress-cli", payload: { level: "high", reason: `stress-${index}`, rank: index } }), "--json"]));
    const hookJobs = Array.from({ length: 32 }, (_, index) => spawnAsync(process.execPath, [hookCli], { input: `${JSON.stringify({ hook_event_name: "PostToolUse", session_id: "s047-stress", turn_id: `turn-${index}`, tool_name: "Write", tool_input: { file_path: join(root, `src/stress-${index}.js`) }, cwd: root })}\n`, env: { PLUGIN_ROOT: join(repo, "plugins/secretary") } }));
    const all = await Promise.all([...cliJobs, ...hookJobs]); assert(all.every((row) => row.status === 0), all.filter((row) => row.status !== 0).map((row) => row.stderr).join("\n"));
    const events = lines(join(root, ".clarity/events.jsonl")); assert.equal(new Set(events.map((row) => row.eventId)).size, events.length); assert.equal(events.filter((row) => row.actor === "stress-cli").length, 32);
    const rebuild = runJson(process.execPath, [cli, "rebuild", root, "--json"]); assert(json(join(root, ".clarity/state.json"))); assert.equal(rebuild.state.source.eventCount, events.length);
  });
  await test("GS-010", "stale owned lockをdoctorし自動回復", () => {
    writeFileSync(join(root, ".clarity/lock.json"), `${JSON.stringify({ schemaVersion: 1, owner: "agentic-secretary:clarity", kind: "canonical-write", token: "stale-token", acquiredAt: "2000-01-01T00:00:00.000Z", expiresAt: "2000-01-01T00:00:30.000Z" })}\n`);
    const doctor = runJson(process.execPath, [cli, "doctor", root, "--hook-state", "supported", "--json"]); assert.equal(doctor.capabilities.lock.status, "残骸あり");
    runJson(process.execPath, [cli, "event", root, "--event-json", JSON.stringify({ type: "attention.override", itemId, actor: "lock-recovery", payload: { level: "high", reason: "lock recovery", rank: 0 } }), "--json"]); assert(!existsSync(join(root, ".clarity/lock.json")));
  });
  await test("GS-011", "Clarity managed filesにSecret 0件", () => {
    const all = []; const visit = (dir) => { for (const name of readdirSync(dir)) { const path = join(dir, name); const stat = lstatSync(path); if (stat.isSymbolicLink()) continue; if (stat.isDirectory()) visit(path); else all.push(readFileSync(path, "utf8")); } }; visit(join(root, ".clarity")); assert(!all.join("\n").includes("S047_CANARY_DO_NOT_EXPOSE_7d2f")); assert(!/api[_-]?token\s*[:=]/iu.test(all.join("\n")));
  });
  await test("GS-012", "Xmind credential candidateをRepoへ保存しない", () => { assert(!JSON.stringify(json(join(root, ".clarity/project.json"))).match(/credential|oauth|api[_-]?token/iu)); assert(!existsSync(join(root, ".clarity/xmind-credential.json"))); });
  await test("GS-013", "transcript／absolute pathをtracked metadataへ保存しない", () => {
    const canonical = ["project.json", "events.jsonl", "evidence.jsonl", "state.json"].map((name) => readFileSync(join(root, `.clarity/${name}`), "utf8")).join("\n"); assert(!canonical.includes(work)); assert(!canonical.includes("transcript"));
  });
  await test("GS-014", "projection再生成はplugin-ownedだけ", () => {
    const generatedBefore = readFileSync(join(root, "generated/lookup.js")); const preview = runJson(process.execPath, [cli, "project", root, "--json"]); assert.equal(preview.changed, false); runJson(process.execPath, [cli, "project", root, "--apply", "--json"]); assert.equal(readFileSync(join(root, "generated/lookup.js")).compare(generatedBefore), 0); assert(existsSync(join(root, ".clarity/projections/overview.md")));
  });
  await test("GS-015", "schema corruptionはsafe stopし明示rebuildだけが修復", () => {
    const eventPath = join(root, ".clarity/events.jsonl"); const eventBefore = readFileSync(eventPath); writeFileSync(eventPath, `${eventBefore.toString("utf8")}not-json\n`); const corrupt = readFileSync(eventPath); const rejected = runJson(process.execPath, [cli, "drift", root, "--input-file", inputFile(comparison({ operationId: "corrupt-events" }), "corrupt-events"), "--apply", "--json"], 3); assert.equal(rejected.code, "jsonl-invalid"); assert.equal(readFileSync(eventPath).compare(corrupt), 0); writeFileSync(eventPath, eventBefore);
    const statePath = join(root, ".clarity/state.json"); writeFileSync(statePath, "{broken\n"); const stateCorrupt = readFileSync(statePath); const rejectedState = runJson(process.execPath, [cli, "drift", root, "--input-file", inputFile(comparison({ operationId: "corrupt-state" }), "corrupt-state"), "--apply", "--json"], 3); assert.equal(rejectedState.code, "state-json-invalid"); assert.equal(readFileSync(statePath).compare(stateCorrupt), 0); const rebuilt = runJson(process.execPath, [cli, "rebuild", root, "--json"]); assert.equal(rebuilt.changed, true); assert(json(statePath));
  });

  const actual = results.map((row) => row.id); const missing = expected.filter((id) => !actual.includes(id)); const extraIds = actual.filter((id) => !expected.includes(id)); const duplicate = actual.filter((id, index) => actual.indexOf(id) !== index); const failed = results.filter((row) => !row.ok); const supplementalFailed = supplemental.filter((row) => !row.ok);
  assert.deepEqual({ missing, extra: extraIds, duplicate }, { missing: [], extra: [], duplicate: [] }); assert.equal(results.length, 25); assert.equal(failed.length, 0, `failed: ${failed.map((row) => row.id).join(",")}`); assert.equal(supplementalFailed.length, 0, `supplemental failed: ${supplementalFailed.map((row) => row.id).join(",")}`);
  const critical = new Set(["DR-001", "DR-004", "DR-010", "GS-001", "GS-002", "GS-003", "GS-004", "GS-005", "GS-006", "GS-007", "GS-008", "GS-009", "GS-011", "GS-012", "GS-013", "GS-015"]); assert.equal(results.filter((row) => critical.has(row.id) && row.ok).length, critical.size);
  process.stdout.write(`SPRINT047_TEST_PASS=25 FAIL=0 REGISTRY_MISSING=0 REGISTRY_DUPLICATE=0 REGISTRY_EXTRA=0 CRITICAL=${critical.size}/${critical.size} AC=7/7 STRESS_CLI=32 STRESS_HOOK=32 EVENT_PARSE=100% EVENT_UNIQUE=100% STATE_REBUILD=100% SUPPLEMENTAL=2\n`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
