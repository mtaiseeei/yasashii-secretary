#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = "/Users/taisei/workspace/agentic-secretary";
const publicSha = "5f08d454c05576fcff8ab32c10c00887b4c15a96";
const baseSha = "27d37b6";
const receipt = JSON.parse(readFileSync(join(root, "scripts/fixtures/sprint-041/yasashii-prewrite-receipt.json"), "utf8"));
const matrix = JSON.parse(readFileSync(join(root, "scripts/fixtures/sprint-042/behavior-matrix.json"), "utf8"));

function run(command, args, options = {}) {
  return spawnSync(command, args, { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, ...options });
}
function gitPublic(args) {
  const result = spawnSync("git", ["-C", publicRoot, ...args], { encoding: null, maxBuffer: 32 * 1024 * 1024 });
  assert.equal(result.status, 0, Buffer.from(result.stderr || "").toString());
  return result.stdout;
}
function mode(path) {
  return lstatSync(path).mode & 0o111 ? "100755" : "100644";
}
function sha(value) {
  return createHash("sha256").update(value).digest("hex");
}

const spec = readFileSync(join(root, "docs/spec/clarity.md"), "utf8");
const specIds = [...spec.matchAll(/^\| (PC-F(?:6[0-9]|7[0-6])-B\d{2}) \|/gmu)].map((m) => m[1]);
assert.equal(new Set(specIds).size, 62);
assert.equal(matrix.featureCount, 17);
assert.equal(matrix.behaviorCount, 62);
assert.deepEqual(matrix.rows.map((row) => row.behaviorId), specIds);
assert.equal(new Set(matrix.rows.map((row) => row.behaviorId)).size, 62);
for (const row of matrix.rows) {
  assert(row.scenario && row.actualAction && row.expectedResult && row.expectedSideEffect);
  assert(Array.isArray(row.verifiedBy) && row.verifiedBy.length > 0);
}

const suites = [
  ["core", "scripts/sprint-042-core-test.mjs", 0, []],
  ["projection", "scripts/sprint-042-projection-test.mjs", 0, []],
  ["xmind", "scripts/sprint-042-xmind-test.mjs", 0, []],
  ["hook", "scripts/sprint-042-hook-test.mjs", 0, []],
  ["secretary", "scripts/sprint-042-secretary-test.mjs", 1, ["RG-010", "RG-011"]],
  ["link", "scripts/sprint-042-link-test.mjs", 0, []],
  ["drift", "scripts/sprint-042-drift-test.mjs", 0, []],
  ["collaboration", "scripts/sprint-042-collaboration-test.mjs", 0, []],
];
const passed = new Set();
const suiteResults = [];
for (const [name, path, expectedStatus, expectedFails] of suites) {
  const result = run(process.execPath, [path]);
  const combined = `${result.stdout}\n${result.stderr}`;
  const passIds = [...combined.matchAll(/^PASS ([A-Z]{2,3}-\d{3})\b/gmu)].map((m) => m[1]);
  for (const id of passIds) passed.add(id);
  const failIds = [...combined.matchAll(/^FAIL ([A-Z]{2,3}-\d{3})\b/gmu)].map((m) => m[1]);
  assert.equal(result.status, expectedStatus, `${name} unexpected exit\n${combined}`);
  assert.deepEqual(failIds, expectedFails, `${name} unexpected failure set`);
  suiteResults.push({ name, status: result.status, pass: passIds.length, expectedKnownFails: failIds });
}
for (const row of matrix.rows) {
  assert(row.verifiedBy.some((id) => passed.has(id)), `${row.behaviorId} has no executed PASS case: ${row.verifiedBy.join(",")}`);
}

assert.equal(receipt.pathRoles.counts.productTotal, 46);
assert.equal(receipt.pathRoles.counts.byteSync, 16);
assert.equal(receipt.pathRoles.counts.adapted, 30);
assert.equal(receipt.pathRoles.blindCopy, 0);
assert.equal(receipt.pathRoles.unknown.length, 0);
assert.equal(receipt.pathRoles.unclassified.length, 0);
assert(Object.values(receipt.pathRoles.intersections).every((rows) => rows.length === 0));
assert.equal(receipt.pathRoles.stale.length, 0);
let byteSync = 0;
let adapted = 0;
for (const row of receipt.pathRoles.rows) {
  const target = join(root, row.path);
  assert(existsSync(target), `missing planned path ${row.path}`);
  if (row.role === "byte-sync") {
    const sourceBytes = gitPublic(["show", `${publicSha}:${row.path}`]);
    assert.equal(sha(readFileSync(target)), sha(sourceBytes), `byte mismatch ${row.path}`);
    const sourceMode = Buffer.from(gitPublic(["ls-tree", publicSha, "--", row.path])).toString().split(/\s+/u)[0];
    assert.equal(mode(target), sourceMode, `mode mismatch ${row.path}`);
    byteSync += 1;
  } else if (row.role === "adapted") {
    adapted += 1;
    const body = readFileSync(target, "utf8");
    assert(!body.includes("vault/10_sources"), `private literal ${row.path}`);
    assert(!/(?:^|\D)05\/02(?:\D|$)/u.test(body), `private numeric path ${row.path}`);
  } else {
    assert.fail(`unknown product role ${row.role} ${row.path}`);
  }
}
assert.deepEqual({ byteSync, adapted }, { byteSync: 16, adapted: 30 });

const productPaths = new Set(receipt.pathRoles.rows.map((row) => row.path));
const changed = run("git", ["diff", "--name-only", baseSha, "--", "plugins/secretary", "adapters"]).stdout.trim().split("\n").filter(Boolean);
for (const path of changed) assert(productPaths.has(path), `unplanned product path ${path}`);
const productStatusPaths = run("git", ["status", "--porcelain", "--untracked-files=all", "--", "plugins/secretary", "adapters"]).stdout.split("\n").filter(Boolean).map((line) => line.slice(3));
for (const path of productStatusPaths) assert(productPaths.has(path), `unplanned tracked or untracked product path ${path}`);
const pathActual = JSON.parse(readFileSync(join(root, "scripts/fixtures/sprint-042/path-actual.json"), "utf8"));
assert.deepEqual(pathActual.counts, { total: 46, byteSync: 16, adapted: 30, unknown: 0, overlap: 0, unclassified: 0, unused: 0, stale: 0 });
assert.deepEqual(pathActual.rows.map((row) => row.path), receipt.pathRoles.rows.map((row) => row.path));
for (const row of pathActual.rows) {
  const bytes = readFileSync(join(root, row.path));
  assert.equal(row.after.sha256, sha(bytes), `stale actual path digest ${row.path}`);
  assert.equal(row.after.mode, mode(join(root, row.path)), `stale actual path mode ${row.path}`);
}
const protectedArgs = [
  "README.md", "LICENSE", "AGENTS.md", "CLAUDE.md",
  "plugins/secretary/rules/copy/yasashii.json", "plugins/secretary/rules/styles/yasashii.md",
  "plugins/secretary/edition.json", "secretary-overlay",
  ".agents/plugins/marketplace.json", ".claude-plugin/marketplace.json",
  "plugins/secretary/CHANGELOG.md", "plugins/yasashii-secretary/CHANGELOG.md",
  "scripts/master-release-gate.mjs", "scripts/archive-release-gate.mjs", "scripts/check-release-integrity.py"
];
const protectedDiff = run("git", ["diff", "--name-only", baseSha, "--", ...protectedArgs]).stdout.trim();
assert.equal(protectedDiff, "", `protected paths changed: ${protectedDiff}`);
const docsDiff = run("git", ["diff", "--name-only", baseSha, "--", "docs"]).stdout.trim().split("\n").filter(Boolean);
assert(docsDiff.every((path) => path === "docs/progress/sprint-042.md"), `owned docs violation: ${docsDiff.join(",")}`);
const protectedActual = JSON.parse(readFileSync(join(root, "scripts/fixtures/sprint-042/protected-actual.json"), "utf8"));
assert.deepEqual(protectedActual.unauthorizedChanges, []);
assert.equal(protectedActual.groups.length, 9);
for (const group of protectedActual.groups) {
  if (group.id !== "repo-owned-docs") assert.equal(group.afterSha256, group.beforeSha256, `protected digest changed: ${group.id}`);
  assert.deepEqual(group.unauthorizedChanges, []);
}

const hooks = JSON.parse(readFileSync(join(root, "plugins/secretary/hooks/hooks.json"), "utf8"));
const hookCommands = Object.values(hooks.hooks).flat().flatMap((entry) => entry.hooks || []).map((entry) => entry.command);
assert(hookCommands.length > 0 && hookCommands.every((command) => command.includes("scripts/clarity-hook.mjs")));
const release = JSON.parse(readFileSync(join(root, "plugins/secretary/release-inventory.json"), "utf8"));
assert.equal(release.publicationStatus, "candidate-unverified");
assert.equal(release.fixedSource.publicEvaluatorPass, false);
assert.equal(release.xmind.editions.find((entry) => entry.id === "yasashii-secretary").defaultEnabled, false);
assert.equal(release.xmind.providers[1].explicitApprovalRequired, true);
assert.equal(release.xmind.providers[1].writeWithoutApproval, false);

const claudeManifest = JSON.parse(readFileSync(join(root, "plugins/secretary/.claude-plugin/plugin.json"), "utf8"));
const codexManifest = JSON.parse(readFileSync(join(root, "plugins/secretary/.codex-plugin/plugin.json"), "utf8"));
const marketplace = JSON.parse(readFileSync(join(root, ".claude-plugin/marketplace.json"), "utf8"));
assert.deepEqual([claudeManifest.name, codexManifest.name], ["yasashii-secretary", "yasashii-secretary"]);
assert.deepEqual([claudeManifest.version, codexManifest.version, release.candidateVersion], ["0.11.0", "0.11.0", "0.11.0"]);
assert.equal(marketplace.plugins[0].version, "0.10.3", "protected published marketplace must remain unchanged");
const schemaGate = run("python3", ["scripts/check-report-schema.py", "--plugin-root", "plugins/secretary"]);
assert.equal(schemaGate.status, 0, schemaGate.stderr);
assert(schemaGate.stdout.includes("surfaces=22"));
const historicalUpdate = run(process.execPath, ["scripts/sprint-032-update-gate-test.mjs"]);
const updateText = `${historicalUpdate.stdout}\n${historicalUpdate.stderr}`;
assert.equal(historicalUpdate.status, 1, "historical 0.10.3 fixture must not be rewritten for the 0.11 candidate");
assert(updateText.includes("SPRINT032_RELEASE_PASS=12 SPRINT032_RELEASE_FAIL=3"));
assert.equal((updateText.match(/^FAIL /gmu) || []).length, 3);
assert(updateText.includes('"status": "downgrade-blocked"'));
for (const key of ["pluginUpdate", "workspaceWrite", "migration", "commit", "push", "settingsChange", "reloadOrRestart"]) {
  assert(updateText.includes(`"${key}": 0`), `current update diagnosis side effect not zero: ${key}`);
}

process.stdout.write(JSON.stringify({
  ok: true,
  status: "candidate-unverified",
  features: 17,
  behaviors: 62,
  matrixMissing: 0,
  matrixDuplicate: 0,
  byteSync,
  adapted,
  productPaths: productPaths.size,
  protectedChanges: 0,
  knownExistingRegressionFailures: ["RG-010", "RG-011"],
  currentCandidateGates: { manifests: "0.11.0", reportSchemaSurfaces: 22, updateDiagnosis: "downgrade-blocked-write-0", publishedMarketplacePreserved: "0.10.3" },
  externalLiveNotRun: ["XM-007", "public Sprint050 E2E", "live host/connectors"],
  suites: suiteResults
}, null, 2) + "\n");
