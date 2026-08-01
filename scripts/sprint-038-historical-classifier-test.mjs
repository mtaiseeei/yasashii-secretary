#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gateExitCode, runSuite } from "./master-release-gate.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = join(root, "scripts/fixtures/sprint-038/historical-classifier-cases.json");
const runnerPath = join(root, "scripts/fixtures/sprint-038/historical-classifier-runner.mjs");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const expectedCommitFull = fixture.expectedCommitFull;
let pass = 0;
let fail = 0;

for (const testCase of fixture.cases) {
  try {
    const result = await runSuite({
      id: `historical-classifier-${testCase.id}`,
      command: process.execPath,
      args: [runnerPath, testCase.id],
      infraClassifier: { kind: "loopback-listen-eperm", expectedCommitFull, expectedFail: 6 },
      streamOutput: false,
    }, root, 10_000);
    assert.equal(result.status, testCase.expectedStatus, `${testCase.id}: classification`);
    assert.equal(gateExitCode([result], []), testCase.expectedGateExit, `${testCase.id}: master gate exit`);
    if (testCase.expectedStatus === "verification-infra") {
      assert.equal(result.infraFail, 6, `${testCase.id}: infra fail count`);
      assert.equal(result.fail, 0, `${testCase.id}: product fail count`);
      assert.equal(result.observedCommit, "337756f", `${testCase.id}: observed commit`);
      assert.equal(result.observedCommitFull, expectedCommitFull, `${testCase.id}: observed full commit`);
    } else {
      assert.notEqual(result.fail, 0, `${testCase.id}: normal FAIL is preserved`);
    }
    pass += 1;
    console.log(`PASS ${testCase.id}`);
  } catch (error) {
    fail += 1;
    console.error(`FAIL ${testCase.id}: ${error.message}`);
  }
}

console.log(`SPRINT038_HISTORICAL_CLASSIFIER_PASS=${pass} SPRINT038_HISTORICAL_CLASSIFIER_FAIL=${fail}`);
process.exitCode = fail === 0 ? 0 : 1;
