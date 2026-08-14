#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const plugin = join(root, "plugins/secretary");
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
let pass = 0;
let fail = 0;

function check(label, fn) {
  try {
    fn();
    pass += 1;
    process.stdout.write(`PASS ${label}\n`);
  } catch (error) {
    fail += 1;
    process.stderr.write(`FAIL ${label}: ${error.message}\n`);
  }
}

check("0.9.2 history remains and current release surfaces are exactly 0.10.1", () => {
  assert.equal(json(join(root, ".claude-plugin/marketplace.json")).plugins[0].version, "0.10.1");
  assert.equal(json(join(plugin, ".claude-plugin/plugin.json")).version, "0.10.1");
  assert.equal(json(join(plugin, ".codex-plugin/plugin.json")).version, "0.10.1");
  const canonical = readFileSync(join(plugin, "CHANGELOG.md"), "utf8");
  const legacy = readFileSync(join(root, "plugins/yasashii-secretary/CHANGELOG.md"), "utf8");
  assert.match(canonical, /^# 変更履歴\n\n## \[0\.10\.1\] - 2026-08-14/);
  assert.match(canonical, /## \[0\.9\.2\] - 2026-08-10/);
  assert.match(canonical, /## \[0\.9\.1\] - 2026-08-03/);
  assert.equal(legacy, canonical);
});

check("Harness 0.5.1 and its public full commit are canonical", () => {
  const harness = json(join(plugin, "edition.json")).harness;
  assert.equal(harness.version, "0.5.1");
  assert.equal(harness.repository, "https://github.com/mtaiseeei/yasashii-harness");
  assert.equal(harness.observedCommit, "f50917e3cf9c24b6e4370adba547bd4891c85986");
  assert.match(harness.observedCommit, /^[a-f0-9]{40}$/);
});

check("Claude Code and Codex keep distinct install routes", () => {
  const harness = json(join(plugin, "edition.json")).harness;
  assert.deepEqual(harness.hosts.claudeCode, {
    marketplace: "yasashii-harness",
    installId: "harness@yasashii-harness",
    explicitEntry: "/harness",
  });
  assert.deepEqual(harness.hosts.codex, {
    marketplace: "yasashii-harness",
    installId: "harness@yasashii-harness",
    explicitEntries: ["$using-harness", "$harness-loop"],
  });
});

check("README and build skill describe the same separate Harness release", () => {
  const readme = readFileSync(join(root, "README.md"), "utf8");
  const build = readFileSync(join(plugin, "skills/build/SKILL.md"), "utf8");
  for (const source of [readme, build]) {
    assert(source.includes("0.5.1"));
    assert(source.includes("https://github.com/mtaiseeei/yasashii-harness"));
    assert(source.includes("harness@yasashii-harness"));
    assert(source.includes("/harness"));
    assert(source.includes("$using-harness"));
    assert(source.includes("$harness-loop"));
  }
});

check("0.9.1 adds no workspace migration or bundled Harness agent", () => {
  assert.equal(existsSync(join(plugin, "migrations/0.9.0-to-0.9.1.json")), false);
  for (const path of ["harness", "agents", "commands", "hooks", ".codex/agents"]) {
    assert.equal(existsSync(join(plugin, path)), false, path);
  }
  const manifests = [
    json(join(plugin, ".claude-plugin/plugin.json")),
    json(join(plugin, ".codex-plugin/plugin.json")),
  ];
  for (const manifest of manifests) assert.equal(Object.hasOwn(manifest, "dependencies"), false);
});

check("0.9.0 release and migration history remain present", () => {
  const changelog = readFileSync(join(plugin, "CHANGELOG.md"), "utf8");
  assert(changelog.includes("## [0.9.0] - 2026-07-31"));
  const migration = json(join(plugin, "migrations/0.8.0-to-0.9.0.json"));
  assert.equal(migration.fromVersion, "0.8.0");
  assert.equal(migration.toVersion, "0.9.0");
  assert.equal(migration.operations[0].type, "replace-section");
  assert.deepEqual(readdirSync(join(root, "plugins/yasashii-secretary")), ["CHANGELOG.md"]);
});

process.stdout.write(`SPRINT038_PATCH001_PASS=${pass} SPRINT038_PATCH001_FAIL=${fail}\n`);
process.exitCode = fail === 0 ? 0 : 1;
