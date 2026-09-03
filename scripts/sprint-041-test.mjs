#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  emitReceipt,
  FIXED,
  inspectPrewrite,
  PrewriteError,
  sha256,
  stable,
  validatePrivateReceiptDocument,
  validatePublicHandoffDocument,
  validateFixedInputFile,
  verifyReceipt,
} from "./lib/sprint-041-prewrite.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const handoffPath = FIXED.publicHandoffPath;
const privateReceiptPath = FIXED.privateReceiptPath;
const baseOptions = { root, baseRoot: null, handoffPath, privateReceiptPath, privateFeedbackCommit: FIXED.privateFeedbackCommit };
const handoff = JSON.parse(readFileSync(handoffPath, "utf8"));
const privateReceipt = JSON.parse(readFileSync(privateReceiptPath, "utf8"));
const clone = (value) => structuredClone(value);
let pass = 0;
let fail = 0;

function check(label, fn) {
  try { fn(); pass += 1; console.log(`PASS ${label}`); }
  catch (error) { fail += 1; console.error(`FAIL ${label}: ${error.stack || error.message}`); }
}

function expectCode(code, fn) {
  assert.throws(fn, (error) => error instanceof PrewriteError && error.code === code, `expected ${code}`);
}

function materializeBase(destination) {
  mkdirSync(destination, { recursive: false });
  const archive = spawnSync("git", ["-C", root, "archive", "--format=tar", FIXED.yasashiiBase], { encoding: null, maxBuffer: 64 * 1024 * 1024 });
  assert.equal(archive.status, 0, String(archive.stderr));
  const untar = spawnSync("tar", ["-xf", "-", "-C", destination], { input: archive.stdout, maxBuffer: 64 * 1024 * 1024 });
  assert.equal(untar.status, 0, String(untar.stderr));
}

function copySource(destination) {
  cpSync(root, destination, { recursive: true, filter: (source) => !source.endsWith("/.git") && !source.includes("/node_modules") });
}

check("fixed inputs pass before any Clarity product write", () => {
  const result = inspectPrewrite(baseOptions);
  assert.equal(result.summary.productPaths, 46);
  assert.equal(result.summary.byteSync, 16);
  assert.equal(result.summary.adapted, 30);
  assert.equal(result.summary.protectedGroups, 9);
  assert.ok(result.summary.roleOwned >= 13);
  assert.ok(result.summary.gateOwned >= 4);
  assert.equal(result.summary.observedProductWrites, 0);
  assert.equal(result.receipt.fixedInputs.public.evaluatorPass, false);
  assert.equal(result.receipt.fixedInputs.private.feedbackVerdict, "PASS");
  assert.equal(result.receipt.authorization.writesAuthorized, false);
  assert.equal(result.receipt.authorization.nextScope.sprint, "sprint-042");
  assert.equal(result.receipt.authorization.nextScope.authorizedNow, false);
  assert.equal(result.receipt.pathRoles.rows.filter((row) => row.reason === "public-hook-byte-sync-fixed").length, 3);
  assert.equal(result.receipt.pathRoles.blindCopy, 0);
  assert.deepEqual(result.receipt.pathRoles.unknown, []);
  assert.deepEqual(result.receipt.pathRoles.unclassified, []);
});

for (const [label, code, mutate] of [
  ["unknown public tuple key", "public-source-keys", (value) => { value.acceptedSource.unknown = true; }],
  ["missing common path", "common-paths", (value) => { value.commonPaths.pop(); }],
  ["public product mismatch", "public-product", (value) => { value.acceptedSource.fullSha = "0".repeat(40); }],
  ["public evaluatorPass truthy", "public-evaluator-pass", (value) => { value.userDecisionPreWriteGate.evaluatorPass = true; }],
  ["public gate required truthy value falsy", "public-gate-status", (value) => { value.userDecisionPreWriteGate.status = ""; }],
  ["public downstream order reversal", "public-order", (value) => { value.downstreamOrder.reverse(); }],
  ["duplicate common path", "common-paths", (value) => { value.commonPaths[1] = value.commonPaths[0]; }],
]) check(label, () => { const value = clone(handoff); mutate(value); expectCode(code, () => validatePublicHandoffDocument(value)); });

for (const [label, code, mutate] of [
  ["private candidate mismatch", "private-candidate", (value) => { value.private.candidate = "0".repeat(40); }],
  ["private receipt public evaluatorPass truthy", "private-public-status", (value) => { value.public.evaluatorPass = true; }],
  ["private feedback PASS falsy", "private-feedback-verdict", (value) => { value.feedback.verdict = ""; }],
  ["private permission missing", "private-permission-keys", (value) => { delete value.downstream.nextPermission; }],
  ["private writesAuthorized truthy", "private-authority", (value) => { value.downstream.writesAuthorized = true; }],
  ["private order reversal", "private-order", (value) => { value.downstream.order.reverse(); }],
  ["private receipt internal tamper", "private-receipt-tamper", (value) => { value.externalStates.remote = "PASS"; }],
  ["private role owner mismatch", "private-role-owner", (value) => { value.harnessRoleOwned.paths[0].owner = "planner"; }],
  ["private role duplicate", "private-role-duplicate", (value) => { value.harnessRoleOwned.paths.push(clone(value.harnessRoleOwned.paths[0])); }],
]) check(label, () => { const value = clone(privateReceipt); mutate(value); expectCode(code, () => validatePrivateReceiptDocument(value)); });

check("private feedback commit mismatch fails closed", () => {
  expectCode("private-feedback-commit", () => inspectPrewrite({ ...baseOptions, privateFeedbackCommit: "0".repeat(40) }));
});

check("handoff and receipt file tamper fail before source action", () => {
  const temporary = mkdtempSync(join(tmpdir(), "sprint041-inputs-"));
  try {
    const badHandoff = join(temporary, "handoff.json");
    const badReceipt = join(temporary, "receipt.json");
    writeFileSync(badHandoff, `${JSON.stringify(handoff)}\n`);
    writeFileSync(badReceipt, `${JSON.stringify(privateReceipt)}\n`);
    expectCode("handoff-file-tamper", () => validateFixedInputFile({ actualPath: badHandoff, expectedPath: badHandoff, expectedSha256: FIXED.publicHandoffSha256, pathCode: "handoff-path-mismatch", tamperCode: "handoff-file-tamper", label: "public handoff" }));
    expectCode("private-receipt-file-tamper", () => validateFixedInputFile({ actualPath: badReceipt, expectedPath: badReceipt, expectedSha256: FIXED.privateReceiptFileSha256, pathCode: "private-receipt-path-mismatch", tamperCode: "private-receipt-file-tamper", label: "private PASS receipt" }));
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

check("same-byte handoff copy at another path fails closed", () => {
  const temporary = mkdtempSync(join(tmpdir(), "sprint041-handoff-copy-"));
  try {
    const relocated = join(temporary, "ready-handoff.json");
    cpSync(handoffPath, relocated);
    assert.equal(sha256(readFileSync(relocated)), FIXED.publicHandoffSha256);
    expectCode("handoff-path-mismatch", () => inspectPrewrite({ ...baseOptions, handoffPath: relocated }));
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

check("same-byte private receipt copy at another path fails closed", () => {
  const temporary = mkdtempSync(join(tmpdir(), "sprint041-private-receipt-copy-"));
  try {
    const relocated = join(temporary, "private-pass-receipt.json");
    cpSync(privateReceiptPath, relocated);
    assert.equal(sha256(readFileSync(relocated)), FIXED.privateReceiptFileSha256);
    expectCode("private-receipt-path-mismatch", () => inspectPrewrite({ ...baseOptions, privateReceiptPath: relocated }));
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

check("Git-free fixed-base/source verification emits and verifies only the receipt", () => {
  const temporary = mkdtempSync(join(tmpdir(), "sprint041-gitfree-"));
  const baseRoot = join(temporary, "base");
  const sourceRoot = join(temporary, "source");
  try {
    materializeBase(baseRoot);
    copySource(sourceRoot);
    const outputPath = join(sourceRoot, "scripts/fixtures/sprint-041/yasashii-prewrite-receipt.json");
    const options = { ...baseOptions, root: sourceRoot, baseRoot, outputPath };
    const before = inspectPrewrite(options);
    assert.equal(before.summary.observedProductWrites, 0);
    const emitted = emitReceipt(options);
    assert.equal(existsSync(outputPath), true);
    assert.equal(emitted.receipt.writeAccounting.receiptWrites, 1);
    const verified = verifyReceipt({ ...options, receiptPath: outputPath });
    assert.equal(verified.summary.verified, true);
    const tampered = JSON.parse(readFileSync(outputPath, "utf8"));
    tampered.authorization.writesAuthorized = true;
    writeFileSync(outputPath, `${JSON.stringify(tampered, null, 2)}\n`);
    expectCode("yasashii-receipt-tamper", () => verifyReceipt({ ...options, receiptPath: outputPath }));
    emitReceipt(options);
    const pathTampered = JSON.parse(readFileSync(outputPath, "utf8"));
    pathTampered.fixedInputs.public.handoffPath = join(temporary, "copied-handoff.json");
    const body = { ...pathTampered };
    delete body.receiptSha256;
    pathTampered.receiptSha256 = sha256(Buffer.from(stable(body)));
    writeFileSync(outputPath, `${JSON.stringify(pathTampered, null, 2)}\n`);
    expectCode("yasashii-receipt-input-path", () => verifyReceipt({ ...options, receiptPath: outputPath }));
    emitReceipt(options);
    const privatePathTampered = JSON.parse(readFileSync(outputPath, "utf8"));
    privatePathTampered.fixedInputs.private.receiptPath = join(temporary, "copied-private-receipt.json");
    const privatePathBody = { ...privatePathTampered };
    delete privatePathBody.receiptSha256;
    privatePathTampered.receiptSha256 = sha256(Buffer.from(stable(privatePathBody)));
    writeFileSync(outputPath, `${JSON.stringify(privatePathTampered, null, 2)}\n`);
    expectCode("yasashii-receipt-input-path", () => verifyReceipt({ ...options, receiptPath: outputPath }));
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

check("dirty product conflict leaves receipt and product writes at zero", () => {
  const temporary = mkdtempSync(join(tmpdir(), "sprint041-dirty-"));
  const baseRoot = join(temporary, "base");
  const sourceRoot = join(temporary, "source");
  try {
    materializeBase(baseRoot);
    copySource(sourceRoot);
    const productPath = join(sourceRoot, "plugins/secretary/hooks/hooks.json");
    mkdirSync(resolve(productPath, ".."), { recursive: true });
    writeFileSync(productPath, "{}\n");
    const outputPath = join(sourceRoot, "scripts/fixtures/sprint-041/yasashii-prewrite-receipt.json");
    const receiptBefore = readFileSync(outputPath);
    expectCode("dirty-product-conflict", () => emitReceipt({ ...baseOptions, root: sourceRoot, baseRoot, outputPath }));
    assert.deepEqual(readFileSync(outputPath), receiptBefore);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

for (const [label, stage] of [["unstaged product conflict", false], ["staged product conflict", true]]) check(label, () => {
  const temporary = mkdtempSync(join(tmpdir(), "sprint041-index-conflict-"));
  const baseRoot = join(temporary, "base");
  const sourceRoot = join(temporary, "source");
  try {
    materializeBase(baseRoot);
    copySource(sourceRoot);
    const relativeProduct = "plugins/secretary/skills/daily/SKILL.md";
    writeFileSync(join(sourceRoot, relativeProduct), "product-conflict\n");
    if (stage) {
      assert.equal(spawnSync("git", ["init", "-q"], { cwd: sourceRoot }).status, 0);
      assert.equal(spawnSync("git", ["add", "--", relativeProduct], { cwd: sourceRoot }).status, 0);
    }
    expectCode("dirty-product-conflict", () => inspectPrewrite({ ...baseOptions, root: sourceRoot, baseRoot }));
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

check("fixed-base missing or tampered path is rejected", () => {
  const temporary = mkdtempSync(join(tmpdir(), "sprint041-base-tamper-"));
  const baseRoot = join(temporary, "base");
  const sourceRoot = join(temporary, "source");
  try {
    materializeBase(baseRoot);
    copySource(sourceRoot);
    writeFileSync(join(baseRoot, "README.md"), "tampered\n");
    expectCode("fixed-base-tamper", () => inspectPrewrite({ ...baseOptions, root: sourceRoot, baseRoot }));
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

console.log(`SPRINT041_TEST_PASS=${pass} SPRINT041_TEST_FAIL=${fail}`);
if (fail) process.exitCode = 1;
