#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const option = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? resolve(process.argv[index + 1]) : fallback;
};
const yasashiiSource = option("--yasashii-source", resolve(root, "../yasashii-secretary"));
const privateSource = option("--private-source", resolve(root, "../agentic-secretary-my-vault"));
const manifestPath = join(root, "scripts/fixtures/sprint-040/downstream-handoff.json");
const handoff = JSON.parse(readFileSync(manifestPath, "utf8"));
const legacy = JSON.parse(readFileSync(join(root, handoff.legacyObservation), "utf8"));
const temp = mkdtempSync(join(tmpdir(), "sprint-040-handoff-test."));
let pass = 0;
let fail = 0;

function check(label, fn) {
  try { fn(); pass += 1; console.log(`PASS ${label}`); }
  catch (error) { fail += 1; console.error(`FAIL ${label}:${error.stack || error.message}`); }
}
function runBuild(label, manifest, expectedPattern = null) {
  const fixture = join(temp, `${label}.json`);
  const output = join(temp, `${label}-candidate`);
  writeFileSync(fixture, `${JSON.stringify(manifest, null, 2)}\n`);
  const result = spawnSync(process.execPath, [join(root, "scripts/sprint-040-candidate-build.mjs"), "--public-root", root, "--manifest", fixture, "--output", output, "--yasashii-source", yasashiiSource, "--private-source", privateSource, "--skip-execute"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (expectedPattern === null) assert.equal(result.status, 0, result.stderr);
  else {
    assert.notEqual(result.status, 0, `${label}:must-fail`);
    assert.match(result.stderr, expectedPattern, `${label}:failure-reason`);
  }
}
const clone = () => structuredClone(handoff);

check("legacy schema 2 defect is derived from path sets", () => {
  const common = legacy.exactCommonPaths;
  const exact = legacy.yasashiiExactPaths;
  const intersection = common.filter((path) => exact.includes(path));
  const union = new Set([...common, ...exact]);
  const undeclared = legacy.observedBuilderMutations.filter((path) => !union.has(path));
  assert.equal(common.length, 23);
  assert.equal(exact.length, 5);
  assert.deepEqual(intersection, []);
  assert.equal(union.size, 28);
  assert.equal(legacy.observedActualDiff.length, 25);
  assert.deepEqual(undeclared, ["scripts/sprint-038-test.mjs"]);
});
check("normal manifest builds", () => runBuild("positive", clone()));
check("undeclared mutation fails", () => {
  const fixture = clone();
  const edition = fixture.editions.find((item) => item.id === "yasashii");
  edition.roles.adapted = edition.roles.adapted.filter((path) => path !== "scripts/sprint-038-test.mjs");
  delete edition.transformations["scripts/sprint-038-test.mjs"];
  runBuild("undeclared-mutation", fixture, /undeclared-mutation:scripts\/sprint-038-test\.mjs/u);
});
check("role overlap fails", () => {
  const fixture = clone();
  fixture.editions.find((item) => item.id === "yasashii").roles.supporting.push("plugins/secretary/skills/secretary/SKILL.md");
  runBuild("role-overlap", fixture, /role-overlap/u);
});
check("unused declaration fails", () => {
  const fixture = clone();
  fixture.editions.find((item) => item.id === "yasashii").roles.supporting.push("LICENSE");
  runBuild("unused-declaration", fixture, /unused-declaration:LICENSE/u);
});
check("stale path fails", () => {
  const fixture = clone();
  fixture.sharedParity.push("scripts/fixtures/sprint-040/stale-does-not-exist.txt");
  runBuild("stale-path", fixture, /stale-path:parity/u);
});
check("stale adapted anchor fails", () => {
  const fixture = clone();
  fixture.editions.find((item) => item.id === "yasashii").transformations["plugins/secretary/skills/secretary/SKILL.md"].anchors = ["THIS-ANCHOR-DOES-NOT-EXIST"];
  runBuild("stale-anchor", fixture, /transformation-anchor-count:plugins\/secretary\/skills\/secretary\/SKILL\.md/u);
});
check("multiple adapted anchor occurrences fail", () => {
  const fixture = clone();
  fixture.editions.find((item) => item.id === "private-my-vault").transformations["plugins/secretary/skills/daily/SKILL.md"].anchors = ["確認"];
  runBuild("multiple-anchor", fixture, /transformation-anchor-count:plugins\/secretary\/skills\/daily\/SKILL\.md/u);
});
check("stale public whole-tree root fails", () => {
  const fixture = clone();
  fixture.publicWholeTree.root = "THIS-ROOT-DOES-NOT-EXIST";
  runBuild("stale-public-root", fixture, /public-whole-tree-root-not-found/u);
});
check("empty public whole-tree exclusions fail", () => {
  const fixture = clone();
  fixture.publicWholeTree.exclusions = [];
  runBuild("empty-public-exclusions", fixture, /invalid-public-whole-tree-exclusions:empty/u);
});
check("declared transformer mismatch fails", () => {
  const fixture = clone();
  fixture.editions.find((item) => item.id === "yasashii").transformations["scripts/sprint-010-regression.sh"].transformer = "wrong-transformer";
  runBuild("transformer-mismatch", fixture, /transformation-mismatch:scripts\/sprint-010-regression\.sh/u);
});
check("unrelated existing anchor cannot replace actual transform anchors", () => {
  const fixture = clone();
  fixture.editions.find((item) => item.id === "private-my-vault").transformations["plugins/secretary/skills/daily/SKILL.md"].anchors = ["## 参照"];
  runBuild("anchor-transform-mismatch", fixture, /transformation-anchor-mismatch:plugins\/secretary\/skills\/daily\/SKILL\.md/u);
});

rmSync(temp, { recursive: true, force: true });
console.log(`SPRINT040_HANDOFF_PASS=${pass} SPRINT040_HANDOFF_FAIL=${fail}`);
if (fail) process.exitCode = 1;
