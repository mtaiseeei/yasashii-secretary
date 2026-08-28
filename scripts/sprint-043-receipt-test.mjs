#!/usr/bin/env node
import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildReceipt, loadInputs, Sprint043ReceiptError, verifyReceipt } from "./lib/sprint-043-source-receipt.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const candidate = loadInputs(root).candidate;
const valid = `# Sprint 043 fresh Evaluator feedback\nVerdict: PASS\nCandidate: ${candidate.productCandidate}\n17/17 features, 62/62 behaviors\nPrimary 250, CLX 20, XV 4, E2E 4\npath 46, protected 9\nXM-007 High: conditional NOT-RUN; real Xmind live was not authorized.\n`;
let pass = 0;
function reject(id, code, action) {
  let caught; try { action(); } catch (error) { caught = error; }
  assert(caught instanceof Sprint043ReceiptError, id); assert.equal(caught.code, code, id); pass += 1; process.stdout.write(`PASS ${id} ${code}\n`);
}
reject("RC-001", "feedback-pending", () => buildReceipt({ root, feedbackBody: null }));
reject("RC-002", "feedback-not-pass", () => buildReceipt({ root, feedbackBody: valid.replace("Verdict: PASS", "Verdict: FAIL") }));
reject("RC-003", "feedback-candidate-mismatch", () => buildReceipt({ root, feedbackBody: valid.replace(candidate.productCandidate, "0".repeat(40)) }));
reject("RC-004", "feedback-case-count-missing", () => buildReceipt({ root, feedbackBody: valid.replace("Primary 250", "Primary missing") }));
reject("RC-005", "false-conditional-not-run", () => buildReceipt({ root, feedbackBody: valid.replace("conditional NOT-RUN", "PASS") }));
{
  const inputs = loadInputs(root); inputs.registry.groups.primary.pop();
  reject("RC-006", "registry-count-mismatch", () => buildReceipt({ root, feedbackBody: valid, inputs }));
}
{
  const inputs = loadInputs(root); inputs.protectedActual.unauthorizedChanges.push("tamper");
  reject("RC-007", "protected-mismatch", () => buildReceipt({ root, feedbackBody: valid, inputs }));
}
{
  const inputs = loadInputs(root); inputs.matrix.candidate = "0".repeat(40);
  reject("RC-008", "matrix-candidate-mismatch", () => buildReceipt({ root, feedbackBody: valid, inputs }));
}
{
  const receipt = buildReceipt({ root, feedbackBody: valid }); receipt.feedback.sha256 = "0".repeat(64); receipt.internalSha256 = "0".repeat(64);
  reject("RC-009", "receipt-binding-mismatch", () => verifyReceipt(root, receipt, valid));
}
{
  const inputs = loadInputs(root); inputs.template.final = true;
  reject("RC-010", "template-not-pending", () => buildReceipt({ root, feedbackBody: valid, inputs }));
}
process.stdout.write(`SPRINT043_RECEIPT_TEST_PASS=${pass} FAIL=0 FINAL_RECEIPT_WRITES=0\n`);
