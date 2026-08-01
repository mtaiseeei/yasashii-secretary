#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const fixture = fileURLToPath(new URL("./fixtures/sprint-038/historical-path-alias-probe.mjs", import.meta.url));
const tempRoot = realpathSync(mkdtempSync(join(realpathSync(tmpdir()), "sprint-038-path-alias-")));
const alias = join(tempRoot, "alias-probe.mjs");
let pass = 0;
let fail = 0;

function check(label, condition) {
  if (condition) {
    pass += 1;
    console.log(`PASS ${label}`);
  } else {
    fail += 1;
    console.error(`FAIL ${label}`);
  }
}

try {
  symlinkSync(fixture, alias);
  const aliasRun = spawnSync(process.execPath, [alias], { encoding: "utf8" });
  const aliasReport = JSON.parse(aliasRun.stdout);
  check("path alias fixture reproduces import.meta.url and argv URL mismatch", aliasRun.status === 1 && aliasReport.equal === false);

  const canonicalFixture = realpathSync(alias);
  const canonicalRun = spawnSync(process.execPath, [canonicalFixture], { encoding: "utf8" });
  const canonicalReport = JSON.parse(canonicalRun.stdout);
  check("canonical real path makes import.meta.url and argv URL identical", canonicalRun.status === 0 && canonicalReport.equal === true);
  check("canonical path preserves the fixture basename", basename(canonicalFixture) === "historical-path-alias-probe.mjs");
} catch (error) {
  fail += 1;
  console.error(`FAIL historical path alias fixture: ${error.message}`);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log(`SPRINT038_HISTORICAL_PATH_PASS=${pass} SPRINT038_HISTORICAL_PATH_FAIL=${fail}`);
process.exitCode = fail === 0 ? 0 : 1;
