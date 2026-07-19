#!/usr/bin/env node

/**
 * Portable release gate for the 0.7.0 distribution.
 *
 * The gate deliberately keeps the checkout-only and archive-compatible paths
 * separate.  A suite that cannot run without Git is recorded as skipped in an
 * archive report; it is never counted as a successful assertion.
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = resolve(fileURLToPath(new URL(".", import.meta.url)));
const DEFAULT_ROOT = resolve(SCRIPT_DIR, "..");
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

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

function gitCheckout(root) {
  return existsSync(join(root, ".git"));
}

function defaultInventory(root, mode) {
  const script = (name) => join(root, "scripts", name);
  if (mode === "archive") {
    return [
      { id: "archive-release-integrity", command: process.execPath, args: [script("archive-release-gate.mjs"), "--root", root], archive: true },
      { id: "sprint-015-projects", command: "bash", args: [script("sprint-015-regression.sh")], archive: true },
      { id: "sprint-025-update-rollback", excluded: true, reason: "migration and rollback use checkout-only Git fixtures; archive static validator covers release metadata", archive: false },
      { id: "sprint-020-patch-002-cloud", excluded: true, reason: "archive has no runtime loopback/network environment; Cloud preparation is verified in checkout mode", archive: false },
      { id: "sprint-021-git-history", excluded: true, reason: "archive has no Git checkout; ownership/history assertions are checkout-only", archive: false },
      { id: "sprint-022-git-diff", excluded: true, reason: "archive has no Git checkout; diff assertion is checkout-only", archive: false },
      { id: "sprint-023-git-diff", excluded: true, reason: "archive has no Git checkout; diff assertion is checkout-only", archive: false },
      { id: "sprint-024-git-diff", excluded: true, reason: "archive has no Git checkout; diff assertion is checkout-only", archive: false },
    ];
  }
  // The existing regression-check is the long-lived master suite.  The two
  // explicit entries close the Sprint 015 and Patch 002 omission in older
  // versions while keeping their execution visible in the inventory.
  const modeArg = mode === "online" ? "--online" : "--offline";
  return [
    { id: "sprint-015-projects", command: "bash", args: [script("sprint-015-regression.sh")], archive: false },
    { id: "sprint-020-patch-002-cloud", command: "bash", args: [script("sprint-020-patch-002-regression.sh")], archive: false },
    { id: "master-regression-check", command: "bash", args: [script("regression-check.sh"), modeArg], archive: false },
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
    child.stdout.on("data", (chunk) => { stdout += chunk; process.stdout.write(chunk); });
    child.stderr.on("data", (chunk) => { stderr += chunk; process.stderr.write(chunk); });
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
      const status = timedOut ? "timeout" : (signal ? "signal" : (exitCode === 0 && counts.fail === 0 && counts.assertions > 0 ? "pass" : "fail"));
      resolveResult({ id: suite.id, status, required: true, startedAt, endedAt: now(), durationMs: Date.now() - Date.parse(startedAt), assertions: counts.assertions, pass: counts.pass, fail: counts.fail + (status === "fail" && counts.fail === 0 ? 1 : 0), reason: status === "fail" && counts.assertions === 0 ? "suite emitted no assertions" : undefined, exitCode, signal, stdout, stderr });
    });
  });
}

function archiveAssertions(root) {
  const checks = [];
  const check = (id, ok, reason = "") => checks.push({ id, ok: Boolean(ok), reason });
  check("archive has no .git", !gitCheckout(root), "Git archive mode must not run against a checkout");
  const marketPath = join(root, ".claude-plugin", "marketplace.json");
  const pluginPath = join(root, "plugins", "yasashii-secretary", ".claude-plugin", "plugin.json");
  try {
    const market = JSON.parse(readFileSync(marketPath, "utf8"));
    const plugin = JSON.parse(readFileSync(pluginPath, "utf8"));
    const entry = market.plugins?.[0] || {};
    check("marketplace version 0.7.0", entry.version === "0.7.0");
    check("plugin version 0.7.0", plugin.version === "0.7.0");
    check("author and MIT metadata", JSON.stringify(entry.author) === JSON.stringify({ name: "mtaiseeei" }) && JSON.stringify(plugin.author) === JSON.stringify({ name: "mtaiseeei" }) && entry.license === "MIT" && plugin.license === "MIT");
    check("single fork credit", entry.forkedFrom === "https://github.com/Shin-sibainu/cc-company");
    check("plugin source exists", entry.source === "./plugins/yasashii-secretary" && existsSync(join(root, entry.source.slice(2))));
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
  check("CHANGELOG exists", existsSync(join(root, "plugins", "yasashii-secretary", "CHANGELOG.md")));
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
  const failed = required.filter((result) => result.status !== "pass");
  const archiveFailed = archiveChecks.filter((check) => !check.ok);
  const report = {
    schemaVersion: 1, mode: args.mode, root, checkout, startedAt, endedAt: now(),
    inventory: results.map(({ stdout, stderr, ...result }) => result),
    archiveChecks, totals: {
      suites: results.length, required: required.length, passed: required.filter((result) => result.status === "pass").length,
      failed: failed.length, skipped: skipped.length, excluded: excluded.length, assertions: required.reduce((sum, result) => sum + result.assertions, 0),
      pass: required.reduce((sum, result) => sum + result.pass, 0), fail: required.reduce((sum, result) => sum + result.fail, 0) + archiveFailed.length,
    },
    status: failed.length === 0 && archiveFailed.length === 0 ? "pass" : "fail",
  };
  if (args.json) writeFileSync(args.json, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nRELEASE_GATE mode=${args.mode} status=${report.status} suites=${report.totals.suites} required=${report.totals.required} passed=${report.totals.passed} failed=${report.totals.failed} skipped=${report.totals.skipped} assertions=${report.totals.assertions} pass=${report.totals.pass} fail=${report.totals.fail}`);
  process.exitCode = report.status === "pass" ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) main();

export { archiveAssertions, parseAssertCounts, runSuite };
