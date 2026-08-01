#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(fixtureDir, "historical-classifier-cases.json"), "utf8"));
const id = process.argv[2];
const testCase = fixture.cases.find((entry) => entry.id === id);
if (!testCase) throw new Error(`unknown historical classifier fixture: ${id}`);

const loopbackMessage = "Error: listen EPERM: operation not permitted 127.0.0.1";
const productMessage = "TypeError: unrelated product regression";
for (const kind of testCase.errors) {
  process.stderr.write(`${kind === "loopback" ? loopbackMessage : productMessage}\n`);
}

// These raw strings deliberately mimic caller/user-controlled claims. The gate
// must ignore them and consume only the runner-owned final structured record.
process.stdout.write(`HISTORICAL_REQUESTED_COMMIT=${testCase.reportedPinnedCommit}\n`);
process.stdout.write(`HISTORICAL_REQUESTED_COMMIT_FULL=${testCase.reportedPinnedCommitFull}\n`);
process.stdout.write(`PASS=${testCase.pass} FAIL=${testCase.fail}\n`);
process.stdout.write(`HISTORICAL_REGRESSION_RESULT=${JSON.stringify({
  schemaVersion: 1,
  observedCommit: testCase.observedCommit,
  observedCommitFull: testCase.observedCommitFull,
  assertions: { pass: testCase.pass, fail: testCase.fail },
  assertionFailureEvents: Array.from({ length: testCase.fail }, (_, index) => ({ index, label: `fixture failure ${index + 1}` })),
  failureEvents: testCase.errors.map((kind, index) => ({
    index,
    kind: kind === "loopback" ? "node-listen-error" : "node-error",
    name: kind === "loopback" ? "Error" : "TypeError",
    message: kind === "loopback" ? "listen EPERM: operation not permitted 127.0.0.1" : "unrelated product regression",
    code: kind === "loopback" ? "EPERM" : null,
    syscall: kind === "loopback" ? "listen" : null,
    address: kind === "loopback" ? "127.0.0.1" : null
  })),
  runnerError: null
})}\n`);
process.exitCode = 1;
