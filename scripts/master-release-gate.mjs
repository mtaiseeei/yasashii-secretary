#!/usr/bin/env node

/**
 * Portable release gate for the current 0.9.2 release candidate.
 *
 * The gate deliberately keeps the checkout-only and archive-compatible paths
 * separate.  A suite that cannot run without Git is recorded as skipped in an
 * archive report; it is never counted as a successful assertion.
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = resolve(fileURLToPath(new URL(".", import.meta.url)));
const DEFAULT_ROOT = resolve(SCRIPT_DIR, "..");
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const HISTORICAL_RESULT_PREFIX = "HISTORICAL_REGRESSION_RESULT=";
const HISTORICAL_LOOPBACK_COMMIT_FULL = "337756f204eb5e709ddf39912df3ce1edfbec834";
const HISTORICAL_LOOPBACK_COMMIT_DISPLAY = HISTORICAL_LOOPBACK_COMMIT_FULL.slice(0, 7);
const HISTORICAL_LOOPBACK_FAILS = 6;

function usage() {
  console.error("usage: master-release-gate.mjs --mode offline|online|archive [--root PATH] [--timeout-ms N] [--json PATH]");
}

function parseArgs(argv) {
  const args = { mode: null, root: DEFAULT_ROOT, timeoutMs: DEFAULT_TIMEOUT_MS, json: null, manifest: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--mode") args.mode = argv[++i];
    else if (arg === "--root") args.root = resolve(argv[++i]);
    else if (arg === "--timeout-ms") args.timeoutMs = Number(argv[++i]);
    else if (arg === "--json") args.json = resolve(argv[++i]);
    else if (arg === "--manifest") args.manifest = resolve(argv[++i]);
    else if (arg === "--help" || arg === "-h") { usage(); process.exit(0); }
    else throw new Error(`unknown option: ${arg}`);
  }
  if (!["offline", "online", "archive"].includes(args.mode)) throw new Error("--mode must be offline, online, or archive");
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) throw new Error("--timeout-ms must be a positive number");
  if (args.mode === "archive" && args.manifest) throw new Error("--manifest is only for checkout test fixtures");
  return args;
}

function now() { return new Date().toISOString(); }

// live conversation gate（実plugin sessionの会話出力の回帰確認）はこのgateから分離されている。
// このgateのoffline判定は実会話を要求しないが、live gateの状態は明示行として表示し、
// 未実行（incomplete）を総合表示で隠さない。offline PASS・構文チェックを実会話回帰の
// 保証として数えない。状態の正本は scripts/sprint-032-patch-002-live-gate.sh の記録。
function liveConversationGateStatus() {
  const tmpBase = process.env.TMPDIR && process.env.TMPDIR.startsWith("/private/tmp")
    ? process.env.TMPDIR
    : "/private/tmp";
  const statusPath = join(tmpBase, "sprint-032-patch-002-live-gate-latest.json");
  try {
    const parsed = JSON.parse(readFileSync(statusPath, "utf8"));
    if (["pass", "fail", "incomplete"].includes(parsed.status)) {
      return { status: parsed.status, recordedAt: parsed.recordedAt ?? null, source: statusPath, countedInThisGate: false };
    }
  } catch { /* 記録なし＝未実行（incomplete） */ }
  return { status: "incomplete", recordedAt: null, source: null, countedInThisGate: false };
}

function gitCheckout(root) {
  return existsSync(join(root, ".git"));
}

function defaultInventory(root, mode) {
  const script = (name) => join(root, "scripts", name);
  if (mode === "archive") {
    return [
      { id: "archive-release-integrity", command: process.execPath, args: [script("archive-release-gate.mjs"), "--root", root], archive: true },
      { id: "sprint-010-timeline", command: "bash", args: [script("sprint-010-regression.sh")], archive: true },
      { id: "sprint-011-settings", command: "bash", args: [script("sprint-011-regression.sh")], archive: true },
      { id: "sprint-012-weekly", command: "bash", args: [script("sprint-012-regression.sh")], archive: true },
      { id: "sprint-015-projects", command: "bash", args: [script("sprint-015-regression.sh")], archive: true },
      { id: "sprint-025-update-rollback", excluded: true, reason: "migration and rollback use checkout-only Git fixtures; archive static validator covers release metadata", archive: false },
      { id: "sprint-020-patch-002-cloud", excluded: true, reason: "archive has no runtime loopback/network environment; Cloud preparation is verified in checkout mode", archive: false },
      { id: "sprint-021-git-history", excluded: true, reason: "archive has no Git checkout; ownership/history assertions are checkout-only", archive: false },
      { id: "sprint-022-git-diff", excluded: true, reason: "archive has no Git checkout; diff assertion is checkout-only", archive: false },
      { id: "sprint-023-git-diff", excluded: true, reason: "archive has no Git checkout; diff assertion is checkout-only", archive: false },
      { id: "sprint-024-git-diff", excluded: true, reason: "archive has no Git checkout; diff assertion is checkout-only", archive: false },
      { id: "master-regression-check-historical", excluded: true, reason: "immutable historical suite requires its pinned Git commit; current archive suites cover shipped bytes", archive: false },
      { id: "sprint-027-focus-copy", command: "bash", args: [script("sprint-027-regression.sh")], archive: true },
      { id: "sprint-029-rule-boundary", command: "bash", args: [script("sprint-029-regression.sh")], archive: true },
      { id: "sprint-030-edition-guard", command: "bash", args: [script("sprint-030-regression.sh")], archive: true },
      { id: "sprint-031-plugin-path", command: "bash", args: [script("sprint-031-regression.sh")], archive: true },
      { id: "sprint-032-release-preparation", excluded: true, reason: "published 0.7.0 history and its known scanner blocker are checkout-only evidence", archive: false },
      { id: "sprint-032-patch-001-readability", command: "bash", args: [script("sprint-032-patch-001-regression.sh")], archive: true },
      { id: "sprint-032-patch-002-conversation-safety", command: "bash", args: [script("sprint-032-patch-002-regression.sh")], archive: true },
      { id: "sprint-038-conversation", command: "bash", args: [script("sprint-038-regression.sh")], archive: true },
      { id: "sprint-038-patch-001-harness-compat", command: "bash", args: [script("sprint-038-patch-001-regression.sh")], archive: true },
      { id: "sprint-038-patch-002-windows-storage", command: process.execPath, args: [script("sprint-038-patch-002-windows-test.mjs")], archive: true },
      { id: "sprint-039-secretary-identity", command: "bash", args: [script("sprint-039-regression.sh")], archive: true },
      { id: "report-schema", command: "python3", args: [script("check-report-schema.py"), "--plugin-root", join(root, "plugins", "secretary")], archive: true },
    ];
  }
  const modeArg = mode === "online" ? "--online" : "--offline";
  return [
    { id: "sprint-010-timeline", command: "bash", args: [script("sprint-010-regression.sh")], archive: false },
    { id: "sprint-011-settings", command: "bash", args: [script("sprint-011-regression.sh")], archive: false },
    { id: "sprint-012-weekly", command: "bash", args: [script("sprint-012-regression.sh")], archive: false },
    { id: "sprint-015-projects", command: "bash", args: [script("sprint-015-regression.sh")], archive: false },
    { id: "sprint-020-patch-002-cloud", command: "bash", args: [script("sprint-020-patch-002-regression.sh")], archive: false },
    { id: "sprint-021-git-ownership", command: "bash", args: [script("sprint-021-regression.sh")], archive: false },
    { id: "sprint-022-path-timeout", command: "bash", args: [script("sprint-022-regression.sh")], archive: false },
    { id: "sprint-027-focus-copy", command: "bash", args: [script("sprint-027-regression.sh")], archive: false },
    { id: "sprint-029-rule-boundary", command: "bash", args: [script("sprint-029-regression.sh")], archive: false },
    { id: "sprint-030-edition-guard", command: "bash", args: [script("sprint-030-regression.sh")], archive: false },
    { id: "sprint-031-plugin-path", command: "bash", args: [script("sprint-031-regression.sh")], archive: false },
    { id: "sprint-032-release-preparation", command: "bash", args: [script("sprint-032-regression.sh")], archive: false },
    { id: "sprint-032-patch-001-readability", command: "bash", args: [script("sprint-032-patch-001-regression.sh")], archive: false },
    { id: "sprint-032-patch-002-conversation-safety", command: "bash", args: [script("sprint-032-patch-002-regression.sh")], archive: false },
    {
      id: "master-regression-check-historical",
      command: process.execPath,
      args: [script("run-historical-regression.mjs"), HISTORICAL_LOOPBACK_COMMIT_FULL, "regression-check.sh", modeArg],
      infraClassifier: { kind: "loopback-listen-eperm", expectedCommitFull: HISTORICAL_LOOPBACK_COMMIT_FULL, expectedFail: HISTORICAL_LOOPBACK_FAILS },
      archive: false,
    },
    { id: "sprint-038-conversation", command: "bash", args: [script("sprint-038-regression.sh")], archive: false },
    { id: "sprint-038-patch-001-harness-compat", command: "bash", args: [script("sprint-038-patch-001-regression.sh")], archive: false },
    { id: "sprint-038-patch-002-windows-storage", command: process.execPath, args: [script("sprint-038-patch-002-windows-test.mjs")], archive: false },
    { id: "sprint-039-secretary-identity", command: "bash", args: [script("sprint-039-regression.sh")], archive: false },
    { id: "report-schema", command: "python3", args: [script("check-report-schema.py"), "--plugin-root", join(root, "plugins", "secretary")], archive: false },
    { id: "current-release-integrity", command: "python3", args: [script("check-release-integrity.py"), "--root", root], archive: false },
  ];
}

function readInventory(path, root) {
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(parsed)) throw new Error("suite manifest must be an array");
  return parsed.map((suite) => {
    if (!suite || typeof suite.id !== "string" || !suite.id) throw new Error("invalid suite manifest entry");
    if (suite.excluded) return { id: suite.id, excluded: true, reason: String(suite.reason || "excluded from this execution surface"), archive: suite.archive !== false };
    if (suite.skipped) return { id: suite.id, skipped: true, reason: String(suite.reason || "not scheduled"), archive: suite.archive !== false };
    if (!Array.isArray(suite.args)) throw new Error("invalid suite manifest entry");
    const command = typeof suite.command === "string" ? suite.command : process.execPath;
    return { id: suite.id, command, args: suite.args.map((arg) => String(arg).replaceAll("$ROOT", root)), archive: suite.archive !== false };
  });
}

function parseAssertCounts(output) {
  const lines = output.split(/\r?\n/);
  const summaries = [];
  for (const line of lines) {
    const canonical = line.match(/^\s*PASS[=:](\d+)\b[^\n]*?\bFAIL[=:](\d+)\b\s*$/i);
    if (canonical) {
      summaries.push({ kind: "canonical", pass: Number(canonical[1]), fail: Number(canonical[2]) });
      continue;
    }
    const prefixed = line.match(/^\s*([A-Z0-9]+(?:_[A-Z0-9]+)*)_PASS[=:](\d+)\b[^\n]*?\b\1_FAIL[=:](\d+)\b\s*$/i);
    if (prefixed) summaries.push({ kind: "prefixed", pass: Number(prefixed[2]), fail: Number(prefixed[3]) });
  }

  if (summaries.length > 0) {
    // A bare PASS/FAIL line is the suite's canonical total even if an internal
    // prefixed summary is printed after it.  Without a bare total, the final
    // prefixed summary is the suite-owned total.  Earlier summaries are
    // therefore details, not additional assertions.
    const canonical = summaries.filter((summary) => summary.kind === "canonical").at(-1);
    const selected = canonical || summaries.at(-1);
    // A later success summary must not erase a failure already reported by a
    // child summary.  Preserve the largest reported FAIL count without adding
    // overlapping PASS totals.
    const fail = Math.max(selected.fail, ...summaries.map((summary) => summary.fail));
    return { pass: selected.pass, fail, assertions: selected.pass + fail };
  }

  let pass = 0;
  let fail = 0;
  for (const line of lines) {
    if (/^\s*PASS\b/i.test(line)) pass += 1;
    if (/^\s*FAIL\b/i.test(line)) fail += 1;
  }
  return { pass, fail, assertions: pass + fail };
}

function terminateTree(child, signal = "SIGTERM") {
  if (!child.pid) return;
  try { process.kill(-child.pid, signal); } catch { try { child.kill(signal); } catch { /* already exited */ } }
}

function parseHistoricalRunnerResult(stdout) {
  const lines = stdout.split(/\r?\n/).filter((line) => line.length > 0);
  const last = lines.at(-1);
  if (!last?.startsWith(HISTORICAL_RESULT_PREFIX)) return null;
  try {
    const report = JSON.parse(last.slice(HISTORICAL_RESULT_PREFIX.length));
    const validCommit = report.observedCommit === null || /^[0-9a-f]{7}$/.test(report.observedCommit);
    const validFullCommit = report.observedCommitFull === null || (/^[0-9a-f]{40}$/.test(report.observedCommitFull) && report.observedCommitFull.startsWith(report.observedCommit));
    const validAssertions = report.assertions && Number.isInteger(report.assertions.pass) && report.assertions.pass >= 0
      && Number.isInteger(report.assertions.fail) && report.assertions.fail >= 0;
    if (report.schemaVersion !== 1 || !validCommit || !validFullCommit || !validAssertions
      || !Array.isArray(report.assertionFailureEvents) || !Array.isArray(report.failureEvents)) return null;
    return report;
  } catch {
    return null;
  }
}

function exactLoopbackFailureEvent(event) {
  return event?.kind === "node-listen-error"
    && event.name === "Error"
    && event.message === "listen EPERM: operation not permitted 127.0.0.1"
    && event.code === "EPERM"
    && event.syscall === "listen"
    && event.address === "127.0.0.1";
}

function gateExitCode(results, archiveChecks = []) {
  const required = results.filter((result) => result.required);
  const failed = required.filter((result) => !["pass", "verification-infra"].includes(result.status));
  const archiveFailed = archiveChecks.filter((check) => !check.ok);
  return failed.length === 0 && archiveFailed.length === 0 ? 0 : 1;
}

function runSuite(suite, root, timeoutMs) {
  return new Promise((resolveResult) => {
    const startedAt = now();
    if (suite.excluded) {
      resolveResult({
        id: suite.id, status: "excluded", required: false, reason: suite.reason,
        startedAt, endedAt: now(), durationMs: 0, assertions: 0, pass: 0, fail: 0,
      });
      return;
    }
    if (suite.skipped) {
      resolveResult({
        id: suite.id, status: "skipped", required: true, reason: suite.reason,
        startedAt, endedAt: now(), durationMs: 0, assertions: 0, pass: 0, fail: 1,
      });
      return;
    }
    const child = spawn(suite.command, suite.args, {
      cwd: root,
      env: { ...process.env, RELEASE_GATE_CHILD: "1" },
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (suite.streamOutput !== false) process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      if (suite.streamOutput !== false) process.stderr.write(chunk);
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      terminateTree(child, "SIGTERM");
      setTimeout(() => terminateTree(child, "SIGKILL"), 250);
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      resolveResult({ id: suite.id, status: "fail", required: true, reason: `spawn-error: ${error.message}`, startedAt, endedAt: now(), durationMs: 0, assertions: 0, pass: 0, fail: 1, exitCode: null, signal: null, stdout, stderr });
    });
    child.on("close", (exitCode, signal) => {
      clearTimeout(timer);
      const counts = parseAssertCounts(`${stdout}\n${stderr}`);
      const historical = parseHistoricalRunnerResult(stdout);
      const reportedFailures = historical?.failureEvents ?? [];
      const reportedAssertions = historical?.assertionFailureEvents ?? [];
      const isPinnedLoopbackInfra = suite.infraClassifier?.kind === "loopback-listen-eperm"
        && suite.infraClassifier.expectedCommitFull === HISTORICAL_LOOPBACK_COMMIT_FULL
        && suite.infraClassifier.expectedFail === HISTORICAL_LOOPBACK_FAILS
        && historical?.runnerError === null
        && historical?.observedCommitFull === HISTORICAL_LOOPBACK_COMMIT_FULL
        && historical?.observedCommit === HISTORICAL_LOOPBACK_COMMIT_DISPLAY
        && historical?.assertions.fail === HISTORICAL_LOOPBACK_FAILS
        && historical?.assertions.fail === counts.fail
        && historical?.assertions.pass === counts.pass
        && reportedAssertions.length === HISTORICAL_LOOPBACK_FAILS
        && reportedFailures.length === HISTORICAL_LOOPBACK_FAILS
        && reportedFailures.every(exactLoopbackFailureEvent)
        && exitCode === 1
        && !signal
        && !timedOut;
      if (isPinnedLoopbackInfra) {
        resolveResult({
          id: suite.id, status: "verification-infra", required: true,
          reason: `pinned historical suite: all ${HISTORICAL_LOOPBACK_FAILS} failures are sandbox loopback listen EPERM; product assertions remain unchanged`,
          startedAt, endedAt: now(), durationMs: Date.now() - Date.parse(startedAt),
          assertions: counts.assertions, pass: counts.pass, fail: 0, infraFail: counts.fail,
          observedCommit: historical.observedCommit, observedCommitFull: historical.observedCommitFull,
          parsedFailureEvents: reportedFailures.length, exitCode, signal, stdout, stderr,
        });
        return;
      }
      const status = timedOut ? "timeout" : (signal ? "signal" : (exitCode === 0 && counts.fail === 0 && counts.assertions > 0 ? "pass" : "fail"));
      resolveResult({ id: suite.id, status, required: true, startedAt, endedAt: now(), durationMs: Date.now() - Date.parse(startedAt), assertions: counts.assertions, pass: counts.pass, fail: counts.fail + (status === "fail" && counts.fail === 0 ? 1 : 0), reason: status === "fail" && counts.assertions === 0 ? "suite emitted no assertions" : undefined, observedCommit: historical?.observedCommit ?? null, observedCommitFull: historical?.observedCommitFull ?? null, parsedFailureEvents: reportedFailures.length, exitCode, signal, stdout, stderr });
    });
  });
}

function archiveAssertions(root) {
  const checks = [];
  const check = (id, ok, reason = "") => checks.push({ id, ok: Boolean(ok), reason });
  check("archive has no .git", !gitCheckout(root), "Git archive mode must not run against a checkout");
  const marketPath = join(root, ".claude-plugin", "marketplace.json");
  const pluginPath = join(root, "plugins", "secretary", ".claude-plugin", "plugin.json");
  try {
    const market = JSON.parse(readFileSync(marketPath, "utf8"));
    const plugin = JSON.parse(readFileSync(pluginPath, "utf8"));
    const entry = market.plugins?.[0] || {};
    check("marketplace version 0.9.2", entry.version === "0.9.2");
    check("plugin version 0.9.2", plugin.version === "0.9.2");
    check("author and MIT metadata", JSON.stringify(entry.author) === JSON.stringify({ name: "mtaiseeei" }) && JSON.stringify(plugin.author) === JSON.stringify({ name: "mtaiseeei" }) && entry.license === "MIT" && plugin.license === "MIT");
    check("single fork credit", entry.forkedFrom === "https://github.com/Shin-sibainu/cc-company");
    check("plugin source exists", entry.source === "./plugins/secretary" && existsSync(join(root, entry.source.slice(2))));
  } catch (error) {
    check("distribution manifests parse", false, error.message);
  }
  const validatorPath = join(root, "scripts", "check-release-integrity.py");
  const validatorIncluded = existsSync(validatorPath);
  check("release validator exists", validatorIncluded);
  if (validatorIncluded) {
    const validator = spawnSync("python3", [validatorPath, "--root", root], {
      cwd: root,
      encoding: "utf8",
    });
    const output = `${validator.stdout || ""}${validator.stderr || ""}`.trim();
    check(
      "release validator passes",
      validator.status === 0 && !validator.error,
      validator.error?.message || output || `exit=${validator.status}`,
    );
  }
  const canonicalChangelog = join(root, "plugins", "secretary", "CHANGELOG.md");
  const legacyRoot = join(root, "plugins", "yasashii-secretary");
  const legacyChangelog = join(legacyRoot, "CHANGELOG.md");
  check("canonical CHANGELOG exists", existsSync(canonicalChangelog));
  check("legacy path contains only CHANGELOG", existsSync(legacyChangelog) && readdirSync(legacyRoot).join("\0") === "CHANGELOG.md");
  check("canonical and legacy CHANGELOG bytes match", existsSync(canonicalChangelog) && existsSync(legacyChangelog) && readFileSync(canonicalChangelog).equals(readFileSync(legacyChangelog)));
  check("0.7.0 to 0.8.0 migration exists", existsSync(join(root, "plugins", "secretary", "migrations", "0.7.0-to-0.8.0.json")));
  check("0.8.0 to 0.9.0 migration exists", existsSync(join(root, "plugins", "secretary", "migrations", "0.8.0-to-0.9.0.json")));
  return checks;
}

async function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); } catch (error) { console.error(`release gate: ${error.message}`); usage(); process.exitCode = 2; return; }
  const root = args.root;
  const checkout = gitCheckout(root);
  if (args.mode === "archive" && checkout) { console.error("release gate: archive mode requires a .git-free root"); process.exitCode = 1; return; }
  if (args.mode !== "archive" && !checkout) { console.error("release gate: checkout mode requires a Git checkout"); process.exitCode = 1; return; }
  const inventory = args.manifest ? readInventory(args.manifest, root) : defaultInventory(root, args.mode);
  const startedAt = now();
  const results = [];
  for (const suite of inventory) {
    console.log(`\n== suite ${suite.id} START ${now()} ==`);
    const result = await runSuite(suite, root, args.timeoutMs);
    results.push(result);
    console.log(`== suite ${suite.id} END ${result.status} assertions=${result.assertions} pass=${result.pass} fail=${result.fail} ==`);
  }
  const archiveChecks = args.mode === "archive" ? archiveAssertions(root) : [];
  for (const check of archiveChecks) console.log(`${check.ok ? "PASS" : "FAIL"} ${check.id}${check.reason ? ` (${check.reason})` : ""}`);
  const required = results.filter((result) => result.required);
  const skipped = results.filter((result) => result.status === "skipped");
  const excluded = results.filter((result) => result.status === "excluded");
  const failed = required.filter((result) => !["pass", "verification-infra"].includes(result.status));
  const verificationInfra = required.filter((result) => result.status === "verification-infra");
  const archiveFailed = archiveChecks.filter((check) => !check.ok);
  const liveGate = liveConversationGateStatus();
  const report = {
    schemaVersion: 1, mode: args.mode, root, checkout, startedAt, endedAt: now(),
    inventory: results.map(({ stdout, stderr, ...result }) => result),
    // 分離されたlive conversation gateの状態。このgateの合否には数えない（第三状態のまま可視化）。
    liveConversationGate: liveGate,
    archiveChecks, totals: {
      suites: results.length, required: required.length, passed: required.filter((result) => result.status === "pass").length,
      verificationInfra: verificationInfra.length,
      failed: failed.length, skipped: skipped.length, excluded: excluded.length, assertions: required.reduce((sum, result) => sum + result.assertions, 0),
      pass: required.reduce((sum, result) => sum + result.pass, 0), fail: required.reduce((sum, result) => sum + result.fail, 0) + archiveFailed.length,
      infraFail: required.reduce((sum, result) => sum + (result.infraFail || 0), 0),
    },
    status: failed.length === 0 && archiveFailed.length === 0 ? "pass" : "fail",
  };
  if (args.json) writeFileSync(args.json, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nLIVE_CONVERSATION_GATE status=${liveGate.status}${liveGate.recordedAt ? ` recordedAt=${liveGate.recordedAt}` : ""} separate=true note=実会話回帰はこのgateの合否に含めない（offline判定・構文チェックは実会話の回帰保証ではない）。実行は bash scripts/sprint-032-patch-002-live-gate.sh`);
  console.log(`RELEASE_GATE mode=${args.mode} status=${report.status} suites=${report.totals.suites} required=${report.totals.required} passed=${report.totals.passed} verification-infra=${report.totals.verificationInfra} failed=${report.totals.failed} skipped=${report.totals.skipped} assertions=${report.totals.assertions} pass=${report.totals.pass} fail=${report.totals.fail} infra-fail=${report.totals.infraFail}`);
  process.exitCode = gateExitCode(results, archiveChecks);
}

if (import.meta.url === `file://${process.argv[1]}`) main();

export { archiveAssertions, gateExitCode, parseAssertCounts, parseHistoricalRunnerResult, runSuite };
