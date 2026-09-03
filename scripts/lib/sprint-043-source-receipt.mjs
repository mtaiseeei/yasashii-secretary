import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export class Sprint043ReceiptError extends Error {
  constructor(code, message = code) { super(message); this.name = "Sprint043ReceiptError"; this.code = code; }
}
export const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const fail = (condition, code) => { if (!condition) throw new Sprint043ReceiptError(code); };
function mode(path) { return lstatSync(path).mode & 0o111 ? "100755" : "100644"; }
function productRows(root) {
  const rows = [];
  function visit(directory) {
    for (const name of readdirSync(directory).sort((a, b) => Buffer.from(a).compare(Buffer.from(b)))) {
      const absolute = join(directory, name); const relative = absolute.slice(root.length + 1).replaceAll("\\", "/"); const stat = lstatSync(absolute);
      if (stat.isDirectory()) visit(absolute);
      else rows.push([relative, stat.isSymbolicLink() ? "120000" : mode(absolute), sha256(readFileSync(absolute)), stat.size]);
    }
  }
  visit(join(root, "plugins/secretary"));
  return rows;
}
export function loadInputs(root) {
  const read = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
  return {
    candidate: read("scripts/fixtures/sprint-043/candidate.json"),
    template: read("scripts/fixtures/sprint-043/source-receipt-template.json"),
    registry: read("scripts/fixtures/sprint-043/case-registry.json"),
    matrix: read("scripts/fixtures/sprint-043/final-matrix.json"),
    pathActual: read("scripts/fixtures/sprint-042/path-actual.json"),
    protectedActual: read("scripts/fixtures/sprint-042/protected-actual.json"),
  };
}
export function validateFinalization({ root, feedbackBody, feedbackPath = "docs/feedback/sprint-043.md", inputs = loadInputs(root) }) {
  const { candidate, template, registry, matrix, pathActual, protectedActual } = inputs;
  fail(template.status === "pending-fresh-evaluator-pass" && template.final === false && template.internalSha256 === null, "template-not-pending");
  fail(feedbackPath === "docs/feedback/sprint-043.md", "feedback-path-mismatch");
  fail(typeof feedbackBody === "string" && feedbackBody.trim(), "feedback-pending");
  fail(/(?:Verdict|判定)[^\n]{0,40}PASS/iu.test(feedbackBody), "feedback-not-pass");
  fail(feedbackBody.includes(candidate.productCandidate), "feedback-candidate-mismatch");
  const required = [/17\s*\/\s*17/u, /62\s*\/\s*62/u, /(?:primary|Primary)[^\n]{0,30}250/iu, /CLX[^\n]{0,20}20/iu, /XV[^\n]{0,20}4/iu, /E2E[^\n]{0,20}4/iu, /(?:path|パス)[^\n]{0,20}46/iu, /protected[^\n]{0,20}9/iu];
  fail(required.every((pattern) => pattern.test(feedbackBody)), "feedback-case-count-missing");
  const xmindLine = feedbackBody.split(/\r?\n/u).find((line) => line.includes("XM-007"));
  fail(xmindLine && /NOT-RUN/u.test(xmindLine) && !/\bPASS\b/u.test(xmindLine), "false-conditional-not-run");
  const allCases = [...registry.groups.primary, ...registry.groups.collaboration, ...registry.groups.visual];
  fail(allCases.length === 274 && new Set(allCases).size === 274, "registry-count-mismatch");
  fail(registry.groups.primary.length === 250 && registry.groups.collaboration.length === 20 && registry.groups.visual.length === 4, "registry-group-mismatch");
  fail(matrix.candidate === candidate.productCandidate && matrix.featureCount === 17 && matrix.behaviorCount === 62 && matrix.rows.length === 62, "matrix-candidate-mismatch");
  fail(pathActual.counts.total === 46 && pathActual.counts.byteSync === 16 && pathActual.counts.adapted === 30 && Object.values(pathActual.counts).slice(3).every((value) => value === 0), "path-role-mismatch");
  fail(protectedActual.groups.length === 9 && protectedActual.unauthorizedChanges.length === 0, "protected-mismatch");
  const rows = productRows(root);
  fail(rows.length === candidate.productFileCount && sha256(JSON.stringify(rows)) === candidate.productDigest, "product-digest-mismatch");
  fail(candidate.fixedInputs.public.evaluatorPass === false, "public-verdict-promoted");
  fail(candidate.fixedInputs.privateReceiptIdentity.verdict === "PASS" && candidate.fixedInputs.privateReceiptIdentity.writesAuthorized === false, "private-receipt-identity");
  return { candidate, template, feedbackSha256: sha256(feedbackBody), feedbackBody, feedbackPath };
}
export function buildReceipt(args) {
  const validated = validateFinalization(args);
  const { candidate, template, feedbackSha256, feedbackPath } = validated;
  const receipt = {
    ...template,
    status: "source-pass-verified",
    final: true,
    fixedInputs: candidate.fixedInputs,
    feedback: { path: feedbackPath, sha256: feedbackSha256, verdict: "PASS", candidate: candidate.productCandidate },
    finalizedBy: "orchestrator-after-fresh-evaluator-pass",
    internalSha256: null,
  };
  receipt.internalSha256 = sha256(JSON.stringify({ ...receipt, internalSha256: null }));
  return receipt;
}
export function verifyReceipt(root, receipt, feedbackBody) {
  fail(receipt.status === "source-pass-verified" && receipt.final === true, "receipt-not-final");
  const rebuilt = buildReceipt({ root, feedbackBody, feedbackPath: receipt.feedback.path });
  fail(JSON.stringify(receipt) === JSON.stringify(rebuilt), "receipt-binding-mismatch");
  fail(receipt.internalSha256 === sha256(JSON.stringify({ ...receipt, internalSha256: null })), "receipt-internal-digest");
  assert.equal(receipt.nextPermission, "release-decision-requires-separate-user-approval");
  return receipt;
}
