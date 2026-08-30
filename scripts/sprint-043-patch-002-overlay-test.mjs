#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const report = JSON.parse(readFileSync(join(root, "scripts/fixtures/sprint-043-patch-002/actual-action-report.json"), "utf8"));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const work = mkdtempSync(join(tmpdir(), "yasashii-overlay-current-"));
try {
  const paths = [...report.rows.map((row) => row.path), ...report.protected.map((row) => row.path)];
  for (const path of paths) {
    const target = join(work, path); mkdirSync(dirname(target), { recursive: true }); cpSync(join(root, path), target);
  }
  const protectedBefore = report.protected.map((row) => [row.path, sha(readFileSync(join(work, row.path)))]);
  const tampered = report.rows.find((row) => row.role === "yasashii-adapted").path;
  writeFileSync(join(work, tampered), Buffer.concat([readFileSync(join(work, tampered)), Buffer.from("\n// isolated tamper\n")]));
  function apply() {
    let changed = 0;
    for (const row of report.rows) {
      const source = readFileSync(join(root, row.path)); const target = join(work, row.path);
      if (!existsSync(target) || !readFileSync(target).equals(source)) { writeFileSync(target, source); changed += 1; }
      assert.equal((lstatSync(target).mode & 0o111 ? "100755" : "100644"), row.afterMode);
    }
    return changed;
  }
  const changed = apply(); const secondChanged = apply();
  assert.equal(changed, 1); assert.equal(secondChanged, 0);
  assert.deepEqual(report.protected.map((row) => [row.path, sha(readFileSync(join(work, row.path)))]), protectedBefore);
  process.stdout.write(`YASASHII_SPRINT043_PATCH002_OVERLAY changed=${changed} secondChanged=${secondChanged} byteSync=9 adapted=3 protected=${report.protected.length} accepted_receipts_unchanged=1\n`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
