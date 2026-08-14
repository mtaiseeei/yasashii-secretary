#!/usr/bin/env node

import assert from "node:assert/strict";
import { cpSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const checker = join(ROOT, "scripts", "check-release-integrity.py");
const sandbox = mkdtempSync(join(tmpdir(), "sprint-039-release-integrity-"));
let pass = 0;

function check(label, fn) {
  fn();
  pass += 1;
  process.stdout.write(`PASS ${label}\n`);
}

function run(root) {
  return spawnSync("python3", [join(root, "scripts", "check-release-integrity.py"), "--root", root], { encoding: "utf8" });
}

try {
  check("正式16 Skillsをrelease integrityが受理", () => {
    const result = spawnSync("python3", [checker, "--root", ROOT], { encoding: "utf8" });
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    assert.match(result.stdout, /PASS release integrity/u);
  });

  check("同数unknown差替えをunexpectedとmissingの両方で拒否", () => {
    const copied = join(sandbox, "candidate");
    cpSync(ROOT, copied, {
      recursive: true,
      filter(source) {
        const rel = relative(ROOT, source).split("\\").join("/");
        return rel !== ".git" && !rel.startsWith(".git/") && rel !== "node_modules" && !rel.startsWith("node_modules/");
      },
    });
    renameSync(join(copied, "plugins", "secretary", "skills", "name"), join(copied, "plugins", "secretary", "skills", "unknown"));
    const result = run(copied);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /unexpected formal Skill: unknown/u);
    assert.match(result.stdout, /expected formal Skill missing: name/u);
    assert.doesNotMatch(result.stdout, /found 15/u);
  });
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}

process.stdout.write(`SPRINT039_RELEASE_INTEGRITY_PASS=${pass} SPRINT039_RELEASE_INTEGRITY_FAIL=0\n`);
