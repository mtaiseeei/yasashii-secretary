#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const candidate = resolve(process.argv[2] || "/Users/taisei/workspace/agentic-secretary");
const syncScript = join(root, "scripts/sync-secretary-overlay.mjs");
const snapshot = JSON.parse(readFileSync(join(root, "secretary-overlay/upstream-tree.json"), "utf8"));
const downstreamFiles = JSON.parse(readFileSync(join(root, "secretary-overlay/downstream-files.json"), "utf8")).files;

let pass = 0;
let fail = 0;

function check(label, fn) {
  try {
    fn();
    pass += 1;
    console.log(`PASS ${label}`);
  } catch (error) {
    fail += 1;
    console.error(`FAIL ${label}: ${error.message}`);
  }
}

function run(args, expected = 0) {
  const result = spawnSync(process.execPath, [syncScript, ...args], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, expected, `exit=${result.status}\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  return `${result.stdout}${result.stderr}`;
}

const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const treeDigest = (treeRoot, paths) => {
  const hash = createHash("sha256");
  for (const path of [...paths].sort()) hash.update(path).update("\0").update(readFileSync(join(treeRoot, path))).update("\0");
  return hash.digest("hex");
};

function copyFile(sourceRoot, targetRoot, path) {
  const target = join(targetRoot, path);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(join(sourceRoot, path), target, { preserveTimestamps: false });
}

function makeCandidateFixture(parent) {
  const fixture = join(parent, "candidate");
  for (const entry of snapshot.files) copyFile(candidate, fixture, entry.path);
  return fixture;
}

function makeDownstreamFixture(parent) {
  const fixture = join(parent, "downstream");
  const managed = snapshot.files.filter((entry) => ["common", "metadata-overlay", "anchor-overlay"].includes(entry.classification));
  for (const entry of managed) copyFile(root, fixture, entry.path);
  for (const path of downstreamFiles) copyFile(root, fixture, path);
  mkdirSync(join(fixture, "docs/spec"), { recursive: true });
  writeFileSync(join(fixture, "README.md"), "repo-owned README sentinel\n");
  writeFileSync(join(fixture, "LICENSE"), "repo-owned LICENSE sentinel\n");
  writeFileSync(join(fixture, "docs/spec/sentinel.md"), "repo-owned spec sentinel\n");
  mkdirSync(join(fixture, "docs/evidence"), { recursive: true });
  writeFileSync(join(fixture, "docs/evidence/sentinel.txt"), "repo-owned evidence sentinel\n");
  return fixture;
}

check("recorded upstream base and local candidate are exact", () => {
  const output = run(["--check", "--candidate", candidate]);
  assert.match(output, /OVERLAY_CHECK_PASS/);
  assert.match(output, /external-live-gate-unavailable/);
});

check("common safety and wizard implementation match upstream bytes", () => {
  for (const path of [
    "plugins/secretary/rules/safety.md",
    "plugins/secretary/scripts/lib/path-guard.sh",
    "plugins/secretary/scripts/lib/edition-guard.mjs",
    "plugins/secretary/scripts/lib/wizard-product-identity.mjs",
    "plugins/secretary/skills/chatwork/scripts/wizard-server.mjs",
    "plugins/secretary/skills/google-chat/scripts/wizard-server.mjs",
  ]) assert.equal(digest(join(root, path)), digest(join(candidate, path)), path);
});

check("wizard DOM/copy/OAuth/sync assets remain byte-identical", () => {
  for (const path of [
    "plugins/secretary/skills/chatwork/assets/wizard/index.html",
    "plugins/secretary/skills/chatwork/assets/wizard/app.js",
    "plugins/secretary/skills/chatwork/assets/wizard/common.js",
    "plugins/secretary/skills/chatwork/assets/wizard/style.css",
    "plugins/secretary/skills/google-chat/assets/wizard/app.js",
    "plugins/secretary/skills/google-chat/scripts/oauth-session.mjs",
    "plugins/secretary/skills/google-chat/scripts/client.mjs",
    "plugins/secretary/skills/google-chat/scripts/sync.mjs",
  ]) assert.equal(digest(join(root, path)), digest(join(candidate, path)), path);
});

check("yasashii settings display is readable and does not leak values", () => {
  const yasashii = readFileSync(join(root, "plugins/secretary/skills/settings/SKILL.md"), "utf8");
  const agentic = readFileSync(join(candidate, "plugins/secretary/skills/settings/SKILL.md"), "utf8");
  assert(agentic.includes("<変更項目>=<値>"), "agentic direct display must remain upstream-owned");
  assert(!yasashii.includes("<変更項目>=<値>"));
  assert(yasashii.includes("- 変更する項目: <日本語の項目名>"));
  assert(yasashii.includes("- 内部の正式key: `<セクション>.<キー>`"));
  assert(yasashii.includes("値は表示しません"));
  assert(yasashii.includes("`言葉遣い.報告の詳しさ`"));
  assert(!yasashii.includes("設定を変更: <変更項目>=<値>"));
});

check("edition metadata stays yasashii and release candidate stays 0.8.0", () => {
  const edition = JSON.parse(readFileSync(join(root, "plugins/secretary/edition.json"), "utf8"));
  const marketplace = JSON.parse(readFileSync(join(root, ".claude-plugin/marketplace.json"), "utf8"));
  const manifest = JSON.parse(readFileSync(join(root, "plugins/secretary/.claude-plugin/plugin.json"), "utf8"));
  const codexMarketplace = JSON.parse(readFileSync(join(root, ".agents/plugins/marketplace.json"), "utf8"));
  const codexManifest = JSON.parse(readFileSync(join(root, "plugins/secretary/.codex-plugin/plugin.json"), "utf8"));
  assert.equal(edition.edition, "yasashii-secretary");
  assert.equal(edition.copy.path, "rules/copy/yasashii.json");
  assert.equal(edition.harness.installId, "harness@yasashii-harness");
  assert.equal(edition.harness.version, "0.5.0");
  assert.equal(edition.harness.repository, "https://github.com/mtaiseeei/yasashii-harness");
  assert.equal(edition.harness.hosts.claudeCode.installId, "harness@yasashii-harness");
  assert.equal(edition.harness.hosts.codex.installId, "harness@yasashii-harness");
  assert.equal(marketplace.plugins[0].version, "0.8.0");
  assert.equal(manifest.version, "0.8.0");
  assert.equal(codexMarketplace.name, "yasashii-secretary");
  assert.equal(codexMarketplace.plugins[0].name, "yasashii-secretary");
  assert.equal(codexManifest.name, "yasashii-secretary");
  assert.equal(codexManifest.version, "0.8.0");
  assert.equal(codexManifest.skills, "./skills/");
  assert.equal(marketplace.plugins[0].forkedFrom, "https://github.com/Shin-sibainu/cc-company");
});

const temp = mkdtempSync(join(tmpdir(), "secretary-overlay-sprint034-"));
try {
  const fixtureCandidate = makeCandidateFixture(temp);
  const fixtureDownstream = makeDownstreamFixture(temp);
  const managedPaths = snapshot.files.filter((entry) => ["common", "metadata-overlay", "anchor-overlay"].includes(entry.classification)).map((entry) => entry.path);
  const ownedPaths = ["README.md", "LICENSE", "docs/spec/sentinel.md", "docs/evidence/sentinel.txt"];
  const ownedBefore = treeDigest(fixtureDownstream, ownedPaths);

  check("apply twice has the same managed digest and preserves repo-owned bytes", () => {
    const first = run(["--apply", "--root", fixtureDownstream, "--candidate", fixtureCandidate]);
    assert.match(first, /changed=0/);
    const firstDigest = treeDigest(fixtureDownstream, managedPaths);
    const second = run(["--reapply", "--root", fixtureDownstream, "--candidate", fixtureCandidate]);
    assert.match(second, /secondChanged=0/);
    assert.equal(treeDigest(fixtureDownstream, managedPaths), firstDigest);
    assert.equal(treeDigest(fixtureDownstream, ownedPaths), ownedBefore);
  });

  check("unclassified upstream addition is rejected", () => {
    const path = join(fixtureCandidate, "plugins/secretary/unclassified-new.mjs");
    writeFileSync(path, "export default true;\n");
    assert.match(run(["--check", "--root", fixtureDownstream, "--candidate", fixtureCandidate], 1), /added=\[plugins\/secretary\/unclassified-new\.mjs\]/);
    rmSync(path);
  });

  check("upstream deletion is rejected", () => {
    const path = "plugins/secretary/rules/safety.md";
    const backup = readFileSync(join(fixtureCandidate, path));
    rmSync(join(fixtureCandidate, path));
    assert.match(run(["--check", "--root", fixtureDownstream, "--candidate", fixtureCandidate], 1), /deleted=.*plugins\/secretary\/rules\/safety\.md/);
    mkdirSync(dirname(join(fixtureCandidate, path)), { recursive: true });
    writeFileSync(join(fixtureCandidate, path), backup);
  });

  check("missing anchor is rejected", () => {
    const anchorPath = join(fixtureDownstream, "secretary-overlay/anchors.json");
    const original = readFileSync(anchorPath, "utf8");
    const altered = JSON.parse(original);
    const target = altered.anchors.find((entry) => entry.id === "plain-language-active-style");
    assert.ok(target, "plain-language anchor must be declared");
    target.match = "missing anchor text";
    try {
      writeFileSync(anchorPath, `${JSON.stringify(altered, null, 2)}\n`);
      assert.match(run(["--check", "--root", fixtureDownstream, "--candidate", fixtureCandidate], 1), /anchor plain-language-active-style expected once, found 0/);
    } finally {
      writeFileSync(anchorPath, original);
    }
  });

  check("metadata change outside the allowlist result is rejected", () => {
    const manifestPath = join(fixtureDownstream, "plugins/secretary/.claude-plugin/plugin.json");
    const original = readFileSync(manifestPath, "utf8");
    const changed = JSON.parse(original);
    changed.version = "9.9.9";
    try {
      writeFileSync(manifestPath, `${JSON.stringify(changed, null, 2)}\n`);
      assert.match(run(["--check", "--root", fixtureDownstream, "--candidate", fixtureCandidate], 1), /plugin\.json:bytes/);
    } finally {
      writeFileSync(manifestPath, original);
    }
  });

  check("upstream advance is a distinct exit 2 warning", () => {
    assert.match(run(["--check", "--root", fixtureDownstream, "--candidate", fixtureCandidate, "--observed-commit", "deadbeef"], 2), /UPSTREAM_ADVANCE/);
  });
} finally {
  rmSync(temp, { recursive: true, force: true });
}

console.log(`SPRINT034_PASS=${pass} SPRINT034_FAIL=${fail}`);
process.exit(fail === 0 ? 0 : 1);
