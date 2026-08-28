#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ClarityError,
  appendEvent,
  applyInit,
  applyMigration,
  applyRuntimeCleanup,
  attention,
  checkpoint,
  doctor,
  evaluateAttention,
  history,
  previewMigration,
  previewRuntimeCleanup,
  rebuildState,
  setAttentionOverride,
} from "../plugins/secretary/scripts/lib/clarity-core.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(repo, "plugins/secretary/scripts/clarity.mjs");
const work = mkdtempSync(join(tmpdir(), "agentic-s042-"));
const fixedNow = "2026-08-28T10:30:00.000Z";
process.env.CLARITY_NOW = fixedNow;
process.env.CC_SECRETARY_NOW = fixedNow;

const expected = [
  ...Array.from({ length: 14 }, (_, index) => `AT-${String(index + 1).padStart(3, "0")}`),
  "AT-016", "AT-017", "AT-018",
  "IM-001", "IM-004", "IM-006", "IM-007", "IM-008", "IM-009", "IM-013", "IM-014",
  ...Array.from({ length: 10 }, (_, index) => `UX-${String(index + 1).padStart(3, "0")}`),
];
const results = [];
const proofId = "ce_11111111111111111111";

function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function write(path, value) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); }
function json(path) { return JSON.parse(readFileSync(path, "utf8")); }
function lines(path) { return readFileSync(path, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse); }
function tree(root) {
  const rows = [];
  function visit(dir) {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name); const rel = path.slice(root.length + 1); const stat = lstatSync(path);
      if (stat.isDirectory()) { rows.push([rel, "dir"]); visit(path); } else rows.push([rel, "file", sha(readFileSync(path))]);
    }
  }
  visit(root); return sha(JSON.stringify(rows));
}
function run(args, options = {}) { return spawnSync(process.execPath, [cli, ...args], { cwd: repo, encoding: "utf8", env: { ...process.env, ...(options.env || {}) } }); }
function fixture(name) { const root = join(work, name); write(join(root, "README.md"), `# ${name}\n`); applyInit(root); return root; }
function firstItem(root) { return json(join(root, ".clarity/state.json")).items[0]; }
function mutate(root, type, payload) { return appendEvent(root, { type, itemId: firstItem(root).itemId, actor: "sprint-042-test", payload }); }
function expectCode(fn, code) { let caught; try { fn(); } catch (error) { caught = error; } assert(caught instanceof ClarityError); assert.equal(caught.code, code); return caught; }
async function test(id, title, fn) {
  assert(expected.includes(id), `unknown case: ${id}`); assert(!results.some((row) => row.id === id), `duplicate case: ${id}`);
  try { await fn(); results.push({ id, ok: true }); process.stdout.write(`PASS ${id} ${title}\n`); }
  catch (error) { results.push({ id, ok: false }); process.stdout.write(`FAIL ${id} ${title}: ${error?.stack || error}\n`); }
}
function evidence(id = proofId, summary = "決定と実装を確認した根拠") {
  return { schemaVersion: 2, evidenceId: id, type: "file-reference", source: "synthetic-canonical", locator: { path: "docs/proof.md" }, summary, observedAt: fixedNow, contentDigest: sha(id), sensitivity: "non-secret-reference", availability: "available" };
}
function stableItem(hex = "1") {
  const timestamp = fixedNow;
  return {
    schemaVersion: 2, itemId: `ci_${hex.repeat(20)}`, title: `項目${hex}`, areaPath: `src/${hex}.mjs`, kind: "implementation", disposition: "candidate", deferredUntil: null,
    owner: "担当者", decisionOwner: "決定者", dependencies: [], externalRefs: [], confidence: "verified", timestamps: { createdAt: timestamp, updatedAt: timestamp },
    attention: { level: "none", reasons: [] }, attentionContext: { impact: 0, urgency: 0, humanOverride: null, signals: [] },
    decision: { status: "confirmed", source: "user-confirmation", humanConfirmed: true, authority: "project-decision-canonical", evidenceRefs: [proofId], updatedAt: timestamp },
    execution: { status: "implemented", authority: "repository-observation", evidenceRefs: [proofId], updatedAt: timestamp },
    validation: { status: "passed", evidenceRefs: [proofId], updatedAt: timestamp }, alignment: { status: "aligned", evidenceRefs: [proofId], updatedAt: timestamp },
  };
}
function report(items, proofs = [evidence()], options = {}) { return evaluateAttention({ schemaVersion: 2, items }, proofs, { clock: fixedNow, limit: 3, ...options }); }
function reason(row, value) { assert(row.reasons.includes(value), `${value} missing: ${JSON.stringify(row.reasons)}`); }
function makeV1(root, mutateUnknown = false) {
  const projectPath = join(root, ".clarity/project.json"); const eventsPath = join(root, ".clarity/events.jsonl"); const evidencePath = join(root, ".clarity/evidence.jsonl"); const statePath = join(root, ".clarity/state.json");
  const project = json(projectPath); project.schemaVersion = 1; project.compatibility = { reader: { min: 1, max: 1 }, writer: { min: 1, max: 1 } }; if (mutateUnknown) project.futureProjectField = { keep: true }; writeFileSync(projectPath, `${JSON.stringify(project, null, 2)}\n`);
  const events = lines(eventsPath).map((row) => ({ ...row, schemaVersion: 1, payload: row.type === "item.discovered" ? { ...row.payload, item: { ...row.payload.item, schemaVersion: 1, ...(mutateUnknown ? { futureItemField: "keep" } : {}) } } : row.payload, ...(mutateUnknown ? { futureEventField: "keep" } : {}) })); writeFileSync(eventsPath, `${events.map(JSON.stringify).join("\n")}\n`);
  const proofs = lines(evidencePath).map((row) => ({ ...row, schemaVersion: 1, ...(mutateUnknown ? { futureEvidenceField: "keep" } : {}) })); writeFileSync(evidencePath, `${proofs.map(JSON.stringify).join("\n")}\n`);
  const state = json(statePath); state.schemaVersion = 1; state.items = state.items.map((row) => ({ ...row, schemaVersion: 1 })); if (mutateUnknown) state.futureStateField = { keep: true }; writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

try {
  await test("AT-001", "無承認実装はHigh", () => { const item = stableItem(); item.decision.status = "proposed"; const row = report([item]).items[0]; assert.equal(row.level, "high"); reason(row, "implemented_without_confirmed_decision"); assert(row.reasonLabels[0].includes("確認済みの決定")); });
  await test("AT-002", "決定済み未実行はMedium", () => { const item = stableItem(); item.execution.status = "not_started"; const row = report([item]).items[0]; assert.equal(row.level, "medium"); reason(row, "confirmed_but_not_executed"); });
  await test("AT-003", "合成canonical driftはCriticalかつ両根拠", () => { const item = stableItem(); const execId = "ce_22222222222222222222"; item.execution.evidenceRefs = [execId]; item.alignment.status = "drift"; const row = report([item], [evidence(), evidence(execId, "現在実装の根拠")]).items[0]; assert.equal(row.level, "critical"); reason(row, "decision_implementation_drift"); assert.equal(row.evidence.length, 2); });
  await test("AT-004", "possible driftを断定しない", () => { const item = stableItem(); item.alignment.status = "possible_drift"; const row = report([item]).items[0]; assert.equal(row.level, "high"); reason(row, "possible_drift"); assert(row.reasonLabels[0].includes("可能性")); assert(!row.reasonLabels[0].includes("一致しません")); });
  await test("AT-005", "validation失敗はCritical", () => { const item = stableItem(); item.validation.status = "failed"; const row = report([item]).items[0]; assert.equal(row.level, "critical"); reason(row, "validation_failed"); });
  await test("AT-006", "validation pendingを固定時刻で判定", () => { const item = stableItem(); item.validation.status = "pending"; item.validation.updatedAt = "2026-08-01T00:00:00.000Z"; const row = report([item]).items[0]; assert.equal(row.level, "high"); reason(row, "validation_pending_too_long"); });
  await test("AT-007", "未決定長期滞留はMedium", () => { const item = stableItem(); item.decision.status = "exploring"; item.execution.status = "not_started"; item.decision.updatedAt = "2026-06-01T00:00:00.000Z"; const row = report([item]).items[0]; assert.equal(row.level, "medium"); reason(row, "undecided_stale"); });
  await test("AT-008", "合成canonical authority conflictはCritical", () => { const item = stableItem(); item.attentionContext.signals = ["authority_conflict"]; const row = report([item]).items[0]; assert.equal(row.level, "critical"); reason(row, "authority_conflict"); });
  await test("AT-009", "合成canonical sync conflictはHigh", () => { const item = stableItem(); item.attentionContext.signals = ["sync_conflict"]; const row = report([item]).items[0]; assert.equal(row.level, "high"); reason(row, "sync_conflict"); });
  await test("AT-010", "根拠不足はMedium", () => { const item = stableItem(); item.decision.evidenceRefs = []; item.execution.evidenceRefs = []; item.validation.evidenceRefs = []; const row = report([item], []).items[0]; assert.equal(row.level, "medium"); reason(row, "missing_evidence"); assert(row.evidence[0].summary.includes("根拠不足")); });
  await test("AT-011", "依存未解決を表示", () => { const item = stableItem(); item.dependencies = ["ci_99999999999999999999"]; const row = report([item]).items[0]; assert.equal(row.level, "medium"); reason(row, "dependency_blocked"); });
  await test("AT-012", "決定者未設定を表示", () => { const item = stableItem(); item.decision.status = "exploring"; item.execution.status = "not_started"; item.decisionOwner = null; const row = report([item]).items[0]; assert.equal(row.level, "medium"); reason(row, "decision_owner_missing"); });
  await test("AT-013", "ideaは既定Attention外", () => { const item = stableItem(); item.disposition = "idea"; item.alignment.status = "drift"; assert.equal(report([item]).activeCount, 0); });
  await test("AT-014", "人間overrideを決定的に優先", () => { const a = stableItem("a"); const b = stableItem("b"); a.alignment.status = "possible_drift"; b.alignment.status = "possible_drift"; b.attentionContext.humanOverride = { level: "high", rank: 10, reason: "利用者が先に確認すると指定" }; const rows = report([a, b]).items; assert.equal(rows[0].itemId, b.itemId); assert.equal(rows[0].humanOverride.reason, "利用者が先に確認すると指定"); const root = fixture("at014"); const saved = setAttentionOverride(root, { itemId: firstItem(root).itemId, level: "critical", reason: "利用者が最優先に指定", operationId: "op-at014" }); assert.equal(saved.status, "saved"); assert.equal(attention(root).items[0].level, "critical"); assert.equal(setAttentionOverride(root, { itemId: firstItem(root).itemId, level: "critical", reason: "利用者が最優先に指定", operationId: "op-at014" }).status, "unchanged"); });
  await test("AT-016", "同点はItem IDでstable", () => { const a = stableItem("a"); const b = stableItem("b"); a.alignment.status = "possible_drift"; b.alignment.status = "possible_drift"; const first = report([b, a]).items.map((row) => row.itemId); const second = report([a, b]).items.map((row) => row.itemId); assert.deepEqual(first, second); assert.deepEqual(first, [a.itemId, b.itemId]); });
  await test("AT-017", "解消済みAttentionはactive外でhistory保持", () => { const root = fixture("at017"); checkpoint(root, { operationId: "op-at017-before" }); const id = lines(join(root, ".clarity/evidence.jsonl"))[0].evidenceId; mutate(root, "decision.confirmed", { source: "user-confirmation", humanConfirmed: true }); mutate(root, "execution.changed", { status: "implemented" }); mutate(root, "validation.changed", { status: "passed" }); for (const section of ["execution", "validation"]) mutate(root, "evidence.linked", { section, evidenceId: id }); checkpoint(root, { operationId: "op-at017-after" }); assert.equal(attention(root).activeCount, 0); assert(history(root).resolvedAttention.some((row) => row.reason === "decision_owner_missing")); });
  await test("AT-018", "不透明なClarity scoreを出さず全理由を件数化", () => { const item = stableItem(); item.alignment.status = "possible_drift"; const output = JSON.stringify(report([item])); assert(!/clarity.?score|ai.?score|"score"/iu.test(output)); assert.equal(report([item]).counts.high, 1); const unreachable = evidence(); unreachable.availability = "source_unreachable"; const low = report([stableItem()], [unreachable]).items[0]; assert.equal(low.level, "low"); reason(low, "source_unreachable"); });

  await test("IM-001", "checkpoint partial retryでEvent/Evidence重複0", () => { const root = fixture("im001"); expectCode(() => checkpoint(root, { operationId: "op-im001", failAt: "after-evidence" }), "checkpoint-partial"); const evidenceBefore = lines(join(root, ".clarity/evidence.jsonl")).length; checkpoint(root, { operationId: "op-im001" }); checkpoint(root, { operationId: "op-im001" }); assert.equal(lines(join(root, ".clarity/evidence.jsonl")).length, evidenceBefore); assert.equal(lines(join(root, ".clarity/events.jsonl")).filter((row) => row.type === "checkpoint.recorded" && row.payload.operationId === "op-im001").length, 1); });
  await test("IM-004", "State rebuildはbyte同一", () => { const root = fixture("im004"); const first = rebuildState(root); const second = rebuildState(root); assert.equal(first.bytes, second.bytes); assert.equal(first.digest, second.digest); assert.equal(second.changed, false); });
  await test("IM-006", "migration previewはwrite 0", () => { const root = fixture("im006"); makeV1(root); const before = tree(root); const plan = previewMigration(root); assert.equal(plan.status, "preview"); assert.equal(plan.changed, false); assert.equal(tree(root), before); });
  await test("IM-007", "migration applyは履歴保持してv2へ", () => { const root = fixture("im007"); makeV1(root); const beforeEvents = lines(join(root, ".clarity/events.jsonl")).map((row) => row.eventId); const result = applyMigration(root); assert.equal(result.status, "migrated"); assert.equal(json(join(root, ".clarity/project.json")).schemaVersion, 2); assert.deepEqual(lines(join(root, ".clarity/events.jsonl")).map((row) => row.eventId), beforeEvents); assert.equal(applyMigration(root).status, "unchanged"); });
  await test("IM-008", "migration failureは旧schemaを利用可能に保持", () => { const root = fixture("im008"); makeV1(root); const before = tree(root); expectCode(() => applyMigration(root, { failAt: "after-backup" }), "migration-failed"); assert.equal(tree(root), before); assert.equal(json(join(root, ".clarity/project.json")).schemaVersion, 1); assert.equal(attention(root).activeCount >= 0, true); assert.equal(applyMigration(root).status, "migrated"); });
  await test("IM-009", "unknown fieldをroundtrip保持", () => { const root = fixture("im009"); makeV1(root, true); applyMigration(root); assert.deepEqual(json(join(root, ".clarity/project.json")).futureProjectField, { keep: true }); assert.equal(lines(join(root, ".clarity/events.jsonl"))[0].futureEventField, "keep"); assert.equal(lines(join(root, ".clarity/events.jsonl"))[0].payload.item.futureItemField, "keep"); assert.equal(lines(join(root, ".clarity/evidence.jsonl"))[0].futureEvidenceField, "keep"); assert.deepEqual(json(join(root, ".clarity/state.json")).futureStateField, { keep: true }); });
  await test("IM-013", "doctorがstale runtimeとcleanup previewを示す", () => { const root = fixture("im013"); write(join(root, ".clarity/runtime/lock.json"), `${JSON.stringify({ owner: "agentic-secretary:clarity", expiresAt: "2026-08-01T00:00:00.000Z" })}\n`); const report = doctor(root); assert.equal(report.capabilities.lock.status, "残骸あり"); assert.equal(report.runtimeCleanup.candidates.length, 1); assert.equal(existsSync(join(root, ".clarity/runtime/lock.json")), true); });
  await test("IM-014", "cleanup applyはowned stale runtimeだけ削除しretryで収束", () => {
    const preservedRoot = fixture("im014-preserved");
    write(join(preservedRoot, ".clarity/runtime/lock.json"), `${JSON.stringify({ owner: "agentic-secretary:clarity", expiresAt: "2026-08-01T00:00:00.000Z" })}\n`);
    write(join(preservedRoot, ".clarity/runtime/user-note.txt"), "keep\n");
    write(join(preservedRoot, ".clarity/runtime/operation-live.json"), `${JSON.stringify({ owner: "agentic-secretary:clarity", expiresAt: "2026-09-01T00:00:00.000Z" })}\n`);
    const preview = previewRuntimeCleanup(preservedRoot);
    assert.equal(preview.changed, false);
    const result = applyRuntimeCleanup(preservedRoot);
    assert.deepEqual(result.removed, [".clarity/runtime/lock.json"]);
    assert.equal(result.changed, true);
    assert.equal(result.runtimeDirectory.reason, "not-empty");
    assert(!existsSync(join(preservedRoot, ".clarity/runtime/lock.json")));
    assert(existsSync(join(preservedRoot, ".clarity/runtime/user-note.txt")));
    assert(existsSync(join(preservedRoot, ".clarity/runtime/operation-live.json")));

    const onlyExpiredRoot = fixture("im014-only-expired-owned");
    const onlyExpiredRuntime = join(onlyExpiredRoot, ".clarity/runtime");
    write(join(onlyExpiredRuntime, "lock.json"), `${JSON.stringify({ owner: "agentic-secretary:clarity", expiresAt: "2026-08-01T00:00:00.000Z" })}\n`);
    const cliPreview = run(["cleanup", onlyExpiredRoot, "--json"]);
    assert.equal(cliPreview.status, 0, cliPreview.stderr);
    const previewOutput = JSON.parse(cliPreview.stdout);
    assert.equal(previewOutput.changed, false);
    assert.equal(previewOutput.candidates.length, 1);
    assert(existsSync(join(onlyExpiredRuntime, "lock.json")));
    const cliApply = run(["cleanup", onlyExpiredRoot, "--apply", "--json"]);
    assert.equal(cliApply.status, 0, cliApply.stderr);
    const applyOutput = JSON.parse(cliApply.stdout);
    assert.equal(applyOutput.status, "cleaned");
    assert.equal(applyOutput.changed, true);
    assert.deepEqual(applyOutput.removed, [".clarity/runtime/lock.json"]);
    assert.equal(applyOutput.runtimeDirectory.removed, true);
    assert(!existsSync(join(onlyExpiredRuntime, "lock.json")));
    assert(!existsSync(onlyExpiredRuntime));
    const cliRetry = run(["cleanup", onlyExpiredRoot, "--apply", "--json"]);
    assert.equal(cliRetry.status, 0, cliRetry.stderr);
    const retryOutput = JSON.parse(cliRetry.stdout);
    assert.equal(retryOutput.status, "unchanged");
    assert.equal(retryOutput.changed, false);
    assert.deepEqual(retryOutput.removed, []);
    assert(!existsSync(onlyExpiredRuntime));

    const emptyRoot = fixture("im014-empty-runtime");
    const emptyRuntime = join(emptyRoot, ".clarity/runtime");
    mkdirSync(emptyRuntime, { recursive: true });
    const emptyApply = run(["cleanup", emptyRoot, "--apply", "--json"]);
    assert.equal(emptyApply.status, 0, emptyApply.stderr);
    const emptyOutput = JSON.parse(emptyApply.stdout);
    assert.equal(emptyOutput.status, "unchanged");
    assert.equal(emptyOutput.changed, false);
    assert.deepEqual(emptyOutput.removed, []);
    assert(existsSync(emptyRuntime));
  });

  await test("UX-001", "日本語UI", () => { const root = fixture("ux001"); const output = run(["attention", root]).stdout; assert(output.includes("人間が考える必要")); assert(output.includes("理由:")); });
  await test("UX-002", "結論・理由・根拠・選択", () => { const root = fixture("ux002"); const output = run(["attention", root]).stdout; for (const marker of ["確認が必要", "理由:", "根拠:", "選択:"]) assert(output.includes(marker), marker); });
  await test("UX-003", "多数でも上位3件とその他件数", () => { const items = ["1", "2", "3", "4", "5"].map((hex) => { const item = stableItem(hex); item.alignment.status = "possible_drift"; return item; }); const value = report(items); assert.equal(value.items.length, 3); assert.equal(value.otherCount, 2); });
  await test("UX-004", "AI推定を明示", () => { const item = stableItem(); item.alignment.status = "possible_drift"; item.decision.source = "agent-inference"; item.confidence = "unknown"; assert.equal(report([item]).items[0].inference, true); });
  await test("UX-005", "未検証を断定しない", () => { const item = stableItem(); item.alignment.status = "possible_drift"; item.validation.status = "unknown"; assert.equal(report([item]).items[0].unverified, true); });
  await test("UX-006", "technical handoffにcommand/path/error/Evidence/残課題", () => { const root = fixture("ux006"); const value = JSON.parse(run(["attention", root, "--json"]).stdout); assert(value.technicalHandoff.command); assert(value.technicalHandoff.path); assert(Array.isArray(value.technicalHandoff.evidenceIds)); assert.equal(typeof value.technicalHandoff.remainingCount, "number"); const error = JSON.parse(run(["migrate", join(work, "missing"), "--json"]).stderr); assert(error.code); assert.equal(error.changed, false); assert(error.nextAction); });
  await test("UX-007", "matrix labelを統一", () => { const root = fixture("ux007"); assert(run(["status", root]).stdout.includes("決定×実行クラリティマトリクス")); });
  await test("UX-008", "旧英語象限labelを通常表示しない", () => { const root = fixture("ux008"); const output = run(["status", root]).stdout; assert(!/\b(?:stabilize|execute|validate|decide)\b/u.test(output)); for (const label of ["定着・検証", "実行待ち", "暫定実装・要再確認", "設計・意思決定"]) assert(output.includes(label)); });
  await test("UX-009", "Attentionなしを安心できる短文で表示", () => { const item = stableItem(); const value = report([item]); assert.equal(value.activeCount, 0); assert.equal(value.conclusion, "現在、判断が必要な項目はありません"); assert.equal(value.items.length, 0); });
  await test("UX-010", "errorは変更有無と次の一手を示す", () => { const root = fixture("ux010"); makeV1(root); const result = run(["migrate", root, "--apply", "--json"], { env: { CLARITY_MIGRATION_FAIL_AT: "before-swap" } }); assert.equal(result.status, 4); const output = JSON.parse(result.stderr); assert.equal(output.code, "migration-failed"); assert.equal(output.changed, false); assert(output.message.includes("旧schema")); assert(output.nextAction.includes("再実行")); });
} finally {
  delete process.env.CLARITY_NOW; delete process.env.CC_SECRETARY_NOW; delete process.env.CLARITY_MIGRATION_FAIL_AT; delete process.env.CLARITY_CHECKPOINT_FAIL_AT;
  rmSync(work, { recursive: true, force: true });
}

const registryText = readFileSync(join(repo, "scripts/fixtures/sprint-042/clarity-acceptance.md"), "utf8");
const registry = JSON.parse(registryText.match(/<!-- clarity-acceptance-registry:start -->\s*```json\s*([\s\S]*?)\s*```/u)?.[1] || "null");
assert(registry, "clarity registry missing");
assert.deepEqual(registry.primaryCaseIds["sprint-042"], expected, "repo registry missing/extra/order mismatch");
assert.equal(new Set(expected).size, expected.length, "target registry duplicate");
assert.deepEqual(results.map((row) => row.id), expected, "35-case execution missing/duplicate/order mismatch");
const failed = results.filter((row) => !row.ok);
process.stdout.write(`SPRINT042_REGISTRY_MISSING=0 DUPLICATE=0 EXTRA=0\n`);
process.stdout.write(`SPRINT042_CASE_PASS=${results.length - failed.length} FAIL=${failed.length} TOTAL=${results.length}\n`);
if (failed.length) process.exit(1);
