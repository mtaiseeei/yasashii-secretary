#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const candidate = JSON.parse(readFileSync(join(root, "scripts/fixtures/sprint-043/candidate.json"), "utf8"));
const threeSurfaces = process.argv.includes("--three-surfaces");
const sha = (value) => createHash("sha256").update(value).digest("hex");
function run(command, args, options = {}) {
  return spawnSync(command, args, { cwd: options.cwd || root, encoding: Object.hasOwn(options, "encoding") ? options.encoding : "utf8", input: options.input, timeout: options.timeout || 1_500_000, maxBuffer: 512 * 1024 * 1024, env: { ...process.env, ...(options.env || {}) } });
}
function ok(result, label) { assert.equal(result.status, 0, `${label}\nstdout:\n${result.stdout || ""}\nstderr:\n${result.stderr || ""}`); }
function mode(path) { return lstatSync(path).mode & 0o111 ? "100755" : "100644"; }
function productEntries(base) {
  const rows = [];
  function visit(directory) {
    for (const name of readdirSync(directory).sort((a, b) => Buffer.from(a).compare(Buffer.from(b)))) {
      const absolute = join(directory, name);
      const relative = absolute.slice(base.length + 1).replaceAll("\\", "/");
      const stat = lstatSync(absolute);
      if (stat.isDirectory()) visit(absolute);
      else if (stat.isSymbolicLink()) rows.push([relative, "120000", sha(readFileSync(absolute)), stat.size]);
      else rows.push([relative, mode(absolute), sha(readFileSync(absolute)), stat.size]);
    }
  }
  visit(join(base, "plugins/secretary"));
  return rows;
}
function verifySurface(base, label) {
  const entries = productEntries(base);
  assert.equal(entries.length, candidate.productFileCount, `${label}: product file count`);
  assert.equal(sha(JSON.stringify(entries)), candidate.productDigest, `${label}: product digest`);
  for (const required of ["scripts/sprint-043-test.mjs", "scripts/sprint-043-e2e.mjs", "scripts/fixtures/sprint-043/case-registry.json", "scripts/fixtures/sprint-043/final-matrix.json"]) assert(existsSync(join(base, required)), `${label}: ${required}`);
  return { label, fileCount: entries.length, productDigest: candidate.productDigest };
}

const source = verifySurface(root, "source");
if (!existsSync(join(root, ".git"))) {
  process.stdout.write(`SPRINT043_CANDIDATE surface=git-free-archive candidate=${candidate.productCandidate} tree=${candidate.productTree} product_digest=${candidate.productDigest} files=${candidate.productFileCount}\n`);
  process.exit(0);
}

const rev = run("git", ["rev-parse", candidate.productCandidate]); ok(rev, "candidate exists");
assert.equal(rev.stdout.trim(), candidate.productCandidate);
const tree = run("git", ["rev-parse", `${candidate.productCandidate}^{tree}`]); ok(tree, "candidate tree");
assert.equal(tree.stdout.trim(), candidate.productTree);
const verificationHead = run("git", ["rev-parse", "HEAD"]); ok(verificationHead, "verification HEAD");
const head = verificationHead.stdout.trim();
const productDiff = run("git", ["diff", "--name-only", `${candidate.productCandidate}..${head}`, "--", "plugins/secretary", "adapters"]); ok(productDiff, "product diff");
assert.equal(productDiff.stdout.trim(), "", "candidate..verification HEAD product diff must be zero");
const productStatus = run("git", ["status", "--porcelain", "--untracked-files=all", "--", "plugins/secretary", "adapters"]); ok(productStatus, "product status");
assert.equal(productStatus.stdout.trim(), "", "product working tree must be clean");

if (!threeSurfaces) {
  process.stdout.write(`SPRINT043_CANDIDATE surface=source candidate=${candidate.productCandidate} tree=${candidate.productTree} verification_head=${head} product_digest=${candidate.productDigest} files=${candidate.productFileCount} product_diff=0\n`);
  process.exit(0);
}

const work = mkdtempSync(join(tmpdir(), "yasashii-s043-surfaces-"));
try {
  const checkout = join(work, "checkout");
  const archive = join(work, "archive");
  let result = run("git", ["clone", "--quiet", "--no-hardlinks", "--no-checkout", root, checkout]); ok(result, "clone detached checkout");
  result = run("git", ["checkout", "--quiet", "--detach", head], { cwd: checkout }); ok(result, "checkout verification HEAD");
  result = run("git", ["remote", "remove", "origin"], { cwd: checkout }); ok(result, "remove local origin metadata");
  result = run("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: checkout }); ok(result, "checkout status");
  assert.equal(result.stdout.trim(), "");

  const archiveBuffer = run("git", ["archive", "--format=tar", head], { encoding: null });
  assert.equal(archiveBuffer.status, 0, Buffer.from(archiveBuffer.stderr || "").toString());
  result = run("mkdir", ["-p", archive]); ok(result, "create archive root");
  result = run("tar", ["-xf", "-", "-C", archive], { input: archiveBuffer.stdout, encoding: null });
  assert.equal(result.status, 0, Buffer.from(result.stderr || "").toString());
  for (const relative of ["docs", "scripts/fixtures/sprint-041", "scripts/lib/sprint-041-prewrite.mjs", "scripts/sprint-042-test.mjs"]) rmSync(join(archive, relative), { recursive: true, force: true });
  assert.equal(existsSync(join(archive, ".git")), false);

  const surfaces = [source, verifySurface(checkout, "clean-checkout"), verifySurface(archive, "git-free-archive")];
  assert.equal(new Set(surfaces.map((entry) => `${entry.fileCount}:${entry.productDigest}`)).size, 1);
  const forbidden = [
    root,
    ["", "Users", "taisei", "workspace", "agentic-secretary"].join("/"),
    ["", "private", "tmp", "project-clarity-handoff-20260829"].join("/"),
    ["", "private", "tmp", "agentic-secretary-my-vault-clarity"].join("/"),
  ];
  const scan = run("rg", ["-l", "--fixed-strings", "-e", forbidden[0], "-e", forbidden[1], "-e", forbidden[2], "-e", forbidden[3], archive]);
  assert([0, 1].includes(scan.status));
  assert.equal(scan.status, 1, `archive contains forbidden absolute/private source literal:\n${scan.stdout}`);

  for (const [label, base] of [["clean-checkout", checkout], ["git-free-archive", archive]]) {
    result = run(process.execPath, ["scripts/sprint-043-test.mjs"], { cwd: base, env: { SPRINT043_SURFACE: label } }); ok(result, `${label} 274 registry`);
    result = run(process.execPath, ["scripts/sprint-043-e2e.mjs", "--e2e-only"], { cwd: base, env: { SPRINT043_SURFACE: label } }); ok(result, `${label} E2E 4`);
  }
  process.stdout.write(`SPRINT043_SURFACES source=PASS clean_checkout=PASS git_free_archive=PASS candidate=${candidate.productCandidate} tree=${candidate.productTree} verification_head=${head} product_digest=${candidate.productDigest} files=${candidate.productFileCount} paths=46 protected=9 features=17 behaviors=62 registry=273+1-not-run e2e=4 archive_git=0 absolute_source=0 private_source_literal=0 product_diff=0\n`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
