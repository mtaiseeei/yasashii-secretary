#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  appendEvent, applyInit, applyItemCorrection, applyRequirementIntake, attention, history,
  previewItemCorrection, previewRequirementIntake, rebuildState,
} from "../plugins/secretary/scripts/lib/clarity-core.mjs";
import { buildProjectionBundle, QUADRANT_VISUALS, stableCoordinate } from "../plugins/secretary/scripts/lib/clarity-projection.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(repo, "plugins/secretary/scripts/clarity.mjs");
const work = mkdtempSync(join(tmpdir(), "yasashii-s045-055-"));
const digest = createHash("sha256").update("selected section without stored body").digest("hex");
const results = [];
process.env.CLARITY_NOW = "2026-09-07T10:00:00.000Z";

function write(path, value) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); }
function stableId(prefix, value) { return `${prefix}_${createHash("sha256").update(value).digest("hex").slice(0, 20)}`; }
function json(path) { return JSON.parse(readFileSync(path, "utf8")); }
function lines(path) { return readFileSync(path, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse); }
function fixture(name) { const root = join(work, name); write(join(root, "README.md"), `# ${name}\n`); applyInit(root); return root; }
function sourceInput(claims = ["Selected source must preserve claim A", "Selected source must preserve claim B"], coverage = undefined) {
  return {
    source: { sourceId: "docs/spec/features.md", section: "F85", digest },
    ...(coverage ? { coverage } : {}),
    candidates: claims.map((claim, index) => ({ claim, title: `Claim ${index + 1}`, areaPath: "requirements/selected", gap: index ? "Adjacent section not inspected" : null })),
  };
}
function event(root, type, itemId, payload) { return appendEvent(root, { type, itemId, actor: "sprint-045-055-regression", payload }); }
function run(args, env = {}) { return spawnSync(process.execPath, [cli, ...args], { cwd: repo, encoding: "utf8", env: { ...process.env, ...env } }); }
async function test(name, fn) {
  try { await fn(); results.push({ name, status: "pass" }); process.stdout.write(`PASS ${name}\n`); }
  catch (error) { results.push({ name, status: "fail" }); process.stdout.write(`FAIL ${name}: ${error?.stack || error}\n`); }
}

try {
  await test("intake preview is read-only and coverage is explicit", () => {
    const root = fixture("preview");
    const before = ["events.jsonl", "evidence.jsonl", "state.json"].map((name) => readFileSync(join(root, ".clarity", name)));
    const preview = previewRequirementIntake(root, sourceInput(undefined, [
      { sourceId: "docs/spec/features.md", section: "F85", digest, status: "inspected", reason: "Selected section inspected" },
      { sourceId: "docs/spec/features.md", section: "F86", digest, status: "uninspected", reason: "Outside selected scope" },
    ]));
    assert.equal(preview.changed, false);
    assert.equal(preview.coverage[0].status, "inspected");
    assert.equal(preview.selectedScopeComplete, false);
    assert.deepEqual(preview.gaps.map((row) => row.status), ["uninspected"]);
    assert.equal(preview.requirementsComplete, false);
    assert.equal(preview.candidates.length, 2);
    assert.equal(applyRequirementIntake(root, preview, { decision: "rejected" }).changed, false);
    assert.equal(applyRequirementIntake(root, preview, { decision: "canceled" }).changed, false);
    assert.deepEqual(["events.jsonl", "evidence.jsonl", "state.json"].map((name) => readFileSync(join(root, ".clarity", name))), before);
    assert.throws(() => previewRequirementIntake(root, sourceInput(["unsafe"], [{ sourceId: "/private/source", section: "x", digest, status: "inspected", reason: "x" }])), { code: "source-metadata-unsafe" });
  });

  await test("selected claim only, retry, and distinct claim identity", () => {
    const root = fixture("identity");
    const preview = previewRequirementIntake(root, sourceInput());
    const firstId = preview.candidates[0].candidateId;
    const first = applyRequirementIntake(root, preview, { decision: "approved", selectedCandidateIds: [firstId], operationId: "intake-operation-a" });
    assert.equal(first.status, "saved");
    assert.deepEqual(first.unselected, [preview.candidates[1].candidateId]);
    const unrelated = rebuildState(root, { write: false }).state.items.find((item) => !item.requirementSource);
    event(root, "execution.changed", unrelated.itemId, { status: "in_progress" });
    const retry = applyRequirementIntake(root, preview, { decision: "approved", selectedCandidateIds: [firstId], operationId: "intake-operation-a" });
    assert.equal(retry.status, "unchanged");
    const refreshed = previewRequirementIntake(root, sourceInput());
    const second = applyRequirementIntake(root, refreshed, { decision: "approved", selectedCandidateIds: [refreshed.candidates[1].candidateId], operationId: "intake-operation-b" });
    assert.equal(second.status, "saved");
    const saved = rebuildState(root, { write: false }).state.items.filter((item) => item.requirementSource?.section === "F85");
    assert.equal(saved.length, 2);
    assert.equal(new Set(saved.map((item) => item.itemId)).size, 2);
    assert.equal(new Set(lines(join(root, ".clarity/evidence.jsonl")).filter((row) => row.source === "docs/spec/features.md").map((row) => row.evidenceId)).size, 2);
    const canonicalText = ["events.jsonl", "evidence.jsonl", "state.json"].map((name) => readFileSync(join(root, ".clarity", name), "utf8")).join("\n");
    assert(!canonicalText.includes("selected section without stored body"));
    assert(!canonicalText.includes(work));
  });

  await test("stale intake rejects unrelated concurrent change", () => {
    const root = fixture("intake-stale");
    const preview = previewRequirementIntake(root, sourceInput(["Stale candidate"]));
    const existing = rebuildState(root, { write: false }).state.items[0];
    event(root, "execution.changed", existing.itemId, { status: "in_progress" });
    assert.throws(() => applyRequirementIntake(root, preview, { decision: "approved", selectedCandidateIds: [preview.candidates[0].candidateId], operationId: "stale-intake" }), { code: "state-revision-stale" });
  });

  await test("late Evidence cleanup failure reports partial write and remaining selection", () => {
    const root = fixture("partial");
    const preview = previewRequirementIntake(root, sourceInput(["Partial A", "Partial B"]));
    process.env.CLARITY_TEST_MODE = "1";
    process.env.CLARITY_FS_FAILURES = JSON.stringify({ point: "canonical-cleanup", times: 1, code: "EPERM", syscall: "unlink" });
    const result = applyRequirementIntake(root, preview, { decision: "approved", selectedCandidateIds: preview.candidates.map((row) => row.candidateId), operationId: "partial-intake" });
    delete process.env.CLARITY_FS_FAILURES;
    delete process.env.CLARITY_TEST_MODE;
    assert.equal(result.status, "partial");
    assert.equal(result.changed, true);
    assert.equal(result.failed[0].evidenceSaved, true);
    assert.equal(result.failed[0].itemSaved, false);
    assert.deepEqual(result.unconfirmed, preview.candidates.map((row) => row.candidateId));
    assert.deepEqual(result.remainingSelected, [preview.candidates[1].candidateId]);

    const eventRoot = fixture("partial-event");
    const eventPreview = previewRequirementIntake(eventRoot, sourceInput(["Committed Item with late error"]));
    const operationId = "partial-event-intake";
    const projectId = rebuildState(eventRoot, { write: false }).state.clarityProjectId;
    const expectedEventId = stableId("cv", `${projectId}:requirements:${operationId}:${eventPreview.candidates[0].candidateId}`);
    const operationToken = createHash("sha256").update(`event-${expectedEventId}`).digest("hex").slice(0, 24);
    process.env.CLARITY_TEST_MODE = "1";
    process.env.CLARITY_FS_FAILURES = JSON.stringify({ point: "canonical-cleanup", target: `.clarity/.clarity-op-${operationToken}-events-jsonl-before.tmp`, times: 1, code: "EPERM", syscall: "unlink" });
    const eventResult = applyRequirementIntake(eventRoot, eventPreview, { decision: "approved", selectedCandidateIds: [eventPreview.candidates[0].candidateId], operationId });
    delete process.env.CLARITY_FS_FAILURES;
    delete process.env.CLARITY_TEST_MODE;
    assert.equal(eventResult.status, "partial");
    assert.equal(eventResult.changed, true);
    assert.equal(eventResult.failed[0].evidenceSaved, true);
    assert.equal(eventResult.failed[0].itemSaved, true);
    assert(rebuildState(eventRoot, { write: false }).state.items.some((item) => item.itemId === eventPreview.candidates[0].itemId));
  });

  await test("title correction preserves validation; claim correction invalidates it", () => {
    const root = fixture("correction");
    const intake = previewRequirementIntake(root, sourceInput(["Original claim"]));
    const saved = applyRequirementIntake(root, intake, { decision: "approved", selectedCandidateIds: [intake.candidates[0].candidateId], operationId: "correction-seed" });
    const originalId = saved.confirmed[0].itemId;
    const evidenceId = saved.confirmed[0].evidenceId;
    event(root, "decision.confirmed", originalId, { source: "human", humanConfirmed: true, authority: "human-confirmation" });
    event(root, "execution.changed", originalId, { status: "implemented" });
    event(root, "evidence.linked", originalId, { section: "validation", evidenceId });
    event(root, "validation.changed", originalId, { status: "passed" });
    const titlePreview = previewItemCorrection(root, { itemId: originalId, reason: "Title typo", changes: { title: "Correct title" } });
    assert.equal(titlePreview.replacement.validation.invalidated, false);
    const beforeDecision = readFileSync(join(root, ".clarity/state.json"));
    assert.equal(applyItemCorrection(root, titlePreview, { decision: "rejected" }).changed, false);
    assert.equal(applyItemCorrection(root, titlePreview, { decision: "canceled" }).changed, false);
    assert.deepEqual(readFileSync(join(root, ".clarity/state.json")), beforeDecision);
    const titleApplied = applyItemCorrection(root, titlePreview, { decision: "approved" });
    assert.equal(applyItemCorrection(root, titlePreview, { decision: "approved" }).status, "unchanged");
    let state = rebuildState(root, { write: false }).state;
    assert.equal(state.items.find((item) => item.itemId === originalId).activeMatrix, false);
    assert.equal(state.items.find((item) => item.itemId === titleApplied.replacementItemId).validation.status, "passed");
    assert(!attention(root, { limit: 20 }).items.some((item) => item.itemId === originalId));
    const associationInput = join(root, "association-correction.json");
    write(associationInput, `${JSON.stringify({ itemId: titleApplied.replacementItemId, reason: "Validation source corrected", changes: { evidenceAssociations: { validation: [] } } })}\n`);
    const conversationPreview = run(["correction-preview", root, "--input-file", associationInput]);
    assert.equal(conversationPreview.status, 0, conversationPreview.stderr);
    assert(conversationPreview.stdout.includes(`Evidence validation: ${evidenceId} -> なし`));
    assert.equal(rebuildState(root, { write: false }).state.items.length, state.items.length);
    const claimPreview = previewItemCorrection(root, { itemId: titleApplied.replacementItemId, reason: "Claim meaning corrected", changes: { claim: "Corrected claim" } });
    assert.equal(claimPreview.replacement.validation.invalidated, true);
    const claimApplied = applyItemCorrection(root, claimPreview, { decision: "approved" });
    state = rebuildState(root, { write: false }).state;
    assert.equal(state.items.find((item) => item.itemId === claimApplied.replacementItemId).validation.status, "pending");
    const associationPreview = previewItemCorrection(root, { itemId: claimApplied.replacementItemId, reason: "Wrong validation association", changes: { evidenceAssociations: { validation: [] } } });
    const associationApplied = applyItemCorrection(root, associationPreview, { decision: "approved" });
    state = rebuildState(root, { write: false }).state;
    assert.deepEqual(state.items.find((item) => item.itemId === associationApplied.replacementItemId).validation.evidenceRefs, []);
    const correctionHistory = history(root).events.filter((row) => row.type === "item.corrected");
    assert.deepEqual(correctionHistory.map((row) => row.correction.reason), ["Title typo", "Claim meaning corrected", "Wrong validation association"]);
    assert.deepEqual(correctionHistory.at(-1).correction.oldAssociations.validation, [evidenceId]);
    assert.deepEqual(json(join(root, ".clarity/state.json")), state);
  });

  await test("correction stale check preserves append-only history", () => {
    const root = fixture("correction-stale");
    const item = rebuildState(root, { write: false }).state.items[0];
    const preview = previewItemCorrection(root, { itemId: item.itemId, reason: "Rename", changes: { title: "Renamed" } });
    event(root, "execution.changed", item.itemId, { status: "in_progress" });
    assert.throws(() => applyItemCorrection(root, preview, { decision: "approved" }), { code: "state-revision-stale" });
    assert.equal(history(root).events.filter((row) => row.type === "item.corrected").length, 0);
  });

  await test("validation overlays are strict and Xmind visuals remain fixed", () => {
    const root = fixture("projection");
    const preview = previewRequirementIntake(root, sourceInput(["Valid complete", "Broken mixed refs", "Pending validation", "Failed validation", "Waived validation", "Future idea", "Rejected history"]));
    const saved = applyRequirementIntake(root, preview, { decision: "approved", selectedCandidateIds: preview.candidates.map((row) => row.candidateId), operationId: "projection-seed" });
    const [valid, broken, pending, failed, waived, idea, rejected] = saved.confirmed;
    for (const row of [valid, broken, pending, failed, waived]) {
      event(root, "decision.confirmed", row.itemId, { source: "human", humanConfirmed: true, authority: "human-confirmation" });
      event(root, "execution.changed", row.itemId, { status: "implemented" });
      event(root, "evidence.linked", row.itemId, { section: "validation", evidenceId: row.evidenceId });
    }
    event(root, "validation.changed", valid.itemId, { status: "passed" });
    event(root, "validation.changed", broken.itemId, { status: "passed" });
    event(root, "validation.changed", pending.itemId, { status: "pending" });
    event(root, "validation.changed", failed.itemId, { status: "failed" });
    event(root, "validation.changed", waived.itemId, { status: "waived" });
    event(root, "evidence.linked", broken.itemId, { section: "validation", evidenceId: "ce_00000000000000000000" });
    event(root, "disposition.changed", idea.itemId, { disposition: "idea" });
    event(root, "decision.rejected", rejected.itemId, { humanConfirmed: true });
    const beforeState = rebuildState(root, { write: false }).state;
    const correction = previewItemCorrection(root, { itemId: valid.itemId, reason: "Projection history", changes: { title: "Valid complete renamed" } });
    applyItemCorrection(root, correction, { decision: "approved" });
    const state = rebuildState(root, { write: false }).state;
    const bundle = buildProjectionBundle(root);
    const historical = state.items.filter((item) => item.activeMatrix === false && (item.correction?.status === "replaced" || ["rejected", "superseded"].includes(item.decision.status) || item.disposition === "rejected")).length;
    const active = state.items.filter((item) => item.activeMatrix !== false).length;
    assert(bundle.files["overview.md"].includes(`active matrix ${active}件 / excluded 0件 / historical ${historical}件 / total ${state.items.length}件`));
    assert(bundle.files["overview.md"].includes("検証済み完了: 1件"));
    assert(bundle.files["overview.md"].includes("pending 1 / passed 2 / failed 1 / waived 1"));
    assert(bundle.files["matrix.md"].includes(`| ${broken.itemId} |`));
    assert(bundle.files["matrix.md"].includes("passed | no"));
    assert(bundle.files["quadrant.mmd"].includes("x-axis 進めている --> まだ進めていない"));
    assert(!attention(root, { limit: 20 }).items.some((row) => row.itemId === idea.itemId));
    for (const [key, visual] of Object.entries(QUADRANT_VISUALS)) assert.equal(QUADRANT_VISUALS[key], visual);
    for (const item of beforeState.items) assert.deepEqual(stableCoordinate(item), stableCoordinate(item));
  });

  await test("CLI preview and selected confirmation", () => {
    const root = fixture("cli");
    const candidateFile = join(root, "candidates.json");
    const previewFile = join(root, "preview.json");
    write(candidateFile, `${JSON.stringify(sourceInput(["CLI candidate"]))}\n`);
    const previewRun = run(["requirements-preview", root, "--input-file", candidateFile, "--json"]);
    assert.equal(previewRun.status, 0, previewRun.stderr);
    const preview = JSON.parse(previewRun.stdout);
    assert.equal(preview.preview.changed, false);
    write(previewFile, previewRun.stdout);
    const applyRun = run(["requirements-apply", root, "--input-file", previewFile, "--select", preview.preview.candidates[0].candidateId, "--decision", "approved", "--operation-id", "cli-operation", "--json"]);
    assert.equal(applyRun.status, 0, applyRun.stderr);
    assert.equal(JSON.parse(applyRun.stdout).status, "saved");
  });
} finally {
  delete process.env.CLARITY_NOW;
  delete process.env.CLARITY_TEST_MODE;
  delete process.env.CLARITY_FS_FAILURES;
  rmSync(work, { recursive: true, force: true });
}

const failed = results.filter((row) => row.status === "fail");
process.stdout.write(`SPRINT045_055_PASS=${results.length - failed.length} FAIL=${failed.length} TOTAL=${results.length}\n`);
if (failed.length) process.exit(1);
