#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { applyInit } from "../plugins/secretary/scripts/lib/clarity-core.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const plugin = join(repo, "plugins/secretary");
const router = join(plugin, "scripts/clarity-hook.mjs");
const cli = join(plugin, "scripts/clarity.mjs");
const skillPath = join(plugin, "skills/clarity/SKILL.md");
const work = mkdtempSync("/private/tmp/yasashii-s045-hook-");
const fixedNow = "2026-09-07T12:00:00.000Z";
const canonicalNames = ["project.json", "events.jsonl", "evidence.jsonl", "state.json"];
let passed = 0;

function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function write(path, value) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); }
function snapshotTree(root) {
  if (!existsSync(root)) return "missing";
  const rows = [];
  function visit(directory, prefix = "") {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name);
      const relative = prefix ? `${prefix}/${name}` : name;
      const stat = lstatSync(path);
      if (stat.isDirectory()) { rows.push([relative, "directory"]); visit(path, relative); }
      else if (stat.isFile()) rows.push([relative, "file", sha(readFileSync(path))]);
      else rows.push([relative, stat.isSymbolicLink() ? "symlink" : "other"]);
    }
  }
  visit(root);
  return JSON.stringify(rows);
}
function canonicalSnapshot(root) {
  return JSON.stringify(canonicalNames.map((name) => [name, sha(readFileSync(join(root, ".clarity", name)))]));
}
function runtimeFiles(root) {
  const base = join(root, ".clarity/runtime/hooks/events");
  if (!existsSync(base)) return [];
  const files = [];
  for (const session of readdirSync(base)) {
    const directory = join(base, session);
    if (!lstatSync(directory).isDirectory()) continue;
    for (const name of readdirSync(directory)) files.push(join(directory, name));
  }
  return files;
}
function initialized(name) {
  const root = join(work, name);
  mkdirSync(root, { recursive: true });
  write(join(root, "README.md"), `# ${name}\n`);
  write(join(root, "src/feature.mjs"), "export const feature = true;\n");
  const git = spawnSync("git", ["init", "--quiet", root], { encoding: "utf8", timeout: 5_000 });
  assert.equal(git.status, 0, git.stderr);
  applyInit(root);
  return root;
}
function payload(event, root, extra = {}) {
  return { session_id: "patch-session", turn_id: "turn-1", cwd: root, hook_event_name: event, model: "fixture-model", ...extra };
}
function runHook(input, env = {}) {
  const result = spawnSync(process.execPath, [router], {
    input: JSON.stringify(input), encoding: "utf8", timeout: 5_000,
    env: { ...process.env, CLARITY_NOW: fixedNow, ...env },
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
}
function runCli(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8", timeout: 10_000, env: { ...process.env, CLARITY_NOW: fixedNow },
  });
}
function test(name, fn) {
  fn();
  passed += 1;
  process.stdout.write(`PASS ${name}\n`);
}

try {
  process.env.CLARITY_NOW = fixedNow;

  test("Stop output separates notification from authorization", () => {
    const root = initialized("stop-authorization");
    const outside = join(work, "outside-canary");
    mkdirSync(outside);
    write(join(outside, "sentinel.txt"), "unchanged\n");
    runHook(payload("PostToolUse", root, {
      tool_name: "apply_patch", tool_use_id: "patch-1",
      tool_input: { command: "*** Begin Patch\n*** Update File: src/feature.mjs\n*** End Patch" },
    }));
    const canonicalBefore = canonicalSnapshot(root);
    const gitBefore = snapshotTree(join(root, ".git"));
    const outsideBefore = snapshotTree(outside);
    const output = runHook(payload("Stop", root, { stop_hook_active: false }));
    assert.equal(output.decision, "block");
    assert.match(output.reason, /Hook通知.*許可ではなく/u);
    assert.match(output.reason, /変更禁止.*read-only.*対象path制限.*上書きしません/u);
    assert.match(output.reason, /対象.*操作.*範囲/u);
    assert.match(output.reason, /既存境界に反しない場合だけ/u);
    assert.match(output.reason, /未承認.*影響.*確認/u);
    assert.equal(canonicalSnapshot(root), canonicalBefore);
    assert.equal(snapshotTree(join(root, ".git")), gitBefore);
    assert.equal(snapshotTree(outside), outsideBefore);
    assert.equal(runtimeFiles(root).map((path) => JSON.parse(readFileSync(path))).filter((row) => row.kind === "checkpoint-request").length, 1);
    const runtimeCount = runtimeFiles(root).length;
    assert.deepEqual(runHook(payload("Stop", root, { stop_hook_active: true })), {});
    assert.equal(runtimeFiles(root).length, runtimeCount);
    process.stdout.write(`OBSERVED Stop: ${JSON.stringify(output)}\n`);
  });

  test("no-material Stop is no-op", () => {
    const noMaterial = initialized("no-material");
    assert.deepEqual(runHook(payload("Stop", noMaterial)), {});
    assert.equal(runtimeFiles(noMaterial).length, 0);
  });

  test("checkpointed and uninitialized Stop are no-op", () => {
    const checkpointed = initialized("checkpointed");
    runHook(payload("PostToolUse", checkpointed, {
      tool_name: "Write", tool_use_id: "write-1", tool_input: { file_path: join(checkpointed, "src/feature.mjs") },
    }));
    const checkpoint = runCli(["checkpoint", checkpointed, "--operation-id", "fixture-approved-checkpoint", "--json"]);
    assert.equal(checkpoint.status, 0, checkpoint.stderr);
    const countBefore = runtimeFiles(checkpointed).length;
    assert.deepEqual(runHook(payload("Stop", checkpointed)), {});
    assert.equal(runtimeFiles(checkpointed).length, countBefore);
    const uninitialized = join(work, "uninitialized");
    mkdirSync(uninitialized);
    assert.deepEqual(runHook(payload("Stop", uninitialized)), {});
    assert.equal(existsSync(join(uninitialized, ".clarity")), false);
  });

  test("disabled Hook writes nothing and manual read-only entrypoints remain", () => {
    const root = initialized("disabled");
    const before = snapshotTree(root);
    assert.equal(runHook(payload("SessionStart", root), { CLARITY_HOOK_DISABLED: "1" }), null);
    assert.equal(snapshotTree(root), before);
    const canonicalBefore = canonicalSnapshot(root);
    for (const command of ["status", "review"]) {
      const result = runCli([command, root, "--json"]);
      assert.equal(result.status, 0, result.stderr);
    }
    assert.equal(canonicalSnapshot(root), canonicalBefore);
  });

  test("one common Skill and Hook source carry the same boundary", () => {
    const skill = readFileSync(skillPath, "utf8");
    const hook = readFileSync(join(plugin, "scripts/lib/clarity-hook.mjs"), "utf8");
    assert.deepEqual(readdirSync(join(plugin, "skills/clarity")).filter((name) => name === "SKILL.md"), ["SKILL.md"]);
    assert.deepEqual(readdirSync(join(plugin, "scripts/lib")).filter((name) => name === "clarity-hook.mjs"), ["clarity-hook.mjs"]);
    for (const marker of [/新しい承認ではない/u, /変更禁止.*read-only.*対象path限定.*previewのみ/u, /包括的な許可.*永続write/u, /別Agent.*有効範囲内/u, /同じ操作を再確認しない/u, /別の対象.*操作.*path.*永続先.*外部操作/u]) {
      assert.match(skill, marker);
    }
    assert.match(hook, /Hook通知自体は保存の許可ではなく/u);
    assert.match(hook, /変更禁止.*read-only.*対象path制限.*上書きしません/u);
  });

  process.stdout.write(`SUMMARY ${passed}/5 passed; fixture=${work}; cleanup=pending\n`);
} finally {
  delete process.env.CLARITY_NOW;
  rmSync(work, { recursive: true, force: true });
}

process.stdout.write(`CLEANUP removed ${work}\n`);
