#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(new URL("..", import.meta.url).pathname);
const gate = join(root, "scripts", "master-release-gate.mjs");
const archiveGate = join(root, "scripts", "archive-release-gate.mjs");
let pass = 0;
let fail = 0;
function check(label, condition) {
  if (condition) { pass += 1; console.log(`PASS ${label}`); }
  else { fail += 1; console.log(`FAIL ${label}`); }
}
function run(args) {
  return spawnSync(process.execPath, [gate, ...args], { cwd: root, encoding: "utf8", timeout: 30000 });
}

check("master release gate has valid Node syntax", spawnSync(process.execPath, ["--check", gate], { encoding: "utf8" }).status === 0);
check("archive release gate has valid Node syntax", spawnSync(process.execPath, ["--check", archiveGate], { encoding: "utf8" }).status === 0);
check("shell entrypoint is executable", existsSync(join(root, "scripts", "master-release-gate.sh")));

const fixture = mkdtempSync(join(tmpdir(), "yasashii-s026-gate-"));
try {
  const manifest = join(fixture, "suite-manifest.json");
  const report = join(fixture, "report.json");
  writeFileSync(manifest, JSON.stringify([
    { id: "pass-fixture", command: process.execPath, args: ["-e", "console.log('PASS=2 FAIL=0')"] },
    { id: "prefixed-pass-fixture", command: process.execPath, args: ["-e", "console.log('SPRINT026_PASS=4 SPRINT026_FAIL=0')"] },
    { id: "prefixed-fail-fixture", command: process.execPath, args: ["-e", "console.log('SPRINT026_PASS=4 SPRINT026_FAIL=2')"] },
    { id: "multi-prefix-final-canonical-fixture", command: process.execPath, args: ["-e", "console.log('ALPHA_PASS=4 ALPHA_FAIL=0\\nBETA_PASS=6 BETA_FAIL=0\\nPASS=10 FAIL=0')"] },
    { id: "raw-count-final-canonical-fixture", command: process.execPath, args: ["-e", "console.log('PROJECTS_PASS=68 PROJECTS_FAIL=0\\nCLOUD_PASS=253 CLOUD_FAIL=0\\nPASS=335 FAIL=1')"] },
    { id: "multi-prefix-final-prefixed-fixture", command: process.execPath, args: ["-e", "console.log('FIRST_CHILD_PASS=3 FIRST_CHILD_FAIL=0\\nSECOND_CHILD_PASS=4 SECOND_CHILD_FAIL=0\\nWHOLE_SUITE_PASS=7 WHOLE_SUITE_FAIL=0')"] },
    { id: "canonical-before-detail-fixture", command: process.execPath, args: ["-e", "console.log('PASS=9 FAIL=0\\nLATE_DETAIL_PASS=2 LATE_DETAIL_FAIL=0')"] },
    { id: "fail-not-overwritten-fixture", command: process.execPath, args: ["-e", "console.log('BROKEN_CHILD_PASS=2 BROKEN_CHILD_FAIL=1\\nPASS=3 FAIL=0')"] },
    { id: "fail-fixture", command: process.execPath, args: ["-e", "console.log('PASS=1 FAIL=1'); process.exit(1)"] },
    { id: "signal-fixture", command: process.execPath, args: ["-e", "process.kill(process.pid, 'SIGTERM')"] },
    { id: "timeout-fixture", command: process.execPath, args: ["-e", "setTimeout(() => {}, 10000)"] },
    { id: "no-assert-fixture", command: process.execPath, args: ["-e", ""] },
    { id: "skipped-fixture", skipped: true, reason: "test-only intentional skip" },
  ], null, 2));
  const result = run(["--mode", "offline", "--manifest", manifest, "--timeout-ms", "100", "--json", report]);
  let parsed = {};
  try { parsed = JSON.parse(readFileSync(report, "utf8")); } catch { /* assertion below reports it */ }
  check("child FAIL is aggregated", parsed.inventory?.find((entry) => entry.id === "fail-fixture")?.status === "fail");
  check("prefixed PASS summary is counted", parsed.inventory?.find((entry) => entry.id === "prefixed-pass-fixture")?.status === "pass" && parsed.inventory?.find((entry) => entry.id === "prefixed-pass-fixture")?.assertions === 4);
  check("prefixed FAIL summary is counted", parsed.inventory?.find((entry) => entry.id === "prefixed-fail-fixture")?.status === "fail" && parsed.inventory?.find((entry) => entry.id === "prefixed-fail-fixture")?.pass === 4 && parsed.inventory?.find((entry) => entry.id === "prefixed-fail-fixture")?.fail === 2);
  check("final canonical summary replaces multiple internal prefixes", parsed.inventory?.find((entry) => entry.id === "multi-prefix-final-canonical-fixture")?.status === "pass" && parsed.inventory?.find((entry) => entry.id === "multi-prefix-final-canonical-fixture")?.assertions === 10);
  check("raw 335/1 canonical summary stays 335/1", parsed.inventory?.find((entry) => entry.id === "raw-count-final-canonical-fixture")?.status === "fail" && parsed.inventory?.find((entry) => entry.id === "raw-count-final-canonical-fixture")?.pass === 335 && parsed.inventory?.find((entry) => entry.id === "raw-count-final-canonical-fixture")?.fail === 1);
  check("final prefixed summary is used when canonical summary is absent", parsed.inventory?.find((entry) => entry.id === "multi-prefix-final-prefixed-fixture")?.status === "pass" && parsed.inventory?.find((entry) => entry.id === "multi-prefix-final-prefixed-fixture")?.assertions === 7);
  check("canonical summary wins even when a detail is printed later", parsed.inventory?.find((entry) => entry.id === "canonical-before-detail-fixture")?.status === "pass" && parsed.inventory?.find((entry) => entry.id === "canonical-before-detail-fixture")?.assertions === 9);
  check("earlier FAIL summary is not overwritten by final success", parsed.inventory?.find((entry) => entry.id === "fail-not-overwritten-fixture")?.status === "fail" && parsed.inventory?.find((entry) => entry.id === "fail-not-overwritten-fixture")?.pass === 3 && parsed.inventory?.find((entry) => entry.id === "fail-not-overwritten-fixture")?.fail === 1);
  check("child signal is aggregated", parsed.inventory?.find((entry) => entry.id === "signal-fixture")?.status === "signal");
  check("child timeout is aggregated", parsed.inventory?.find((entry) => entry.id === "timeout-fixture")?.status === "timeout");
  check("empty child output is not a false PASS", parsed.inventory?.find((entry) => entry.id === "no-assert-fixture")?.status === "fail");
  check("intentional skip is explicit and fails the required gate", parsed.inventory?.find((entry) => entry.id === "skipped-fixture")?.status === "skipped" && parsed.inventory?.find((entry) => entry.id === "skipped-fixture")?.required === true);
  check("aggregate gate returns non-zero", result.status !== 0 && parsed.status === "fail");

  const archive = join(fixture, "archive");
  mkdirSync(join(archive, ".claude-plugin"), { recursive: true });
  mkdirSync(join(archive, "plugins", "yasashii-secretary", ".claude-plugin"), { recursive: true });
  mkdirSync(join(archive, "scripts"), { recursive: true });
  writeFileSync(join(archive, ".claude-plugin", "marketplace.json"), JSON.stringify({ name: "yasashii-secretary", owner: { name: "mtaiseeei" }, plugins: [{ name: "yasashii-secretary", source: "./plugins/yasashii-secretary", version: "0.7.0", author: { name: "mtaiseeei" }, license: "MIT", forkedFrom: "https://github.com/Shin-sibainu/cc-company" }] }));
  const validPlugin = { name: "yasashii-secretary", version: "0.7.0", author: { name: "mtaiseeei" }, license: "MIT", homepage: "https://github.com/mtaiseeei/yasashii-secretary", repository: "https://github.com/mtaiseeei/yasashii-secretary" };
  writeFileSync(join(archive, "plugins", "yasashii-secretary", ".claude-plugin", "plugin.json"), JSON.stringify(validPlugin));
  writeFileSync(join(archive, "plugins", "yasashii-secretary", "CHANGELOG.md"), "# 変更履歴\n\n## [0.7.0]\n\n### 対象者\n- 利用者\n\n### 変わること\n- 配布準備\n\n### 設定・ファイルへの影響\n- なし\n\n### 必要な操作\n- なし\n\n### 互換性上の注意\n- なし\n");
  writeFileSync(join(archive, "LICENSE"), "MIT License\n\nShin-sibainu/cc-company (MIT)\n\ninherits credit from the original author\n");
  writeFileSync(join(archive, "scripts", "check-release-integrity.py"), "# fixture\n");
  cpSync(join(root, "scripts", "check-release-integrity.py"), join(archive, "scripts", "check-release-integrity.py"));
  const archiveResult = spawnSync(process.execPath, [archiveGate, "--root", archive], { encoding: "utf8" });
  check(".git-free archive gate passes", archiveResult.status === 0 && /ARCHIVE_RELEASE_PASS=8 ARCHIVE_RELEASE_FAIL=0/.test(archiveResult.stdout));

  const pluginPath = join(archive, "plugins", "yasashii-secretary", ".claude-plugin", "plugin.json");
  for (const field of ["homepage", "repository"]) {
    const brokenPlugin = { ...validPlugin, [field]: "https://invalid.example/not-the-repository" };
    writeFileSync(pluginPath, JSON.stringify(brokenPlugin));
    const brokenArchive = spawnSync(process.execPath, [archiveGate, "--root", archive], { encoding: "utf8" });
    check(`archive validator rejects broken ${field}`, brokenArchive.status !== 0 && /ARCHIVE_RELEASE_FAIL=/.test(brokenArchive.stdout));
    writeFileSync(pluginPath, JSON.stringify(validPlugin));
  }

  // Build a test archive only from explicit distribution directories.  The
  // repository's docs and any audit evidence are intentionally not copied.
  const fullArchive = join(fixture, "full-archive");
  mkdirSync(fullArchive, { recursive: true });
  cpSync(join(root, ".claude-plugin"), join(fullArchive, ".claude-plugin"), { recursive: true });
  cpSync(join(root, "plugins"), join(fullArchive, "plugins"), { recursive: true });
  cpSync(join(root, "scripts"), join(fullArchive, "scripts"), { recursive: true });
  cpSync(join(root, "LICENSE"), join(fullArchive, "LICENSE"));
  cpSync(join(root, "README.md"), join(fullArchive, "README.md"));
  const fullArchiveResult = spawnSync(process.execPath, [gate, "--mode", "archive", "--root", fullArchive, "--timeout-ms", "120000"], { encoding: "utf8", timeout: 150000, env: { ...process.env, TMPDIR: "/private/tmp" } });
  check("master gate runs archive-compatible suites", fullArchiveResult.status === 0 && /RELEASE_GATE mode=archive status=pass/.test(fullArchiveResult.stdout));

  writeFileSync(join(archive, ".claude-plugin", "marketplace.json"), "{\"plugins\":[{\"version\":\"0.6.0\"}]}\n");
  const badArchive = spawnSync(process.execPath, [archiveGate, "--root", archive], { encoding: "utf8" });
  check("archive metadata failure is non-zero", badArchive.status !== 0 && /ARCHIVE_RELEASE_FAIL=/.test(badArchive.stdout));
} finally {
  rmSync(fixture, { recursive: true, force: true });
}

console.log(`SPRINT026_GATE_PASS=${pass} SPRINT026_GATE_FAIL=${fail}`);
process.exitCode = fail === 0 ? 0 : 1;
