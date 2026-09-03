#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const report = JSON.parse(readFileSync(join(root, "scripts/fixtures/sprint-043-patch-002/actual-action-report.json"), "utf8"));
const run = (command, args, cwd, extraEnv = {}) => spawnSync(command, args, {
  cwd, encoding: "utf8", timeout: 120_000, maxBuffer: 32 * 1024 * 1024,
  env: { ...process.env, ...extraEnv },
});
function must(result, label) {
  assert.equal(result.status, 0, `${label}\n${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
}
function productDigest(base) {
  const hash = createHash("sha256");
  for (const row of [...report.rows].sort((a, b) => Buffer.from(a.path).compare(Buffer.from(b.path)))) {
    const path = join(base, row.path); const mode = lstatSync(path).mode & 0o111 ? "100755" : "100644";
    hash.update(row.path).update("\0").update(mode).update("\0").update(readFileSync(path)).update("\0");
  }
  return hash.digest("hex");
}
function verifySurface(base, label) {
  const target = must(run(process.execPath, ["scripts/sprint-043-patch-002-test.mjs"], base), `${label}:target`);
  const classification = must(run(process.execPath, ["scripts/sprint-043-patch-002-classification.mjs"], base), `${label}:classification`);
  assert(target.includes("PASS=21 FAIL=0 TOTAL=21"));
  assert(classification.includes("UNKNOWN=0 STALE=0 UNUSED=0 UNCLASSIFIED=0 OVERLAP=0"));
  return { label, digest: productDigest(base), target: 21, classification: "PASS" };
}

const source = verifySurface(root, "source");
if (!process.argv.includes("--three-surfaces")) {
  process.stdout.write(`YASASHII_SPRINT043_PATCH002_PORTABLE source=PASS digest=${source.digest} target=21 classification=PASS\n`);
  process.exit(0);
}

const head = must(run("git", ["rev-parse", "HEAD"], root), "candidate HEAD");
const tree = must(run("git", ["rev-parse", "HEAD^{tree}"], root), "candidate tree");
const work = mkdtempSync(join(tmpdir(), "yasashii-s043p002-"));
try {
  const clean = join(work, "clean"); const archive = join(work, "archive"); mkdirSync(clean); mkdirSync(archive);
  const copyFilter = (source) => {
    const relative = source.slice(root.length).replaceAll("\\", "/");
    return relative !== "/.git" && !relative.startsWith("/.git/");
  };
  cpSync(root, clean, { recursive: true, filter: copyFilter });
  cpSync(root, archive, { recursive: true, filter: copyFilter });
  must(run("git", ["init", "-q"], clean), "clean git init");
  must(run("git", ["add", "-A"], clean), "clean git add");
  must(run("git", ["-c", "user.name=Clarity Fixture", "-c", "user.email=clarity@example.invalid", "commit", "-qm", "candidate"], clean), "clean git commit");
  assert.equal(must(run("git", ["status", "--porcelain=v1"], clean), "clean status"), "");
  assert.equal(existsSync(join(archive, ".git")), false);
  const cleanResult = verifySurface(clean, "clean");
  const archiveResult = verifySurface(archive, "git-free-archive");
  assert.equal(source.digest, cleanResult.digest);
  assert.equal(source.digest, archiveResult.digest);
  process.stdout.write(`YASASHII_SPRINT043_PATCH002_SURFACES source=PASS clean=PASS archive=PASS candidate=portable-${source.digest} base_head=${head} base_tree=${tree} digest=${source.digest} target=21x3 classification=PASSx3 archive_git=0 clone=0 fetch=0 checkout=0 network=0\n`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
