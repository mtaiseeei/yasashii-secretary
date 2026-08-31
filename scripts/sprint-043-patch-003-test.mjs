#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync, copyFileSync, existsSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, readlinkSync,
  rmSync, symlinkSync, unlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { applyInit, inspectRepoIdentity, previewInit, scanRepository } from "../plugins/secretary/scripts/lib/clarity-core.mjs";
import { classifyHarnessRelativePath } from "../plugins/secretary/scripts/lib/clarity-harness-scan.mjs";
import { expectedSurfacePaths, validateCollaborationInventory } from "./lib/sprint-049-inventory.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const requireWindows = process.argv.includes("--require-windows");
const statuses = new Map();
const capabilityStatuses = [];
let externalWrites = 0;
let networkCalls = 0;

function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: options.cwd || ROOT, encoding: "utf8", shell: false, env: { ...process.env, CLARITY_NOW: "2026-08-31T10:00:00.000Z", ...options.env } });
  if (options.expected !== undefined) assert.equal(result.status, options.expected, `${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return result;
}
function record(id, status, reason, action = null) {
  try {
    if (action) action();
    statuses.set(id, { status, reason });
    console.log(`${status} ${id}${reason ? ` ${reason}` : ""}`);
  } catch (error) {
    statuses.set(id, { status: "FAIL", reason: error.message });
    console.error(`FAIL ${id} ${error.stack || error.message}`);
  }
}
function write(root, path, content) {
  const target = join(root, ...path.split("/"));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}
function stateText({ current = "sprint-043-patch-003", next = "TBD", status = "active", extra = "" } = {}) {
  return `# Sprint State\r\n\r\n- Current ID: ${current}\r\n- Next Planned: ${next}\r\n\r\n| ID | Status | Contract | Progress | Feedback |\r\n|---|---|---|---|---|\r\n| sprint-043-patch-002 | done | x | x | x |\r\n| sprint-043-patch-003 | ${status} | x | x | x |\r\n${extra}`;
}
function harnessFixture(name, options = {}) {
  const root = mkdtempSync(join(tmpdir(), `${name} 空白 日本語-`));
  write(root, "docs/spec.md", "# Spec Index\n\n[features](spec/features.md)\n[constraints](spec/constraints.md)\n");
  write(root, "docs/spec/features.md", "# Features\n\nHarness bounded scanner.\n");
  write(root, "docs/spec/constraints.md", "# Constraints\n\nNo external write.\n");
  write(root, "docs/sprints/state.md", options.state || stateText());
  write(root, "docs/sprints/sprint-043-patch-003.md", "# Requirements\n\nStatus: proposed\n");
  write(root, "docs/progress/sprint-043-patch-003.md", "# Generator self report\n\n実装完了（自己報告）\n");
  if (!options.feedbackAbsent) write(root, "docs/feedback/sprint-043-patch-003.md", "# Independent evaluation\n\nVerdict: **FAIL**\n");
  write(root, "AGENTS.md", "# Guidance\n");
  write(root, "CLAUDE.md", "# Guidance\n");
  write(root, "package.json", "{\"name\":\"fixture\"}\n");
  if (options.large !== false) {
    const chunk = `# Design\n${"x".repeat(218_000)}\n`;
    for (let index = 0; index < 10; index += 1) write(root, `docs/spec/large-${String(index).padStart(2, "0")}.md`, chunk);
    for (let index = 0; index < 12; index += 1) write(root, `${index % 2 ? "src" : "scripts"}/bulk-${String(index).padStart(2, "0")}.txt`, "y".repeat(190_000));
  }
  return root;
}
function tree(root, rel = "") {
  const rows = [];
  const base = join(root, rel);
  for (const entry of readdirSync(base, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    const path = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) rows.push(`link:${path}:${readlinkSync(join(root, path))}`);
    else if (entry.isDirectory()) { rows.push(`dir:${path}`); rows.push(...tree(root, path)); }
    else if (entry.isFile()) rows.push(`file:${path}:${sha(readFileSync(join(root, path)))}`);
    else rows.push(`other:${path}`);
  }
  return rows;
}
function normalizedPreview(preview) {
  return {
    repoIdentity: preview.project.repoIdentity,
    candidates: preview.candidates.map(({ path, kind, source, digest, harnessBundle }) => ({ path, kind, source, digest, harnessBundle })),
    coverageDigest: preview.scan.harness.coverageDigest,
  };
}
function source(report, role) { return report.harness.sources.find((row) => row.role === role); }
function copyTreeNoFollow(sourceRoot, destinationRoot) {
  mkdirSync(destinationRoot, { recursive: true });
  for (const entry of readdirSync(sourceRoot, { withFileTypes: true })) {
    const from = join(sourceRoot, entry.name), to = join(destinationRoot, entry.name);
    if (entry.isDirectory()) copyTreeNoFollow(from, to);
    else if (entry.isFile()) copyFileSync(from, to);
    else if (entry.isSymbolicLink()) symlinkSync(readlinkSync(from), to, process.platform === "win32" ? "junction" : undefined);
    else throw new Error(`unsupported fixture entry: ${from}`);
  }
}
function copyInventoryFixture(destinationRoot) {
  const paths = new Set(["plugins/secretary/collaboration-inventory.json", ...Object.values(expectedSurfacePaths()).flat()]);
  for (const path of paths) {
    const target = join(destinationRoot, path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(ROOT, path), target);
  }
}
function initializeInventoryGitFixture(root) {
  const paths = [...new Set(Object.values(expectedSurfacePaths()).flat())];
  run("git", ["init", "-q"], { cwd: root, expected: 0 }); run("git", ["add", "."], { cwd: root, expected: 0 });
  let executablePaths;
  if (existsSync(join(ROOT, ".git"))) {
    const sourceIndex = run("git", ["ls-files", "--stage", "-z", "--", ...paths], { cwd: ROOT, expected: 0 }).stdout;
    executablePaths = sourceIndex.split("\0").filter(Boolean).flatMap((row) => {
      const match = row.match(/^(100755)\s+[a-f0-9]+\s+\d+\t(.+)$/u);
      return match ? [match[2]] : [];
    });
  } else {
    executablePaths = paths.filter((path) => (lstatSync(join(ROOT, path)).mode & 0o111) !== 0);
  }
  for (const path of executablePaths) run("git", ["update-index", "--chmod=+x", "--", path], { cwd: root, expected: 0 });
}

const cleanup = [];
try {
  const base = harnessFixture("clarity-hs001"); cleanup.push(base);
  const baseReport = scanRepository(base);
  record("yasashii-HS-001", "PASS", "reserved-lane-before-generic", () => {
    assert.equal(baseReport.harness.detection.kind, "harness");
    assert.equal(baseReport.lanes.generic.partial, true);
    for (const role of ["orchestrator-execution-truth", "requirements", "generator-self-report", "evaluator-validation"]) assert.equal(source(baseReport, role).coverage, "inspected");
    assert.equal(baseReport.candidates[0].source, "harness-authoritative");
  });

  record("yasashii-HS-002", "PASS", "non-harness-partial-invalid-separated", () => {
    const non = mkdtempSync(join(tmpdir(), "clarity-non-harness-")); cleanup.push(non); write(non, "README.md", "# Plain\n");
    const first = scanRepository(non), second = scanRepository(non);
    assert.equal(first.harness.detection.kind, "non-harness");
    assert.deepEqual(first.candidates, second.candidates);
    const partial = mkdtempSync(join(tmpdir(), "clarity-partial-harness-")); cleanup.push(partial); write(partial, "docs/spec.md", "# Spec\n");
    assert.equal(scanRepository(partial).harness.detection.kind, "partial");
    const invalid = mkdtempSync(join(tmpdir(), "clarity-invalid-harness-")); cleanup.push(invalid); write(invalid, "docs/spec.md", "# Spec\n"); write(invalid, "docs/sprints/state.md", stateText({ current: "../../outside" }));
    assert.equal(scanRepository(invalid).harness.detection.kind, "invalid");
  });

  record("yasashii-HS-003", "PASS", "semantic-current-bundle", () => {
    const bundle = baseReport.harness.bundle;
    assert.equal(bundle.currentId, "sprint-043-patch-003");
    assert.deepEqual(bundle.roles.map((row) => row.role), ["orchestrator-execution-truth", "requirements", "generator-self-report", "evaluator-validation"]);
    assert.equal(bundle.roles.at(-1).status, "failed");
    assert.equal(baseReport.candidates.filter((row) => row.source === "harness-authoritative").length, 1);
  });

  record("yasashii-HS-004", "PASS", "feedback-absence-is-not-scan-limit", () => {
    const root = harnessFixture("clarity-hs004", { feedbackAbsent: true, large: false }); cleanup.push(root);
    const report = scanRepository(root); const feedback = source(report, "evaluator-validation");
    assert.equal(feedback.coverage, "not-found"); assert.equal(feedback.reason, "evaluation-not-yet-recorded"); assert.equal(feedback.status, "not-recorded");
  });

  record("yasashii-HS-005", "PASS", "bounded-current-fallbacks", () => {
    const tbd = harnessFixture("clarity-hs005-tbd", { state: stateText({ current: "TBD", next: "sprint-043-patch-003" }), large: false }); cleanup.push(tbd);
    assert.equal(scanRepository(tbd).harness.state.fallbackSource, "next-planned");
    const lastDone = harnessFixture("clarity-hs005-last-done", { state: stateText({ current: "TBD", next: "TBD" }), large: false }); cleanup.push(lastDone);
    assert.deepEqual({ id: scanRepository(lastDone).harness.state.currentId, source: scanRepository(lastDone).harness.state.fallbackSource }, { id: "sprint-043-patch-002", source: "last-recorded-completion" });
    const noFallbackState = "# State\n\n- Current ID: TBD\n- Next Planned: TBD\n\n| ID | Status |\n|---|---|\n| sprint-043-patch-003 | planned |\n";
    const noFallback = harnessFixture("clarity-hs005-no-fallback", { state: noFallbackState, large: false }); cleanup.push(noFallback);
    assert.deepEqual({ id: scanRepository(noFallback).harness.state.currentId, source: scanRepository(noFallback).harness.state.fallbackSource }, { id: null, source: null });
    const missing = harnessFixture("clarity-hs005-missing", { state: stateText({ current: "sprint-099" }), large: false }); cleanup.push(missing);
    const missingReport = scanRepository(missing); assert.equal(missingReport.harness.detection.kind, "harness"); assert.equal(source(missingReport, "requirements").coverage, "not-found");
    const invalid = harnessFixture("clarity-hs005-invalid", { state: stateText({ current: "sprint-043-patch-003（注釈付き）", next: "sprint-043-patch-003" }), large: false }); cleanup.push(invalid);
    const invalidReport = scanRepository(invalid);
    assert.deepEqual(invalidReport.harness.detection, { kind: "invalid", reason: "current-id-invalid" });
    assert.deepEqual({ id: invalidReport.harness.state.currentId, source: invalidReport.harness.state.fallbackSource, inferred: invalidReport.harness.state.inferred }, { id: "sprint-043-patch-003", source: "next-planned", inferred: true });
    assert.equal(invalidReport.harness.bundle.currentId, "sprint-043-patch-003"); assert.equal(invalidReport.harness.bundle.inferred, true); assert.equal(invalidReport.harness.bundle.partial, true);
    assert.deepEqual(invalidReport.harness.bundle.roles.map((row) => [row.role, row.coverage]), [["orchestrator-execution-truth", "inspected"], ["requirements", "inspected"], ["generator-self-report", "inspected"], ["evaluator-validation", "inspected"]]);
    assert.equal(invalidReport.candidates[0].source, "harness-authoritative"); assert.equal(invalidReport.lanes.authoritative.partial, true); assert(invalidReport.harness.sources.length >= 4);
    const lastRecorded = harnessFixture("clarity-hs005-invalid-last-done", { state: stateText({ current: "sprint-999（完了注釈）", next: "TBD" }), large: false }); cleanup.push(lastRecorded);
    write(lastRecorded, "docs/sprints/sprint-043-patch-002.md", "# Prior requirements\n"); write(lastRecorded, "docs/progress/sprint-043-patch-002.md", "# Prior progress\n"); write(lastRecorded, "docs/feedback/sprint-043-patch-002.md", "# Prior feedback\n\nVerdict: PASS\n");
    const lastRecordedReport = scanRepository(lastRecorded);
    assert.deepEqual({ detection: lastRecordedReport.harness.detection.kind, id: lastRecordedReport.harness.bundle.currentId, source: lastRecordedReport.harness.bundle.fallbackSource, inferred: lastRecordedReport.harness.bundle.inferred }, { detection: "invalid", id: "sprint-043-patch-002", source: "last-recorded-completion", inferred: true });
    assert(lastRecordedReport.harness.bundle.roles.every((row) => row.coverage === "inspected")); assert.equal(lastRecordedReport.candidates[0].source, "harness-authoritative");
    const unsafeState = "# State\n\n- Current ID: ../../outside\n- Next Planned: ../also-outside\n\n| ID | Status |\n|---|---|\n| sprint-043-patch-003 | planned |\n";
    const unsafe = harnessFixture("clarity-hs005-unsafe-no-fallback", { state: unsafeState, large: false }); cleanup.push(unsafe);
    const unsafeReport = scanRepository(unsafe); assert.equal(unsafeReport.harness.detection.kind, "invalid"); assert.equal(unsafeReport.harness.state.currentId, null); assert.equal(unsafeReport.harness.bundle, undefined); assert.equal(unsafeReport.candidates.some((row) => row.source === "harness-authoritative"), false); assert.equal(unsafeReport.lanes, undefined);
  });

  record("yasashii-HS-006", "PASS", "bounded-state-section", () => {
    const hugeState = `${stateText()}\n${"history row\n".repeat(40_000)}`;
    const root = harnessFixture("clarity-hs006", { state: hugeState, large: false }); cleanup.push(root);
    const report = scanRepository(root); const state = source(report, "orchestrator-execution-truth");
    assert.equal(report.harness.detection.kind, "harness"); assert.equal(state.reason, "bounded-section-read");
    assert(state.bytesRead <= report.lanes.authoritative.limits.maxStateSectionBytes); assert.equal(report.harness.state.currentId, "sprint-043-patch-003");
    const unresolvedState = `# Sprint State\n\n- Current ID: sprint-043-patch-003\n- Next Planned: TBD\n\n${"history\n".repeat(20_000)}| ID | Status |\n|---|---|\n| sprint-043-patch-003 | active |\n`;
    const unresolvedRoot = harnessFixture("clarity-hs006-unresolved", { state: unresolvedState, large: false }); cleanup.push(unresolvedRoot);
    const unresolved = scanRepository(unresolvedRoot);
    assert.equal(unresolved.harness.state.reason, "state-section-unresolved"); assert.equal(unresolved.harness.state.currentStatus, null); assert.equal(unresolved.lanes.authoritative.partial, true);
  });

  let boundaryReport;
  record("yasashii-HS-007", "PASS", "secret-binary-symlink-missing-separated", () => {
    const root = harnessFixture("clarity-hs007", { feedbackAbsent: true }); cleanup.push(root);
    write(root, "docs/progress/sprint-043-patch-003.md", "api_key=private-canary-value\n");
    const external = mkdtempSync(join(tmpdir(), "clarity-hs007-external-")); cleanup.push(external); write(external, "feedback.md", "outside-canary\n");
    mkdirSync(join(root, "docs/feedback"), { recursive: true });
    let symlinkAvailable = true;
    try { symlinkSync(join(external, "feedback.md"), join(root, "docs/feedback/sprint-043-patch-003.md"), "file"); }
    catch (error) {
      symlinkAvailable = false;
      assert.equal(process.platform, "win32");
      console.log(`SKIP yasashii-HS-007-symlink capability=${error.code || "creation-failed"}`);
    }
    write(root, "docs/spec/features.md", Buffer.from([0, 1, 2, 3]));
    unlinkSync(join(root, "CLAUDE.md"));
    let permissionUnreadable = false;
    chmodSync(join(root, "AGENTS.md"), 0o000);
    try { readFileSync(join(root, "AGENTS.md")); } catch (error) { permissionUnreadable = error?.code === "EACCES" || error?.code === "EPERM"; }
    boundaryReport = scanRepository(root);
    chmodSync(join(root, "AGENTS.md"), 0o600);
    assert.equal(source(boundaryReport, "generator-self-report").reason, "secret-like-content");
    assert.equal(source(boundaryReport, "evaluator-validation").reason, symlinkAvailable ? "symlink-not-followed" : "evaluation-not-yet-recorded");
    assert(boundaryReport.harness.sources.some((row) => row.role === "requirements-reference" && row.reason === "binary"));
    assert.equal(boundaryReport.harness.sources.find((row) => row.path === "CLAUDE.md").coverage, "not-found");
    if (permissionUnreadable) assert.equal(boundaryReport.harness.sources.find((row) => row.path === "AGENTS.md").reason, "permission-denied");
    else console.log("SKIP yasashii-HS-007-permission capability=host-does-not-enforce-mode-000");
    assert(!JSON.stringify(boundaryReport).includes("private-canary-value")); assert(!JSON.stringify(boundaryReport).includes("outside-canary"));
  });

  record("yasashii-HS-008", "PASS", "lane-specific-partial-coverage", () => {
    assert.equal(boundaryReport.lanes.generic.partial, true); assert.equal(boundaryReport.lanes.authoritative.partial, true);
    assert(boundaryReport.lanes.generic.partialReasons.includes("scan-limit-reached")); assert(boundaryReport.lanes.authoritative.partialReasons.length >= 3);
    assert(boundaryReport.lanes.authoritative.inspected.length > 0); assert(boundaryReport.lanes.authoritative.excluded.length > 0); assert(boundaryReport.lanes.authoritative.notFound.length > 0);
  });

  record("yasashii-HS-009", "PASS", "one-current-bundle-deterministic", () => {
    const root = harnessFixture("clarity-hs009", { large: false }); cleanup.push(root);
    for (let index = 1; index <= 40; index += 1) { write(root, `docs/sprints/sprint-${String(index).padStart(3, "0")}.md`, `# Past ${index}\n`); write(root, `docs/feedback/sprint-${String(index).padStart(3, "0")}.md`, "Verdict: PASS\n"); }
    const left = scanRepository(root), right = scanRepository(root);
    assert.equal(left.candidates.filter((row) => row.source === "harness-authoritative").length, 1); assert.equal(left.harness.coverageDigest, right.harness.coverageDigest);
    assert.equal(left.harness.bundle.currentId, "sprint-043-patch-003");
  });

  record("yasashii-HS-010", "PASS", "alias-physical-deterministic", () => {
    const parent = mkdtempSync(join(tmpdir(), "clarity-hs010-")); cleanup.push(parent);
    const physical = join(parent, "physical", "repo"); copyTreeNoFollow(base, physical);
    const aliasParent = join(parent, "alias-parent"); symlinkSync(join(parent, "physical"), aliasParent, process.platform === "win32" ? "junction" : "dir");
    const alias = join(aliasParent, "repo");
    const left = normalizedPreview(previewInit(alias)), right = normalizedPreview(previewInit(physical));
    assert.deepEqual(left, right);
  });

  record("yasashii-HS-011", "PASS", "preview-cancel-apply-git-safe", () => {
    const root = harnessFixture("clarity-hs011", { large: false }); cleanup.push(root);
    run("git", ["init", "-q", "-b", "main"], { cwd: root, expected: 0 }); run("git", ["config", "user.email", "fixture@example.invalid"], { cwd: root, expected: 0 }); run("git", ["config", "user.name", "Fixture"], { cwd: root, expected: 0 });
    run("git", ["add", "."], { cwd: root, expected: 0 }); run("git", ["commit", "-qm", "fixture"], { cwd: root, expected: 0 }); run("git", ["remote", "add", "origin", "https://example.invalid/fixture.git"], { cwd: root, expected: 0 });
    assert.equal(inspectRepoIdentity(root).kind, "git");
    const nestedRoot = join(root, "nested-root"); mkdirSync(nestedRoot); assert.throws(() => inspectRepoIdentity(nestedRoot), (error) => error?.code === "git-root-mismatch");
    write(root, "dirty.txt", "dirty\n"); write(root, "staged.txt", "staged\n"); run("git", ["add", "staged.txt"], { cwd: root, expected: 0 }); write(root, "untracked.txt", "untracked\n");
    const external = mkdtempSync(join(tmpdir(), "clarity-hs011-external-")); cleanup.push(external); write(external, "canary.txt", "external-canary\n");
    const beforeTree = tree(root), head = run("git", ["rev-parse", "HEAD"], { cwd: root, expected: 0 }).stdout.trim(), branch = run("git", ["branch", "--show-current"], { cwd: root, expected: 0 }).stdout.trim(), remote = run("git", ["remote", "get-url", "origin"], { cwd: root, expected: 0 }).stdout.trim();
    const preview = previewInit(root); assert.equal(preview.initialized, false); assert.deepEqual(tree(root), beforeTree);
    const canceled = run(process.execPath, [join(ROOT, "plugins/secretary/scripts/clarity.mjs"), "init", root, "--cancel", "--json"], { expected: 0 });
    assert.equal(JSON.parse(canceled.stdout).changed, false); assert.deepEqual(tree(root), beforeTree);
    assert.equal(previewInit(root).scan.harness.coverageDigest, preview.scan.harness.coverageDigest);
    const failedRoot = harnessFixture("clarity-hs011-failure", { large: false }); cleanup.push(failedRoot); const failedBefore = tree(failedRoot);
    process.env.CLARITY_FAIL_AT = "before-canonical";
    try { assert.throws(() => applyInit(failedRoot), (error) => error?.code === "failure-injected"); }
    finally { delete process.env.CLARITY_FAIL_AT; }
    assert.deepEqual(tree(failedRoot), failedBefore);
    const applied = applyInit(root); assert.match(applied.status, /^initialized/u); assert(existsSync(join(root, ".clarity/project.json")));
    const added = tree(root).filter((row) => !beforeTree.includes(row)); assert(added.length > 0); assert(added.every((row) => /^dir:\.clarity(?:\/|$)|^file:\.clarity\/|^file:CLARITY\.md:/u.test(row)), JSON.stringify(added));
    const clarityAfterApply = tree(root, ".clarity"); const retried = applyInit(root); assert.equal(retried.status, "unchanged"); assert.deepEqual(retried.changes, { rootEntry: false, state: false }); assert.deepEqual(tree(root, ".clarity"), clarityAfterApply);
    assert.equal(run("git", ["rev-parse", "HEAD"], { cwd: root, expected: 0 }).stdout.trim(), head); assert.equal(run("git", ["branch", "--show-current"], { cwd: root, expected: 0 }).stdout.trim(), branch); assert.equal(run("git", ["remote", "get-url", "origin"], { cwd: root, expected: 0 }).stdout.trim(), remote);
    assert.equal(readFileSync(join(root, "dirty.txt"), "utf8"), "dirty\n"); assert.equal(readFileSync(join(root, "staged.txt"), "utf8"), "staged\n"); assert.equal(readFileSync(join(root, "untracked.txt"), "utf8"), "untracked\n");
    assert.equal(readFileSync(join(external, "canary.txt"), "utf8"), "external-canary\n");
  });

  if (process.platform !== "win32") {
    for (const id of ["yasashii-HS-012", "yasashii-HS-013", "yasashii-HS-014", "yasashii-HS-015"]) record(id, "NOT-RUN", "requires-windows-native");
  } else {
    record("yasashii-HS-012", "PASS", "windows-native-drive-unicode-crlf", () => {
      const root = harnessFixture("clarity-hs012", { large: false }); cleanup.push(root); write(root, "docs/spec/windows-crlf.md", "# Windows\r\n空白 日本語\r\n");
      assert.match(root, /^[A-Za-z]:\\/u); const preview = previewInit(root); assert.equal(preview.scan.harness.detection.kind, "harness"); assert.equal(preview.project.repoIdentity.rootName.includes("日本語"), true);
    });
    record("yasashii-HS-013", "PASS", "windows-invalid-case-prefix-fail-closed", () => {
      assert.equal(classifyHarnessRelativePath("docs/CON.md", { platform: "win32" }).reason, "windows-reserved-name");
      assert.equal(classifyHarnessRelativePath("docs/bad?.md", { platform: "win32" }).reason, "windows-invalid-path");
      assert.equal(classifyHarnessRelativePath("../repo-prefix-other/canary", { platform: "win32" }).reason, "path-invalid");
      const root = harnessFixture("clarity-hs013", { large: false }); cleanup.push(root); write(root, "docs/spec/Case.md", "# Case\n"); write(root, "docs/spec.md", "# Spec\n\n[case](spec/case.md)\n[reserved](spec/CON.md)\n");
      const report = scanRepository(root); assert(report.lanes.authoritative.uninspected.some((row) => row.reason === "path-case-mismatch")); assert(report.lanes.authoritative.uninspected.some((row) => row.reason === "windows-reserved-name"));
    });
    record("yasashii-HS-014", "PASS", "separate-symlink-junction-capabilities", () => {
      const root = mkdtempSync(join(tmpdir(), "clarity-hs014-")); cleanup.push(root);
      const capabilities = {};
      for (const [name, linkType] of [["symlink", "dir"], ["junction", "junction"]]) {
        const probeTarget = join(root, `${name}-probe-target`); mkdirSync(probeTarget);
        try {
          symlinkSync(probeTarget, join(root, `${name}-probe`), linkType);
        } catch (error) {
          capabilities[name] = { available: false, status: "SKIP", reason: error.code || "creation-failed" };
          capabilityStatuses.push({ name, status: "SKIP", reason: capabilities[name].reason });
          continue;
        }
        const physicalParent = join(root, `${name}-physical`), physical = join(physicalParent, "repo"); copyTreeNoFollow(base, physical);
        const aliasParent = join(root, `${name}-alias`); symlinkSync(physicalParent, aliasParent, linkType);
        assert.deepEqual(normalizedPreview(previewInit(join(aliasParent, "repo"))), normalizedPreview(previewInit(physical)));
        const boundary = harnessFixture(`clarity-hs014-${name}-boundary`, { large: false }); cleanup.push(boundary);
        const outside = join(root, `${name}-outside`); mkdirSync(outside);
        symlinkSync(outside, join(boundary, ".clarity"), linkType);
        assert.throws(() => previewInit(boundary), (error) => error?.code === "root-internal-symlink");
        capabilities[name] = { available: true, status: "PASS", reason: null };
        capabilityStatuses.push({ name, status: "PASS", reason: null });
      }
      assert.deepEqual(Object.keys(capabilities).sort(), ["junction", "symlink"]); console.log(`WINDOWS_CAPABILITIES=${JSON.stringify(capabilities)}`);
    });
    record("yasashii-HS-015", "PASS", "causal-windows-workflow-entry", () => {
      const workflow = readFileSync(join(ROOT, ".github/workflows/windows-recording-regression.yml"), "utf8");
      assert.match(workflow, /windows-native:/u); assert.match(workflow, /timeout-minutes:\s*10/u); assert.match(workflow, /sprint-038-patch-002-windows-test\.mjs --require-windows/u); assert.match(workflow, /sprint-043-patch-003-test\.mjs --require-windows/u);
    });
  }

  record("yasashii-HS-016", "PASS", "registry-inventory-portable-entry", () => {
    const claritySpec = readFileSync(join(ROOT, "docs/spec/clarity.md"), "utf8");
    const rows = [...claritySpec.matchAll(/^\| (yasashii-HS-\d{3}) \| (Critical|High) \|/gmu)].map((match) => ({ id: match[1], severity: match[2] }));
    const expectedIds = Array.from({ length: 16 }, (_, index) => `yasashii-HS-${String(index + 1).padStart(3, "0")}`);
    assert.deepEqual(rows.map((row) => row.id), expectedIds); assert.equal(new Set(rows.map((row) => row.id)).size, 16);
    assert.deepEqual(rows.filter((row) => row.severity === "High").map((row) => row.id), ["yasashii-HS-008", "yasashii-HS-009"]);
    assert.match(claritySpec, /Yasashii固有IDとしてF77へ一度だけ割り当てる/u);
    const inventory = validateCollaborationInventory(ROOT); assert.equal(inventory.caseCount, 57); assert.equal(inventory.surfaceCount, 20);
    const portable = mkdtempSync(join(tmpdir(), "clarity-hs016-inventory-")); cleanup.push(portable); copyInventoryFixture(portable); initializeInventoryGitFixture(portable);
    const eolPath = join(portable, "plugins/secretary/skills/secretary/SKILL.md"); const lf = readFileSync(eolPath, "utf8").replaceAll("\r\n", "\n"); writeFileSync(eolPath, lf.replaceAll("\n", "\r\n"));
    assert.deepEqual(validateCollaborationInventory(portable), inventory);
    writeFileSync(eolPath, `${readFileSync(eolPath, "utf8")}meaningful-tamper\r\n`);
    assert.throws(() => validateCollaborationInventory(portable), /inventory-digest-stale:secretary-router/u);
    const modeFixture = mkdtempSync(join(tmpdir(), "clarity-hs016-mode-")); cleanup.push(modeFixture); copyInventoryFixture(modeFixture); initializeInventoryGitFixture(modeFixture);
    const executablePath = join(modeFixture, "plugins/secretary/scripts/collaboration-router.mjs"); chmodSync(executablePath, 0o644);
    if (process.platform === "win32") run("git", ["update-index", "--chmod=-x", "--", "plugins/secretary/scripts/collaboration-router.mjs"], { cwd: modeFixture, expected: 0 });
    assert.throws(() => validateCollaborationInventory(modeFixture), /inventory-digest-stale:secretary-router/u);
  });
} finally {
  for (const path of cleanup.reverse()) {
    try { chmodSync(path, 0o700); } catch { /* best effort fixture cleanup */ }
    try { rmSync(path, { recursive: true, force: true }); } catch { /* leave only OS temp evidence */ }
  }
}

if (requireWindows && process.platform !== "win32") {
  console.error("--require-windows was used outside Windows");
  process.exitCode = 1;
}
const counts = { PASS: 0, FAIL: 0, SKIP: 0, "NOT-RUN": 0 };
for (const result of statuses.values()) counts[result.status] += 1;
const windowsVerified = process.platform === "win32" && counts.FAIL === 0 && ["yasashii-HS-012", "yasashii-HS-013", "yasashii-HS-014", "yasashii-HS-015"].every((id) => statuses.get(id)?.status === "PASS");
const capabilityCounts = capabilityStatuses.reduce((result, row) => ({ ...result, [row.status]: (result[row.status] || 0) + 1 }), { PASS: 0, SKIP: 0 });
if (process.platform === "win32") console.log(`WINDOWS_CAPABILITY_PASS=${capabilityCounts.PASS} SKIP=${capabilityCounts.SKIP} DETAILS=${JSON.stringify(capabilityStatuses)}`);
console.log(`YASASHII_SPRINT043_PATCH003_PASS=${counts.PASS} FAIL=${counts.FAIL} SKIP=${counts.SKIP} NOT_RUN=${counts["NOT-RUN"]} TOTAL=${statuses.size} EXTERNAL_WRITES=${externalWrites} NETWORK_CALLS=${networkCalls} WINDOWS_VERIFIED=${windowsVerified}`);
if (statuses.size !== 16 || counts.FAIL || (requireWindows && !windowsVerified)) process.exitCode = 1;
