#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const FIXED_UPSTREAM = "24520a1d06f8d3833568a1386bf814e1085f5da9";
const candidateValue = process.argv.find((value, index) => process.argv[index - 1] === "--candidate")
  || process.env.AGENTIC_SECRETARY_CANDIDATE;
const requireWindows = process.argv.includes("--require-windows");
if (!candidateValue) {
  console.error("usage: sprint-038-patch-002-test.mjs --candidate <fixed-agentic-tree> [--require-windows]");
  process.exit(64);
}

const candidate = resolve(candidateValue);
const syncScript = join(ROOT, "scripts/sync-secretary-overlay.mjs");
const windowsTest = join(ROOT, "scripts/sprint-038-patch-002-windows-test.mjs");
const overlayRoot = join(ROOT, "secretary-overlay");
const snapshot = JSON.parse(readFileSync(join(overlayRoot, "upstream-tree.json"), "utf8"));
const downstreamFiles = JSON.parse(readFileSync(join(overlayRoot, "downstream-files.json"), "utf8")).files;
const managedClasses = new Set(["common", "metadata-overlay", "anchor-overlay"]);
let pass = 0;
let fail = 0;

function check(label, action) {
  try {
    action();
    pass += 1;
    console.log(`PASS ${label}`);
  } catch (error) {
    fail += 1;
    console.error(`FAIL ${label}: ${error.message}`);
  }
}

function runNode(script, args, { cwd = ROOT, expected = 0 } = {}) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8", shell: false });
  assert.equal(result.status, expected, `exit=${result.status}\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  return result;
}

function runSync(root, fixtureCandidate, mode, expected = 0, extra = []) {
  return runNode(syncScript, [
    mode,
    "--root", root,
    "--candidate", fixtureCandidate,
    "--observed-commit", FIXED_UPSTREAM,
    ...extra,
  ], { expected });
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const slash = (path) => path.split(sep).join("/");

function walkFiles(directory, base = directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(absolute, base));
    else if (entry.isFile()) files.push(slash(relative(base, absolute)));
    else throw new Error(`unsupported fixture entry: ${absolute}`);
  }
  return files.sort();
}

function treeDigest(directory) {
  const hash = createHash("sha256");
  for (const path of walkFiles(directory)) {
    hash.update(path).update("\0").update(readFileSync(join(directory, path))).update("\0");
  }
  return hash.digest("hex");
}

function copyPath(sourceRoot, targetRoot, path) {
  const target = join(targetRoot, path);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(join(sourceRoot, path), target);
}

function makeCandidateFixture(parent) {
  const fixture = join(parent, "candidate");
  for (const entry of snapshot.files) copyPath(candidate, fixture, entry.path);
  return fixture;
}

function makeDownstreamFixture(parent) {
  const fixture = join(parent, "downstream");
  for (const entry of snapshot.files.filter((item) => managedClasses.has(item.classification))) {
    copyPath(ROOT, fixture, entry.path);
  }
  for (const path of downstreamFiles) copyPath(ROOT, fixture, path);
  for (const path of [
    "README.md",
    "LICENSE",
    "plugins/secretary/rules/copy/yasashii.json",
    "plugins/secretary/rules/styles/yasashii.md",
    "scripts/archive-release-gate.mjs",
    "scripts/check-release-integrity.py",
  ]) copyPath(ROOT, fixture, path);
  mkdirSync(join(fixture, "docs/spec"), { recursive: true });
  mkdirSync(join(fixture, "docs/sprints"), { recursive: true });
  mkdirSync(join(fixture, "docs/progress"), { recursive: true });
  mkdirSync(join(fixture, "docs/feedback"), { recursive: true });
  mkdirSync(join(fixture, "docs/evidence"), { recursive: true });
  writeFileSync(join(fixture, "docs/spec/sentinel.md"), "spec sentinel\n");
  writeFileSync(join(fixture, "docs/sprints/sentinel.md"), "sprint sentinel\n");
  writeFileSync(join(fixture, "docs/progress/sentinel.md"), "progress sentinel\n");
  writeFileSync(join(fixture, "docs/feedback/sentinel.md"), "feedback sentinel\n");
  writeFileSync(join(fixture, "docs/evidence/sentinel.md"), "evidence sentinel\n");
  return fixture;
}

function output(result) {
  return `${result.stdout || ""}${result.stderr || ""}`;
}

function countLabels(source, prefix) {
  return source.split(/\r?\n/u).filter((line) => line.startsWith(prefix)).length;
}

check("fixed upstream base, release candidate and complete tree are recorded", () => {
  const base = JSON.parse(readFileSync(join(overlayRoot, "upstream-base.json"), "utf8"));
  assert.equal(base.baseCommit, FIXED_UPSTREAM);
  assert.equal(base.releaseCandidate, "0.9.2");
  assert.equal(base.externalLiveGate, "upstream-0.9.2-release-verified");
  assert.equal(base.remoteContract.upstreamPush, "disabled");
  assert.equal(snapshot.baseCommit, FIXED_UPSTREAM);
  assert.equal(snapshot.files.length, walkFiles(candidate).length);
  assert.deepEqual(snapshot.files.map((entry) => entry.path), walkFiles(candidate));
  for (const entry of snapshot.files) {
    assert.equal(entry.sha256, sha256(readFileSync(join(candidate, entry.path))), entry.path);
    assert.ok(["common", "metadata-overlay", "anchor-overlay", "upstream-only", "repo-owned"].includes(entry.classification));
  }
});

check("all declared common files are byte-identical to the fixed upstream", () => {
  const common = snapshot.files.filter((entry) => entry.classification === "common");
  assert.ok(common.length > 0);
  for (const entry of common) {
    assert.equal(sha256(readFileSync(join(ROOT, entry.path))), entry.sha256, entry.path);
  }
});

check("current overlay check protects owned and definition digests", () => {
  const result = runSync(ROOT, candidate, "--check");
  const text = output(result);
  assert.match(text, /OVERLAY_CHECK_PASS/);
  assert.match(text, /repoOwnedDigest=[a-f0-9]{64}/u);
  assert.match(text, /overlayDigest=[a-f0-9]{64}/u);
  assert.match(text, /upstreamPush=disabled/u);
});

check("Yasashii identity, copy, Harness route, rule graph and 0.10.1 release surfaces are intact", () => {
  const claudeMarket = JSON.parse(readFileSync(join(ROOT, ".claude-plugin/marketplace.json"), "utf8"));
  const codexMarket = JSON.parse(readFileSync(join(ROOT, ".agents/plugins/marketplace.json"), "utf8"));
  const claudePlugin = JSON.parse(readFileSync(join(ROOT, "plugins/secretary/.claude-plugin/plugin.json"), "utf8"));
  const codexPlugin = JSON.parse(readFileSync(join(ROOT, "plugins/secretary/.codex-plugin/plugin.json"), "utf8"));
  const edition = JSON.parse(readFileSync(join(ROOT, "plugins/secretary/edition.json"), "utf8"));
  const ruleManifest = JSON.parse(readFileSync(join(ROOT, "plugins/secretary/rules/rule-manifest.json"), "utf8"));
  assert.equal(claudeMarket.name, "yasashii-secretary");
  assert.equal(claudeMarket.plugins[0].version, "0.10.1");
  assert.equal(codexMarket.name, "yasashii-secretary");
  assert.equal(claudePlugin.name, "yasashii-secretary");
  assert.equal(claudePlugin.version, "0.10.1");
  assert.equal(codexPlugin.name, "yasashii-secretary");
  assert.equal(codexPlugin.version, "0.10.1");
  assert.equal(edition.edition, "yasashii-secretary");
  assert.equal(edition.copy.path, "rules/copy/yasashii.json");
  assert.equal(edition.harness.repository, "https://github.com/mtaiseeei/yasashii-harness");
  assert.equal(edition.harness.observedCommit, "f50917e3cf9c24b6e4370adba547bd4891c85986");
  assert.equal(edition.harness.version, "0.5.1");
  assert.equal(edition.harness.hosts.claudeCode.installId, "harness@yasashii-harness");
  assert.equal(edition.harness.hosts.codex.installId, "harness@yasashii-harness");
  const ruleNames = Object.keys(ruleManifest.rules);
  assert.equal(ruleManifest.priority.length, ruleNames.length);
  assert.equal(new Set(ruleManifest.priority).size, ruleNames.length);
  assert.ok(ruleNames.every((name) => ruleManifest.priority.includes(name)));
  assert.equal(ruleManifest.priority.filter((name) => name === "agentic-style").length, 0);
  assert.equal(ruleManifest.priority.filter((name) => name === "conversation-contract").length, 1);
  assert.ok(ruleManifest.priority.indexOf("conversation-contract") < ruleManifest.priority.indexOf("yasashii-style"));
  for (const dependency of ["evidence", "safety", "common-language", "conversation-contract"]) {
    assert.ok(ruleManifest.rules["yasashii-style"].dependencies.includes(dependency), dependency);
  }
  const canonical = readFileSync(join(ROOT, "plugins/secretary/CHANGELOG.md"));
  const legacy = readFileSync(join(ROOT, "plugins/yasashii-secretary/CHANGELOG.md"));
  assert.ok(canonical.equals(legacy));
  assert.match(canonical.toString("utf8"), /^# 変更履歴\n\n## \[0\.9\.2\]/u);
  const privateEditionPhrase = ["my", "vault"].join("-");
  assert.doesNotMatch(canonical.toString("utf8"), new RegExp(`対応済み.*${privateEditionPhrase}|${privateEditionPhrase}.*対応済み`, "u"));
});

check("the same 12 Windows labels run locally and native requirement cannot fake PASS", () => {
  const args = requireWindows ? ["--require-windows"] : [];
  const result = runNode(windowsTest, args);
  const text = output(result);
  assert.equal(countLabels(text, "PASS "), 12, text);
  assert.equal(countLabels(text, "FAIL "), 0, text);
  assert.match(text, /SPRINT038_PATCH002_WINDOWS_PASS=12 FAIL=0/u);
  if (process.platform === "win32") {
    console.log(`WINDOWS_NATIVE=run OS=${process.platform} node=${process.version}`);
  } else {
    console.log(`WINDOWS_NATIVE=not-run OS=${process.platform} node=${process.version}`);
    const negative = runNode(windowsTest, ["--require-windows"], { expected: 1 });
    const negativeText = output(negative);
    assert.equal(countLabels(negativeText, "PASS "), 11, negativeText);
    assert.equal(countLabels(negativeText, "FAIL "), 1, negativeText);
    assert.match(negativeText, /Windowsネイティブrunnerではありません/u);
  }
});

const temp = mkdtempSync(join(tmpdir(), "yasashii-s038p002-overlay-"));
try {
  const fixtureCandidate = makeCandidateFixture(temp);
  const fixtureDownstream = makeDownstreamFixture(temp);

  check("record then apply, check and reapply is exact and idempotent", () => {
    const record = runSync(fixtureDownstream, fixtureCandidate, "--record");
    assert.match(output(record), new RegExp(`RECORDED upstream=${FIXED_UPSTREAM} files=${snapshot.files.length}`));
    const changedPath = join(fixtureDownstream, "plugins/secretary/scripts/lib/safe-fs.mjs");
    writeFileSync(changedPath, "changed before reviewed apply\n");
    const beforeOwned = [
      "README.md", "LICENSE", "docs/spec/sentinel.md", "docs/sprints/sentinel.md",
      "docs/progress/sentinel.md", "docs/feedback/sentinel.md", "docs/evidence/sentinel.md",
      "plugins/secretary/rules/copy/yasashii.json", "plugins/secretary/rules/styles/yasashii.md",
    ].map((path) => sha256(readFileSync(join(fixtureDownstream, path))));
    const apply = runSync(fixtureDownstream, fixtureCandidate, "--apply");
    assert.match(output(apply), /changed=1/u);
    assert.deepEqual([
      "README.md", "LICENSE", "docs/spec/sentinel.md", "docs/sprints/sentinel.md",
      "docs/progress/sentinel.md", "docs/feedback/sentinel.md", "docs/evidence/sentinel.md",
      "plugins/secretary/rules/copy/yasashii.json", "plugins/secretary/rules/styles/yasashii.md",
    ].map((path) => sha256(readFileSync(join(fixtureDownstream, path)))), beforeOwned);
    assert.match(output(runSync(fixtureDownstream, fixtureCandidate, "--check")), /OVERLAY_CHECK_PASS/u);
    assert.match(output(runSync(fixtureDownstream, fixtureCandidate, "--reapply")), /secondChanged=0/u);
  });

  function rejectedWithoutTargetMutation(label, mutate, restore, pattern, expected = 1) {
    check(label, () => {
      mutate();
      const before = treeDigest(fixtureDownstream);
      try {
        assert.match(output(runSync(fixtureDownstream, fixtureCandidate, "--apply", expected)), pattern);
        assert.equal(treeDigest(fixtureDownstream), before);
      } finally {
        restore();
      }
    });
  }

  const added = join(fixtureCandidate, "plugins/secretary/unclassified-added.mjs");
  rejectedWithoutTargetMutation(
    "unclassified upstream addition stops with zero downstream side effects",
    () => writeFileSync(added, "export default true;\n"),
    () => rmSync(added, { force: true }),
    /added=\[plugins\/secretary\/unclassified-added\.mjs\]/u,
  );

  const deletedRelative = "plugins/secretary/scripts/lib/safe-fs.mjs";
  const deletedPath = join(fixtureCandidate, deletedRelative);
  const deletedBytes = readFileSync(deletedPath);
  rejectedWithoutTargetMutation(
    "upstream deletion stops with zero downstream side effects",
    () => rmSync(deletedPath),
    () => { mkdirSync(dirname(deletedPath), { recursive: true }); writeFileSync(deletedPath, deletedBytes); },
    /deleted=.*plugins\/secretary\/scripts\/lib\/safe-fs\.mjs/u,
  );

  const anchorsPath = join(fixtureDownstream, "secretary-overlay/anchors.json");
  const anchorsBytes = readFileSync(anchorsPath);
  rejectedWithoutTargetMutation(
    "missing anchor stops before any managed write",
    () => {
      const document = JSON.parse(anchorsBytes.toString("utf8"));
      document.anchors.find((entry) => entry.id === "plain-language-active-style").match = "missing anchor text";
      writeFileSync(anchorsPath, `${JSON.stringify(document, null, 2)}\n`);
    },
    () => writeFileSync(anchorsPath, anchorsBytes),
    /expected once, found 0/u,
  );
  rejectedWithoutTargetMutation(
    "duplicate anchor stops before any managed write",
    () => {
      const document = JSON.parse(anchorsBytes.toString("utf8"));
      const entry = document.anchors.find((item) => item.id === "plain-language-active-style");
      entry.match = "agentic";
      writeFileSync(anchorsPath, `${JSON.stringify(document, null, 2)}\n`);
    },
    () => writeFileSync(anchorsPath, anchorsBytes),
    /expected once, found [2-9][0-9]*/u,
  );

  const candidateManifestPath = join(fixtureCandidate, "plugins/secretary/.claude-plugin/plugin.json");
  const candidateManifestBytes = readFileSync(candidateManifestPath);
  rejectedWithoutTargetMutation(
    "upstream metadata change outside the recorded allowlist is rejected without downstream writes",
    () => {
      const document = JSON.parse(candidateManifestBytes.toString("utf8"));
      document.license = "NOT-MIT";
      writeFileSync(candidateManifestPath, `${JSON.stringify(document, null, 2)}\n`);
    },
    () => writeFileSync(candidateManifestPath, candidateManifestBytes),
    /upstream allowlisted bytes changed: plugins\/secretary\/\.claude-plugin\/plugin\.json/u,
  );

  const metadataPath = join(fixtureDownstream, "secretary-overlay/metadata-overrides.json");
  const metadataBytes = readFileSync(metadataPath);
  rejectedWithoutTargetMutation(
    "Yasashii protected identity cannot be changed by overlay definitions",
    () => {
      const document = JSON.parse(metadataBytes.toString("utf8"));
      document.files["plugins/secretary/.claude-plugin/plugin.json"].find((entry) => entry.pointer === "/name").value = "agentic-secretary";
      writeFileSync(metadataPath, `${JSON.stringify(document, null, 2)}\n`);
    },
    () => writeFileSync(metadataPath, metadataBytes),
    /Yasashii protected surface changed/u,
  );

  const treePath = join(fixtureDownstream, "secretary-overlay/upstream-tree.json");
  const treeBytes = readFileSync(treePath);
  rejectedWithoutTargetMutation(
    "base and tree mismatch stops before managed writes",
    () => {
      const document = JSON.parse(treeBytes.toString("utf8"));
      document.baseCommit = "deadbeef";
      writeFileSync(treePath, `${JSON.stringify(document, null, 2)}\n`);
    },
    () => writeFileSync(treePath, treeBytes),
    /upstream-tree\.json is not recorded for the declared base/u,
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}

check("release integrity is green and product entrypoints have no Bash dependency", () => {
  const validator = spawnSync("python3", [join(ROOT, "scripts/check-release-integrity.py"), "--root", ROOT], { cwd: ROOT, encoding: "utf8" });
  assert.equal(validator.status, 0, `${validator.stdout}${validator.stderr}`);
  for (const path of [
    "plugins/secretary/scripts/project-tools.mjs",
    "plugins/secretary/scripts/owner-name-transaction.mjs",
    "plugins/secretary/scripts/workspace-tools.mjs",
    "plugins/secretary/skills/memory-care/scripts/memory-tools.mjs",
  ]) assert.doesNotMatch(readFileSync(join(ROOT, path), "utf8"), /runExternalSync\(["']bash["']|spawnSync\(["']bash["']/u, path);
});

console.log(`SPRINT038_PATCH002_PASS=${pass} SPRINT038_PATCH002_FAIL=${fail} WINDOWS_NATIVE=${process.platform === "win32" ? "run" : "not-run"}`);
process.exitCode = fail ? 1 : 0;
