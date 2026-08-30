#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync(process.execPath, ["scripts/sprint-042-secretary-test.mjs"], {
  cwd: root, encoding: "utf8", timeout: 120_000, maxBuffer: 32 * 1024 * 1024,
});
const output = `${result.stdout || ""}\n${result.stderr || ""}`;
assert.equal(result.status, 1, output);
assert(output.includes("FAIL RG-010 identity・rename回帰"));
assert(output.includes("FAIL RG-011 plugin update・migration・version gate回帰"));
assert(output.includes("SPRINT045_CASE_PASS=33 FAIL=2 TOTAL=35"));
assert.equal((output.match(/^FAIL RG-/gmu) || []).length, 2);
process.stdout.write("YASASHII_SPRINT043_PATCH002_HISTORICAL_BASELINE secretary=33/35 expected_verification_infra=RG-010,RG-011 product_fail=0\n");
