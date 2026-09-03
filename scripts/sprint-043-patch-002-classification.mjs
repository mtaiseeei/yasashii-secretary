#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const reportPath = join(root, "scripts/fixtures/sprint-043-patch-002/actual-action-report.json");
const report = JSON.parse(readFileSync(reportPath, "utf8"));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const digest = (path) => sha(readFileSync(join(root, path)));
const mode = (path) => (lstatSync(join(root, path)).mode & 0o111 ? "100755" : "100644");

assert.deepEqual(report.fixedInputs, {
  publicCandidate: "51329fc05ea0e9e66f64aa5c3bf2ee2db168ed58",
  publicTree: "c0b82e802389450b774fa9b4a433e94e19e87028",
  publicEvaluatorPass: "0f0407758f854633814b485b84e46af8a508044c",
  publicFinalState: "68b77d0b557d34840c8b68916a2877e1a5d7b7a3",
  privateVerificationCandidate: "5abad512ec415d0e6ca832653dd66eb90f8b2c45",
  privateProduct: "c92dfe53ba7345db57ac0e625e2d6ded8bc0bc38",
  privateEvaluatorPass: "54e61975cecdc79bbbf54fa203a35528db0da8df",
  privateFinalState: "5eec49fa5418b0fc612dd230420370ce68bb591e",
  yasashiiStartHead: "0763010ecc654091c3caa456eee7e18671311bda",
  yasashiiStartTree: "4ae64d5194cec20bc8720c7910a143299736a41b",
});
assert.equal(report.rows.length, 12);
assert.equal(new Set(report.rows.map((row) => row.path)).size, 12);
assert.equal(report.rows.filter((row) => row.role === "public-byte-sync").length, 9);
assert.equal(report.rows.filter((row) => row.role === "yasashii-adapted").length, 3);
for (const row of report.rows) {
  assert(existsSync(join(root, row.path)), row.path);
  assert.equal(digest(row.path), row.afterDigest, row.path);
  assert.equal(mode(row.path), row.afterMode, row.path);
  assert.equal(row.actualDiff, row.beforeDigest !== row.afterDigest ? "changed" : "unchanged", row.path);
  if (row.role === "public-byte-sync") {
    assert.equal(row.afterDigest, row.publicDigest, row.path);
    assert.equal(row.afterMode, row.publicMode, row.path);
  } else {
    assert.notEqual(row.afterDigest, row.publicDigest, row.path);
    assert.equal(row.sourceMarker.startsWith("yasashii-secretary:"), true, row.path);
  }
}
for (const path of report.supporting) assert(existsSync(join(root, path)), path);
for (const row of report.protected) assert.equal(digest(row.path), row.digest, row.path);
assert.deepEqual(report.counts, {
  byteSync: 9, adapted: 3, supporting: report.supporting.length,
  protected: report.protected.length, harnessDocs: 1,
  unknown: 0, stale: 0, unused: 0, unclassified: 0, overlap: 0,
});

const productBody = report.rows.map((row) => readFileSync(join(root, row.path), "utf8")).join("\n");
for (const forbidden of ["vault/05_secretary", "vault/10_sources", "rules/copy/my-vault", "private-my-vault-project-reference"]) {
  assert.equal(productBody.includes(forbidden), false, forbidden);
}
const claude = JSON.parse(readFileSync(join(root, "plugins/secretary/.claude-plugin/plugin.json"), "utf8"));
const codex = JSON.parse(readFileSync(join(root, "plugins/secretary/.codex-plugin/plugin.json"), "utf8"));
assert.equal(Object.hasOwn(claude, "hooks"), false);
assert.equal(codex.hooks, "./hooks/hooks.json");
const hooks = JSON.parse(readFileSync(join(root, "plugins/secretary/hooks/hooks.json"), "utf8"));
assert.equal(Object.values(hooks.hooks).flat().flatMap((entry) => entry.hooks || []).every((entry) => entry.command.includes("clarity-hook.mjs")), true);

const skillCount = readdirSync(join(root, "plugins/secretary/skills"), { withFileTypes: true }).filter((entry) => entry.isDirectory()).length;
const matrix = JSON.parse(readFileSync(join(root, "scripts/fixtures/sprint-043/final-matrix.json"), "utf8"));
assert.equal(skillCount, 17);
assert.equal(matrix.behaviorCount, 62);
const xmind = ["plugins/secretary/skills/clarity/SKILL.md", "plugins/secretary/scripts/lib/clarity-projection.mjs"]
  .map((path) => readFileSync(join(root, path), "utf8")).join("\n");
for (const token of ["#16A34A", "#2563EB", "#D97706", "#DC2626", "MCP"]) assert(xmind.includes(token), token);
assert(/default.*OFF|既定.*OFF/iu.test(xmind));
assert(report.externalOperations.every((row) => row.status === "NOT-RUN" || row.count === 0));

process.stdout.write(`YASASHII_SPRINT043_PATCH002_CLASSIFICATION PASS=1 BYTE_SYNC=9 ADAPTED=3 SUPPORTING=${report.supporting.length} PROTECTED=${report.protected.length} HARNESS_DOCS=1 UNKNOWN=0 STALE=0 UNUSED=0 UNCLASSIFIED=0 OVERLAP=0 SKILLS=17 BEHAVIORS=62 EXTERNAL_WRITES=0\n`);
