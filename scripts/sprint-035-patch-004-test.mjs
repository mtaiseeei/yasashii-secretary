#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = join(root, "plugins/secretary");
const wrapper = join(root, "scripts/generic-skill-validate.mjs");
const validator = process.env.QUICK_VALIDATE_PATH;
const pythonPath = process.env.QUICK_VALIDATE_PYTHONPATH;
let passed = 0;

function check(label, callback) {
  callback();
  passed += 1;
  process.stdout.write(`PASS ${label}\n`);
}

function frontmatter(path) {
  const content = readFileSync(path, "utf8");
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  assert(match, `frontmatter missing: ${path}`);
  return match[1];
}

function keys(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => /^[A-Za-z][A-Za-z0-9_-]*:/.test(line))
    .map((line) => line.slice(0, line.indexOf(":")))
    .sort();
}

function run(args, env = {}) {
  return spawnSync(process.execPath, [wrapper, ...args], {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

check("secretary and update use only official frontmatter fields and keep both host entrypoints", () => {
  for (const [name, claudeEntry, codexEntry] of [
    ["secretary", "/secretary", "$secretary"],
    ["update", "/update", "$update"],
  ]) {
    const text = frontmatter(join(pluginRoot, "skills", name, "SKILL.md"));
    assert.deepEqual(keys(text), ["description", "name"]);
    assert(text.includes(claudeEntry), `${name} lost Claude Code entrypoint`);
    assert(text.includes(codexEntry), `${name} lost Codex entrypoint`);
  }
});

check("all public Skills avoid the unsupported trigger field", () => {
  for (const name of [
    "build", "chatwork", "connections", "daily", "google-chat", "memory-care", "onboarding",
    "projects", "secretary", "settings", "setup-google", "setup-microsoft", "setup-notion", "update", "weekly",
  ]) {
    assert(!keys(frontmatter(join(pluginRoot, "skills", name, "SKILL.md"))).includes("trigger"), name);
  }
});

check("missing PyYAML is reported as incomplete before any Skill is classified", () => {
  const fixture = mkdtempSync("/private/tmp/agentic-generic-validator-");
  const fakePython = join(fixture, "python-without-yaml");
  try {
    writeFileSync(fakePython, "#!/bin/sh\nexit 1\n");
    chmodSync(fakePython, 0o755);
    const result = run([
      "--plugin-root", pluginRoot,
      "--validator", validator ?? wrapper,
      "--python", fakePython,
    ]);
    assert.equal(result.status, 2);
    assert.match(result.stdout, /GENERIC_SKILL_VALIDATE_INCOMPLETE status=dependency-unavailable/);
    assert.match(result.stdout, /checked=0 passed=0 failed=0 total=16/);
    assert.doesNotMatch(result.stdout, /^PASS |^FAIL /m);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

if (validator && pythonPath) {
  check("system quick_validate accepts all 15 public Skills", () => {
    const result = run([
      "--plugin-root", pluginRoot,
      "--validator", validator,
      "--pythonpath", pythonPath,
    ]);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /status=pass checked=16 passed=16 failed=0 total=16/);
  });

  check("system quick_validate still rejects an unsupported trigger field", () => {
    const fixture = mkdtempSync("/private/tmp/agentic-generic-negative-");
    try {
      mkdirSync(join(fixture, "skills/bad"), { recursive: true });
      writeFileSync(
        join(fixture, "skills/bad/SKILL.md"),
        "---\nname: bad\ndescription: negative fixture\ntrigger: /bad\n---\n",
      );
      const result = run([
        "--plugin-root", fixture,
        "--validator", validator,
        "--pythonpath", pythonPath,
      ]);
      assert.equal(result.status, 1);
      assert.match(result.stdout, /FAIL bad: Unexpected key\(s\).*trigger/);
      assert.match(result.stdout, /status=fail checked=1 passed=0 failed=1 total=1/);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
} else {
  process.stdout.write(
    "INCOMPLETE actual quick_validate scenarios require QUICK_VALIDATE_PATH and QUICK_VALIDATE_PYTHONPATH\n",
  );
}

process.stdout.write(`SPRINT_035_PATCH_004_PASS=${passed} FAIL=0\n`);
