#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const reportIndex = process.argv.indexOf("--candidate-report");
if (reportIndex < 0 || !process.argv[reportIndex + 1]) throw new Error("--candidate-report is required");
const reportPath = resolve(process.argv[reportIndex + 1]);
const reportRoot = dirname(reportPath);
const report = JSON.parse(readFileSync(reportPath, "utf8"));
const handoff = JSON.parse(readFileSync(join(root, "scripts/fixtures/sprint-040/downstream-handoff.json"), "utf8"));
const inventory = JSON.parse(readFileSync(join(root, handoff.inventory), "utf8"));
const sha = (value) => createHash("sha256").update(value).digest("hex");
let pass = 0;
let fail = 0;

function check(label, fn) {
  try { fn(); pass += 1; console.log(`PASS ${label}`); }
  catch (error) { fail += 1; console.error(`FAIL ${label}: ${error.stack || error.message}`); }
}

function walk(base, current = base) {
  const paths = [];
  for (const name of readdirSync(current).sort((a, b) => a.localeCompare(b, "en"))) {
    const absolute = join(current, name);
    const rel = relative(base, absolute).replaceAll("\\", "/");
    if (rel === ".git" || rel.startsWith(".git/")
      || rel === "docs/sprints/state.md"
      || rel.startsWith("docs/progress/")
      || rel.startsWith("docs/feedback/")) continue;
    const stat = lstatSync(absolute);
    if (stat.isDirectory()) paths.push(...walk(base, absolute));
    else if (stat.isFile()) paths.push(rel);
    else throw new Error(`unsupported-candidate-entry:${rel}`);
  }
  return paths;
}

function candidateDigest(candidateRoot) {
  const hash = createHash("sha256");
  const paths = walk(candidateRoot).sort((a, b) => Buffer.from(a).compare(Buffer.from(b)));
  for (const path of paths) {
    const mode = lstatSync(join(candidateRoot, path)).mode & 0o111 ? "100755" : "100644";
    hash.update(path).update("\0").update(mode).update("\0").update(readFileSync(join(candidateRoot, path))).update("\0");
  }
  return { files: paths.length, sha256: hash.digest("hex") };
}

check("tracked source inventory and report schema are fixed", () => {
  assert.equal(handoff.schemaVersion, 3);
  assert.equal(report.schemaVersion, 3);
  assert.equal(report.manifestSha256, sha(readFileSync(join(root, "scripts/fixtures/sprint-040/downstream-handoff.json"))));
  assert.equal(report.sourceInventorySha256, sha(readFileSync(join(root, handoff.inventory))));
  assert.deepEqual(report.candidates.map((item) => item.id), ["agentic", "yasashii", "private-my-vault"]);
  assert.equal(new Set(inventory.surfaces.map((item) => item.id)).size, 17);
  assert.equal(report.publicWholeTree.root, handoff.publicWholeTree.root);
  assert.deepEqual(report.publicWholeTree.exclusions, handoff.publicWholeTree.exclusions);
  assert.equal(report.publicWholeTree.pathCount, report.publicWholeTree.paths.length);
  const agentic = report.candidates.find((item) => item.id === "agentic");
  assert.deepEqual(agentic.roles.parity.map((item) => item.path), report.publicWholeTree.paths);
});

check("handoff roles are exclusive and execution-derived", () => {
  for (const edition of report.candidates) {
    for (const paths of Object.values(edition.roleIntersections)) assert.deepEqual(paths, [], `${edition.id}:role-overlap`);
    const rolePaths = Object.values(edition.roles).flat().map((item) => item.path);
    assert.deepEqual(edition.declaredInputUnion, [...new Set(rolePaths)].sort((a, b) => Buffer.from(a).compare(Buffer.from(b))), `${edition.id}:declared-union`);
    assert.equal(new Set(rolePaths).size, rolePaths.length, `${edition.id}:exclusive-role-paths`);
    if (edition.id !== "agentic") {
      const writable = new Set([...edition.roles.parity, ...edition.roles.adapted].map((item) => item.path));
      assert.deepEqual(edition.actualCandidateDiffPaths.filter((path) => !writable.has(path)), [], `${edition.id}:unclassified-diff`);
      assert.deepEqual(edition.roles.supporting.map((item) => item.path).filter((path) => edition.actualCandidateDiffPaths.includes(path)), [], `${edition.id}:supporting-diff`);
      assert.ok(edition.roles.adapted.some((item) => item.path === "scripts/sprint-038-test.mjs"), `${edition.id}:sprint038-adapted`);
      assert.equal(edition.roles.parity.some((item) => item.path === "scripts/sprint-038-test.mjs"), false, `${edition.id}:sprint038-not-parity`);
      for (const item of edition.roles.adapted) {
        assert.equal(item.applicationCount, 1, `${edition.id}:${item.path}:application-count`);
        assert.ok(item.transformer, `${edition.id}:${item.path}:transformer`);
        assert.ok(item.anchors.length > 0, `${edition.id}:${item.path}:anchors`);
        assert.equal(item.anchorEvidence.length, item.anchors.length, `${edition.id}:${item.path}:anchor-evidence-count`);
        for (const evidence of item.anchorEvidence) {
          assert.equal(evidence.occurrenceCount, 1, `${edition.id}:${item.path}:anchor-occurrence`);
          assert.equal(evidence.applicationCount, 1, `${edition.id}:${item.path}:anchor-application`);
        }
        if (item.input === "public-source") assert.ok(edition.trace.copy.includes(item.path), `${edition.id}:${item.path}:copy-trace`);
      }
    }
    for (const action of ["read", "copy", "write", "execute", "protect"]) assert.ok(Array.isArray(edition.trace[action]), `${edition.id}:trace:${action}`);
    for (const item of Object.values(edition.roles).flat()) {
      const actualActions = Object.entries(edition.trace).filter(([, paths]) => paths.includes(item.path)).map(([action]) => action);
      assert.deepEqual(item.actions, actualActions, `${edition.id}:${item.path}:direct-action-trace`);
    }
  }
});

for (const edition of report.candidates) check(`${edition.id}: candidate root inventory body digest marker and tracked proof`, () => {
  const candidateRoot = join(reportRoot, edition.candidateRoot);
  assert.equal(existsSync(join(candidateRoot, ".git")), false, "candidate must be Git-free");
  assert.equal(edition.inventory.length, 17, `${edition.id}:inventory-count`);
  assert.deepEqual(edition.inventory.map((item) => item.id), inventory.surfaces.map((item) => item.id), `${edition.id}:inventory-surface-ids`);
  for (const item of edition.inventory) {
    const source = inventory.surfaces.find((entry) => entry.id === item.id);
    assert.ok(source, `${item.id}:source-entry`);
    assert.equal(item.appliesToEdition, source.editions.includes(edition.id), `${item.id}:edition-applicability`);
    assert.equal(item.tracked, true, `${item.id}:tracked`);
    const body = readFileSync(join(candidateRoot, item.path), "utf8");
    assert.equal(sha(Buffer.from(body)), item.candidateSha256, `${item.id}:digest`);
    assert.deepEqual(item.requiredMarkers, source.requiredMarkers ?? [], `${item.id}:marker-declaration`);
    for (const marker of item.requiredMarkers) assert.ok(body.includes(marker), `${item.id}:missing-marker:${marker}`);
    for (const marker of inventory.forbiddenLegacyMarkers) assert.equal(body.includes(marker), false, `${item.id}:legacy-marker:${marker}`);
    for (const phrase of inventory.forbiddenLegacyPhrases) assert.equal(body.includes(phrase), false, `${item.id}:legacy-phrase:${phrase}`);
  }
  assert.equal(new Set(edition.inventory.map((item) => item.id)).size, 17, `${edition.id}:unique-inventory-count`);
  for (const marker of inventory.requiredMarkers) assert.ok(edition.candidateMarkerCounts[marker] >= 3, `candidate-marker:${marker}`);
});

check("downstream fixed bases begin without Sprint 040 markers and candidates gain them", () => {
  for (const edition of report.candidates.filter((item) => item.id !== "agentic")) {
    for (const marker of inventory.requiredMarkers) {
      assert.equal(edition.baseMarkerCounts[marker], 0, `${edition.id}:base:${marker}`);
      assert.ok(edition.candidateMarkerCounts[marker] >= 3, `${edition.id}:candidate:${marker}`);
    }
  }
});

check("candidate IDs are derived from actual Git-free candidate content", () => {
  for (const edition of report.candidates) {
    const observed = candidateDigest(join(reportRoot, edition.candidateRoot));
    assert.deepEqual(observed, { files: edition.candidate.files, sha256: edition.candidate.sha256 }, edition.id);
    assert.match(edition.candidate.sha256, /^[a-f0-9]{64}$/u);
  }
});

check("edition protected bytes and offline-only publication boundary are unchanged", () => {
  for (const edition of report.candidates) assert.deepEqual(edition.protectedAfter, edition.protectedBefore, edition.id);
  for (const item of ["push", "tag", "release", "marketplace", "installed-cache", "workspace-migration", "new-session", "external-service"]) assert.ok(report.notExecuted.includes(item));
  assert.equal(report.publicationStatus, "source-candidate-offline-only");
});

console.log(`SPRINT040_INVENTORY_PASS=${pass} SPRINT040_INVENTORY_FAIL=${fail}`);
if (fail) process.exitCode = 1;
