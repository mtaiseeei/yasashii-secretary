#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const reportIndex = process.argv.indexOf("--candidate-report");
if (reportIndex < 0 || !process.argv[reportIndex + 1]) throw new Error("--candidate-report is required");
const reportPath = resolve(process.argv[reportIndex + 1]);
const reportRoot = dirname(reportPath);
const report = JSON.parse(readFileSync(reportPath, "utf8"));
const handoff = JSON.parse(readFileSync(join(root, "scripts/fixtures/sprint-040/downstream-handoff.json"), "utf8"));
const inventory = JSON.parse(readFileSync(join(root, handoff.inventory), "utf8"));
const overlayBase = JSON.parse(readFileSync(join(root, "secretary-overlay/upstream-base.json"), "utf8"));
const overlayTree = JSON.parse(readFileSync(join(root, "secretary-overlay/upstream-tree.json"), "utf8"));
const mapping = JSON.parse(readFileSync(join(root, "secretary-overlay/mapping.json"), "utf8"));
const downstreamOwned = JSON.parse(readFileSync(join(root, "secretary-overlay/downstream-owned.json"), "utf8"));
const candidate = report.candidates.find((item) => item.id === "yasashii");
if (!candidate) throw new Error("Yasashii candidate is missing");
const candidateRoot = join(reportRoot, candidate.candidateRoot);
const sha = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const mode = (path) => lstatSync(path).mode & 0o111 ? "100755" : "100644";
let pass = 0;
let fail = 0;
function check(label, fn) {
  try { fn(); pass += 1; console.log(`PASS ${label}`); }
  catch (error) { fail += 1; console.error(`FAIL ${label}: ${error.message}`); }
}

check("schema 3固定入力とaccepted candidateを再確認", () => {
  assert.equal(handoff.schemaVersion, 3);
  assert.equal(report.manifestSha256, "e515842b147393ac77dddfb94d000188916d4aa837fda17d7e8fb4015f844982");
  assert.equal(candidate.baseHead, "3c472dd9a2b5299f27741ae2c418094486b7d035");
  assert.equal(candidate.candidate.sha256, "4bc87169d87baf90f9681f7ba07d3154c71df34eac78bad15b435732e876faf2");
});

check("parity adapted supportingは排他的で未分類差分0", () => {
  for (const paths of Object.values(candidate.roleIntersections)) assert.deepEqual(paths, []);
  const writable = new Set([...candidate.roles.parity, ...candidate.roles.adapted].map((item) => item.path));
  assert.deepEqual(candidate.actualCandidateDiffPaths.filter((path) => !writable.has(path)), []);
  assert.deepEqual(candidate.roles.supporting.map((item) => item.path).filter((path) => candidate.actualCandidateDiffPaths.includes(path)), []);
});

check("実Yasashii sourceの28 product regression pathはaccepted bytesとmodeに一致", () => {
  assert.equal(candidate.actualCandidateDiffPaths.length, 28);
  for (const item of candidate.actualCandidateDiff) {
    const actual = join(root, item.path);
    const expected = join(candidateRoot, item.path);
    assert.equal(existsSync(actual), true, item.path);
    assert.equal(sha(actual), sha(expected), `${item.path}:bytes`);
    assert.equal(mode(actual), mode(expected), `${item.path}:mode`);
  }
});

check("現行Planner正本とHarness履歴を固定base docsで上書きしていない", () => {
  const spec = readFileSync(join(root, "docs/spec.md"), "utf8");
  const state = readFileSync(join(root, "docs/sprints/state.md"), "utf8");
  const progress = readFileSync(join(root, "docs/progress/sprint-040.md"), "utf8");
  assert.match(spec, /schema 3/u);
  assert.match(state, /sprint-040/u);
  assert.match(progress, /pre-write spec-issue/u);
});

check("Yasashii固有の保護surfaceは固定digestを維持", () => {
  for (const item of handoff.editions.find((entry) => entry.id === "yasashii").protected.filter((entry) => entry.path !== "docs/spec.md")) {
    assert.equal(sha(join(root, item.path)), item.sha256, item.path);
  }
  assert.match(readFileSync(join(root, "plugins/secretary/skills/secretary/SKILL.md"), "utf8"), /^# yasashii-secretary/mu);
});

check("overlayは公開PASS済みbaseとschema 3 candidateを記録", () => {
  assert.equal(overlayBase.baseCommit, "9acea13477cd7730bf064a32c170b752586fa116");
  assert.equal(overlayBase.externalLiveGate, "upstream-sprint-040-patch-001-product-pass-verified");
  assert.equal(overlayBase.memoryAuthorizationHandoff.manifestSha256, report.manifestSha256);
  assert.equal(overlayBase.memoryAuthorizationHandoff.yasashiiCandidateSha256, candidate.candidate.sha256);
  assert.equal(overlayTree.baseCommit, overlayBase.baseCommit);
  assert.equal(overlayTree.files.length, 628);
});

check("overlay分類はschema 3のparityとfixed-base adaptationを弱めない", () => {
  for (const path of ["plugins/secretary/skills/projects/SKILL.md", "plugins/secretary/skills/settings/SKILL.md"]) {
    assert.equal(mapping.anchorOverlay.includes(path), false, path);
  }
  assert.equal(mapping.upstreamOnly.includes("plugins/secretary/rules/copy/agentic.json"), false);
  assert.equal(downstreamOwned.patterns.includes("plugins/secretary/rules/copy/yasashii.json"), false);
  assert.equal(downstreamOwned.patterns.includes("scripts/sprint-038-test.mjs"), true);
});

check("conversation inventoryは実sourceの17 unique surfaceでmarkerとdigestが一致", () => {
  assert.equal(inventory.surfaces.length, 17);
  assert.equal(new Set(inventory.surfaces.map((item) => item.id)).size, 17);
  for (const item of candidate.inventory) {
    const body = readFileSync(join(root, item.path), "utf8");
    assert.equal(sha(join(root, item.path)), item.candidateSha256, item.id);
    for (const marker of item.requiredMarkers) assert.ok(body.includes(marker), `${item.id}:${marker}`);
  }
});

check("公開境界はoffline-onlyで外部操作を要求しない", () => {
  assert.equal(report.publicationStatus, "source-candidate-offline-only");
  for (const item of ["push", "tag", "release", "marketplace", "installed-cache", "workspace-migration", "new-session", "external-service"]) {
    assert.ok(report.notExecuted.includes(item), item);
  }
});

console.log(`SPRINT040_YASASHII_SOURCE_PASS=${pass} SPRINT040_YASASHII_SOURCE_FAIL=${fail}`);
if (fail) process.exitCode = 1;
