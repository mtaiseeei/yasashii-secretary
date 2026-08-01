#!/usr/bin/env node

// Run an immutable historical regression in a disposable local checkout.
// This keeps old release expectations byte-for-byte intact while preventing
// them from being reinterpreted as current-edition requirements.

import { closeSync, mkdtempSync, openSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const canonicalModulePath = realpathSync(fileURLToPath(import.meta.url));
const canonicalArgvPath = realpathSync(process.argv[1]);
if (pathToFileURL(canonicalModulePath).href !== pathToFileURL(canonicalArgvPath).href) {
  process.stderr.write("historical runner entrypoint path is not canonical\n");
  process.exit(2);
}

const scriptDir = dirname(canonicalModulePath);
const sourceRoot = resolve(scriptDir, "..");
const [commit, scriptName, ...scriptArgs] = process.argv.slice(2);

if (!commit || !/^[0-9a-f]{7,40}$/i.test(commit) || !scriptName || basename(scriptName) !== scriptName) {
  process.stderr.write("usage: run-historical-regression.mjs <commit> <script-name>\n");
  process.exit(2);
}

// macOS exposes the same temporary directory as both /var/... and
// /private/var/.... Historical Node CLIs compare import.meta.url with
// pathToFileURL(process.argv[1]), so every path passed into the checkout must
// start from the canonical real path rather than the alias returned by tmpdir().
const canonicalTempBase = realpathSync(tmpdir());
const tempRoot = realpathSync(mkdtempSync(join(canonicalTempBase, "secretary-historical-regression-")));
const checkout = join(tempRoot, "repo");
const RESULT_PREFIX = "HISTORICAL_REGRESSION_RESULT=";
const ANSI_RED_FAIL = /^\s*\u001b\[31mFAIL\u001b\[0m\s+(.+?)\s*$/;
const NODE_ERROR = /^\s*(Error|TypeError|ReferenceError|RangeError|SyntaxError|AssertionError)(?: \[[^\]]+\])?:\s+(.+?)\s*$/;
const LOOPBACK_MESSAGE = "listen EPERM: operation not permitted 127.0.0.1";
const LOOPBACK_COMPANION = /^(?:google )?wizard did not start: node:events:\d+$/;

function parseAssertions(output) {
  const summaries = output.split(/\r?\n/).map((line) => line.match(/^\s*PASS=(\d+)\s+FAIL=(\d+)\s*$/)).filter(Boolean);
  const summary = summaries.at(-1);
  return summary ? { pass: Number(summary[1]), fail: Number(summary[2]) } : null;
}

function parseFailureEvents(output) {
  const sections = [];
  let current = { heading: "preamble", lines: [] };
  for (const line of output.split(/\r?\n/)) {
    // The historical master owns numbered top-level sections. Child suites
    // also print `== ... ==` headings, so only a numbered heading may start a
    // new assertion scope.
    if (/^== \d+\..+ ==$/.test(line)) {
      sections.push(current);
      current = { heading: line, lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  sections.push(current);

  const assertionFailureEvents = [];
  const failureEvents = [];
  for (const section of sections) {
    const assertionFailures = section.lines.map((line) => line.match(ANSI_RED_FAIL)).filter(Boolean);
    if (assertionFailures.length === 0) continue;
    const errors = section.lines.map((line) => line.match(NODE_ERROR)).filter(Boolean).map((match) => ({ name: match[1], message: match[2] }));
    for (const match of assertionFailures) {
      const label = match[1];
      assertionFailureEvents.push({ index: assertionFailureEvents.length, label, section: section.heading });
      const loopbackErrors = errors.filter((error) => error.name === "Error" && error.message === LOOPBACK_MESSAGE);
      const companions = errors.filter((error) => error.name === "Error" && LOOPBACK_COMPANION.test(error.message));
      const exactLoopbackOnly = loopbackErrors.length > 0 && loopbackErrors.length + companions.length === errors.length;
      failureEvents.push({
        index: failureEvents.length,
        assertion: label,
        kind: exactLoopbackOnly ? "node-listen-error" : (errors.length > 0 ? "node-error" : "unclassified-failure"),
        name: exactLoopbackOnly ? "Error" : (errors[0]?.name ?? null),
        message: exactLoopbackOnly ? LOOPBACK_MESSAGE : (errors[0]?.message ?? label),
        code: exactLoopbackOnly ? "EPERM" : null,
        syscall: exactLoopbackOnly ? "listen" : null,
        address: exactLoopbackOnly ? "127.0.0.1" : null,
        companionCount: companions.length,
        rawErrorCount: errors.length,
      });
    }
  }
  return { assertionFailureEvents, failureEvents };
}

function emitResult(report) {
  process.stdout.write(`${RESULT_PREFIX}${JSON.stringify(report)}\n`);
}

function historicalEnv() {
  return {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      !key.startsWith("CC_SECRETARY_") && !key.startsWith("YASASHII_") && !key.startsWith("SECRETARY_")
    )),
    // Nested historical suites create their own archives and Python temp
    // directories. Keep those descendants on the same canonical path too.
    TMPDIR: tempRoot,
    TMP: tempRoot,
    TEMP: tempRoot,
  };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? sourceRoot,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
    env: historicalEnv(),
  });
  if (result.error) throw result.error;
  return result;
}

function runMerged(command, args, options = {}) {
  const outputPath = join(tempRoot, "historical-regression-output.log");
  const outputFd = openSync(outputPath, "w+");
  try {
    const result = spawnSync(command, args, {
      cwd: options.cwd ?? sourceRoot,
      stdio: ["ignore", outputFd, outputFd],
      env: historicalEnv(),
    });
    if (result.error) throw result.error;
    return { ...result, stdout: readFileSync(outputPath, "utf8"), stderr: "" };
  } finally {
    closeSync(outputFd);
  }
}

let report = {
  schemaVersion: 1,
  observedCommit: null,
  observedCommitFull: null,
  assertions: null,
  assertionFailureEvents: [],
  failureEvents: [],
  runnerError: null,
};

try {
  const exists = run("git", ["cat-file", "-e", `${commit}^{commit}`]);
  if (exists.status !== 0) throw new Error(`historical commit is unavailable: ${commit}`);

  const cloned = run("git", ["clone", "-q", "--no-hardlinks", "--no-checkout", sourceRoot, checkout]);
  if (cloned.status !== 0) throw new Error(cloned.stderr.trim() || "local historical clone failed");

  const checkedOut = run("git", ["checkout", "-q", commit], { cwd: checkout });
  if (checkedOut.status !== 0) throw new Error(checkedOut.stderr.trim() || "historical checkout failed");

  const observedCommitFull = run("git", ["rev-parse", "HEAD"], { cwd: checkout }).stdout.trim();
  const observedCommit = run("git", ["rev-parse", "--short=7", "HEAD"], { cwd: checkout }).stdout.trim();
  report = { ...report, observedCommit, observedCommitFull };

  const historicalScript = join(checkout, "scripts", scriptName);
  const result = runMerged("bash", [historicalScript, ...scriptArgs], { cwd: checkout });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  const parsedEvents = parseFailureEvents(result.stdout || "");
  report = {
    ...report,
    assertions: parseAssertions(result.stdout || ""),
    ...parsedEvents,
  };
  process.exitCode = result.status ?? 1;
} catch (error) {
  process.stderr.write(`historical regression failed: ${error.message}\n`);
  report = { ...report, runnerError: error.message };
  process.exitCode = 1;
} finally {
  emitResult(report);
  rmSync(tempRoot, { recursive: true, force: true });
}
