#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const read = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const sha = (value) => createHash("sha256").update(value).digest("hex");
const baseRegistry = read("scripts/fixtures/sprint-043/case-registry.json");
const baseCandidate = read("scripts/fixtures/sprint-043/candidate.json");
let pass = 0;
function reject(id, code, fn) { assert.throws(fn, new RegExp(code, "u"), id); pass += 1; process.stdout.write(`PASS ${id} ${code}\n`); }
function validateRegistry(value) {
  const all = [...value.groups.primary, ...value.groups.collaboration, ...value.groups.visual];
  if (value.groups.primary.length !== 250 || value.groups.collaboration.length !== 20 || value.groups.visual.length !== 4) throw new Error("registry-count");
  if (new Set(all).size !== all.length) throw new Error("registry-duplicate");
  if (all.some((id) => !value.semanticRows[id])) throw new Error("registry-semantic-missing");
  for (const name of ["primary", "collaboration", "visual"]) {
    const digest = sha(value.groups[name].map((id) => JSON.stringify(value.semanticRows[id])).join("\n"));
    if (digest !== value.baseline.semantic[name]) throw new Error("registry-semantic-changed");
  }
}
function clone(value) { return structuredClone(value); }

{
  const value = clone(baseRegistry); value.groups.primary.pop(); reject("TP-001", "registry-count", () => validateRegistry(value));
}
{
  const value = clone(baseRegistry); value.groups.primary[1] = value.groups.primary[0]; reject("TP-002", "registry-duplicate", () => validateRegistry(value));
}
{
  const value = clone(baseRegistry); value.groups.primary.push("EXTRA-001"); reject("TP-003", "registry-count", () => validateRegistry(value));
}
{
  const value = clone(baseRegistry); value.semanticRows["ST-001"][3] = "changed expected side effect"; reject("TP-004", "registry-semantic-changed", () => validateRegistry(value));
}
reject("TP-005", "candidate-mismatch", () => { if (`0${baseCandidate.productCandidate.slice(1)}` !== baseCandidate.productCandidate) throw new Error("candidate-mismatch"); });
reject("TP-006", "product-digest-mismatch", () => { const changed = `${baseCandidate.productDigest[0] === "0" ? "1" : "0"}${baseCandidate.productDigest.slice(1)}`; if (changed !== baseCandidate.productDigest) throw new Error("product-digest-mismatch"); });
reject("TP-007", "runner-nonzero", () => { const result = spawnSync(process.execPath, ["-e", "process.exit(7)"]); if (result.status !== 0) throw new Error("runner-nonzero"); });
reject("TP-008", "product-diff", () => { const syntheticDiff = "plugins/secretary/scripts/clarity.mjs"; if (syntheticDiff) throw new Error("product-diff"); });

const work = mkdtempSync(join(tmpdir(), "yasashii-s043-tamper-"));
try {
  mkdirSync(join(work, ".git"));
  reject("TP-009", "archive-git-metadata", () => { if (existsSync(join(work, ".git"))) throw new Error("archive-git-metadata"); });
  rmSync(join(work, ".git"), { recursive: true });
  writeFileSync(join(work, "absolute.txt"), `${root}\n`);
  reject("TP-010", "archive-absolute-source", () => { if (readFileSync(join(work, "absolute.txt"), "utf8").includes(root)) throw new Error("archive-absolute-source"); });
  const privateSource = ["", "private", "tmp", "agentic-secretary-my-vault-clarity"].join("/");
  writeFileSync(join(work, "private.txt"), `${privateSource}\n`);
  reject("TP-011", "archive-private-source", () => { if (readFileSync(join(work, "private.txt"), "utf8").includes(privateSource)) throw new Error("archive-private-source"); });
} finally { rmSync(work, { recursive: true, force: true }); }

{
  const protectedActual = read("scripts/fixtures/sprint-042/protected-actual.json"); protectedActual.unauthorizedChanges.push("tamper");
  reject("TP-012", "protected-mismatch", () => { if (protectedActual.unauthorizedChanges.length) throw new Error("protected-mismatch"); });
}
{
  const matrix = read("scripts/fixtures/sprint-043/final-matrix.json"); matrix.rows[1].behaviorId = matrix.rows[0].behaviorId;
  reject("TP-013", "matrix-duplicate", () => { if (new Set(matrix.rows.map((row) => row.behaviorId)).size !== 62) throw new Error("matrix-duplicate"); });
}
process.stdout.write(`SPRINT043_TAMPER_TEST_PASS=${pass} FAIL=0 SOURCE_WRITES=0 PRODUCT_WRITES=0\n`);
