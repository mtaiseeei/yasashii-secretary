#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync,
  realpathSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { applyInit, inspectRepoIdentity, previewInit } from "../plugins/secretary/scripts/lib/clarity-core.mjs";
import { compareDrift } from "../plugins/secretary/scripts/lib/clarity-drift.mjs";
import { inspectClarityHookRoot } from "../plugins/secretary/scripts/lib/clarity-hook.mjs";
import { inspectLinkIdentity, prepareLink } from "../plugins/secretary/scripts/lib/clarity-link.mjs";
import { buildProjectionBundle } from "../plugins/secretary/scripts/lib/clarity-projection.mjs";
import {
  dailyClarityRollup, observeCanonicalRepo, portfolioRollup, secretaryProjectClarityStatus, weeklyClarityRollup,
} from "../plugins/secretary/scripts/lib/clarity-secretary.mjs";
import {
  clearClarityRootObservation,
  resolveClarityRoot,
  withClarityRootObservation,
} from "../plugins/secretary/scripts/lib/clarity-root.mjs";
import { safeWritePath, workingRoot } from "../plugins/secretary/scripts/lib/safe-fs.mjs";

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const clarityCli = join(sourceRoot, "plugins/secretary/scripts/clarity.mjs");
const secretaryCli = join(sourceRoot, "plugins/secretary/scripts/clarity-secretary.mjs");
const targetCasesPath = join(sourceRoot, "scripts/fixtures/sprint-043-patch-002/target-cases.json");
const fixedNow = "2026-08-30T09:00:00.000Z";
const tests = [];
const sha = (value) => createHash("sha256").update(value).digest("hex");

function test(id, label, fn) { tests.push({ id, label, fn }); }
function write(path, value) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); }
function run(command, args, options = {}) {
  return spawnSync(command, args, { cwd: options.cwd || sourceRoot, encoding: "utf8", timeout: 30_000, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, CLARITY_NOW: fixedNow, CC_SECRETARY_NOW: fixedNow, ...(options.env || {}) }, input: options.input });
}
function git(root, ...args) {
  const result = run("git", args, { cwd: root, env: { GIT_AUTHOR_NAME: "Clarity Fixture", GIT_AUTHOR_EMAIL: "clarity@example.invalid", GIT_COMMITTER_NAME: "Clarity Fixture", GIT_COMMITTER_EMAIL: "clarity@example.invalid" } });
  assert.equal(result.status, 0, `git ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
}
function makeRepo(root, { initialized = false } = {}) {
  mkdirSync(root, { recursive: true });
  write(join(root, "README.md"), "# Alias fixture\n\nCurrent canonical state.\n");
  git(root, "init", "-q"); git(root, "add", "README.md"); git(root, "commit", "-qm", "fixture");
  if (initialized) applyInit(root);
  return root;
}
function tree(root) {
  const rows = [];
  function visit(dir) {
    for (const name of readdirSync(dir).sort()) {
      if (name === ".git") continue;
      const path = join(dir, name); const rel = relative(root, path).replaceAll("\\", "/"); const stat = lstatSync(path);
      if (stat.isSymbolicLink()) rows.push([rel, "link", readlinkSync(path)]);
      else if (stat.isDirectory()) visit(path);
      else rows.push([rel, stat.size, sha(readFileSync(path))]);
    }
  }
  visit(root); return sha(JSON.stringify(rows));
}
function gitSnapshot(root) {
  return { status: git(root, "status", "--porcelain=v1"), head: git(root, "rev-parse", "HEAD"), branch: git(root, "symbolic-ref", "--short", "HEAD"), remotes: git(root, "remote", "-v") };
}
function pointerRecord(name, repo, entry = "README.md", updatedAt = "2020-01-01") {
  return { name, scope: "open", markdown: `---\nstatus: active\nprojectType: development-pointer\nupdatedAt: ${updatedAt}\n---\n\n# ${name}\n\n## 正本repo\n\n- 場所: ${repo}\n- 最初に読むファイル: ${entry}\n` };
}
function project(root, name, repo, entry = "README.md") {
  const dir = join(root, "projects/open", name); mkdirSync(dir, { recursive: true }); write(join(dir, "PROJECT.md"), pointerRecord(name, repo, entry).markdown);
}
function expectCode(fn, code) {
  let caught = null; try { fn(); } catch (error) { caught = error; }
  assert(caught, `expected ${code}`); assert.equal(caught.code, code); return caught;
}
function cli(command, root, expected) {
  const result = run(process.execPath, [clarityCli, command, root, "--json"]); assert.equal(result.status, expected === 0 ? 0 : 3, result.stderr || result.stdout); return JSON.parse(expected === 0 ? result.stdout : result.stderr);
}
function targetRegistry() { return JSON.parse(readFileSync(targetCasesPath, "utf8")); }

const fixture = mkdtempSync(join(tmpdir(), "yasashii-clarity-patch-002-"));
try {
  const physicalWorkspace = join(fixture, "physical-workspace"); mkdirSync(physicalWorkspace);
  const aliasWorkspace = join(fixture, "alias-workspace"); symlinkSync(physicalWorkspace, aliasWorkspace, "dir");
  const physicalRepo = makeRepo(join(physicalWorkspace, "canonical"), { initialized: true });
  const aliasRepo = join(aliasWorkspace, "canonical");
  const peerRepo = makeRepo(join(fixture, "peer-repo"), { initialized: true });
  const secretary = join(fixture, "secretary"); mkdirSync(join(secretary, "projects/open"), { recursive: true });
  project(secretary, "開発案件", aliasRepo);

  test("yasashii-CF-001", "status reads an aliased local canonical Repo with policy and identity", () => {
    const report = secretaryProjectClarityStatus(secretary, "開発案件"); const observation = report.canonicalObservation;
    assert.equal(observation.availability, "available"); assert.equal(observation.firstFile.inspected, true); assert.equal(observation.repoIdentity.kind, "git"); assert.equal(observation.clarity.status, "initialized"); assert.equal(observation.rootPolicy.source, "clarity-internal-root-resolver"); assert(observation.rootPolicy.ancestorAliasCount >= 1);
  });
  test("yasashii-CF-002", "snapshot and current canonical evidence stay separate", () => {
    const observation = observeCanonicalRepo(pointerRecord("stale", aliasRepo)); assert.equal(observation.freshness, "current-at-observation"); assert.equal(observation.snapshotFreshness, "stale-snapshot"); assert(observation.observedAt); assert(observation.sourceRevision);
  });
  test("yasashii-CF-003", "daily weekly and Portfolio share the canonical observation", () => {
    const portfolio = portfolioRollup(secretary); const daily = dailyClarityRollup(secretary); const weekly = weeklyClarityRollup(secretary);
    const digests = [portfolio.projects[0].canonicalObservation, daily.canonicalObservations[0].observation, weekly.canonicalObservations[0].observation].map((row) => `${row.sourceRevision}:${row.firstFile.digest}:${row.freshness}`);
    assert.equal(new Set(digests).size, 1); assert.equal(daily.items.length <= 3, true);
  });
  test("yasashii-CF-004", "remote-only pointers never start network or Git operations", () => {
    const report = observeCanonicalRepo(pointerRecord("remote", "https://example.invalid/org/repo.git")); assert.equal(report.sourceKind, "remote-only"); assert.equal(report.availability, "unavailable"); assert.equal(report.networkCalls, 0); assert.equal(report.gitWrites, 0);
  });
  test("yasashii-CF-005", "Secret binary large and symlink first files are excluded without content", () => {
    write(join(physicalRepo, ".env"), "API_TOKEN=synthetic-secret-value\n"); write(join(physicalRepo, "blob.bin"), Buffer.from([0, 1, 2])); write(join(physicalRepo, "large.md"), "x".repeat(70 * 1024)); write(join(fixture, "outside.md"), "outside canary\n"); symlinkSync(join(fixture, "outside.md"), join(physicalRepo, "linked.md"));
    const reasons = [".env", "blob.bin", "large.md", "linked.md"].map((entry) => observeCanonicalRepo(pointerRecord(entry, aliasRepo, entry)).firstFile.reason);
    assert.deepEqual(reasons, ["sensitive-name", "binary", "file-too-large", "symlink-not-followed"]); assert(!JSON.stringify(reasons).includes("synthetic-secret-value"));
  });
  test("yasashii-CF-006", "missing unsafe unreadable and stale sources remain truthful", () => {
    const missing = observeCanonicalRepo(pointerRecord("missing", join(fixture, "missing")));
    const selfLink = join(fixture, "repo-self-link"); symlinkSync(physicalRepo, selfLink, "dir"); const unsafe = observeCanonicalRepo(pointerRecord("unsafe", selfLink));
    const unreadableRoot = makeRepo(join(fixture, "unreadable")); chmodSync(unreadableRoot, 0o000); const unreadable = observeCanonicalRepo(pointerRecord("unreadable", unreadableRoot)); chmodSync(unreadableRoot, 0o755);
    const stale = observeCanonicalRepo(pointerRecord("stale-entry", aliasRepo, "missing-entry.md"));
    assert.deepEqual([missing.availability, unsafe.availability, unreadable.availability, stale.availability], ["missing", "unsafe", "unreadable", "stale"]); assert([missing, unsafe, unreadable, stale].every((row) => row.changed === false && row.freshness !== "aligned"));
  });
  test("yasashii-CF-007", "canonical observation preserves filesystem and Git state", () => {
    write(join(physicalRepo, "dirty.txt"), "dirty\n"); write(join(physicalRepo, "staged.txt"), "staged\n"); git(physicalRepo, "add", "staged.txt"); write(join(physicalRepo, "untracked.txt"), "untracked\n");
    const before = { tree: tree(physicalRepo), git: gitSnapshot(physicalRepo) }; const report = portfolioRollup(secretary); const after = { tree: tree(physicalRepo), git: gitSnapshot(physicalRepo) };
    assert.deepEqual(after, before); assert.equal(report.projects[0].canonicalObservation.canonicalWrites, 0); assert.equal(report.projects[0].canonicalObservation.networkCalls, 0);
  });

  const uninitializedPhysical = makeRepo(join(physicalWorkspace, "uninitialized")); const uninitializedAlias = join(aliasWorkspace, "uninitialized");
  test("yasashii-AR-001", "generic workingRoot remains closed while Clarity internally opts in", () => {
    expectCode(() => workingRoot(uninitializedAlias), "working-root-unsafe"); expectCode(() => workingRoot(uninitializedAlias, { allowAncestorSymlinks: false }), "working-root-unsafe"); const error = cli("link-identity", uninitializedAlias, 3); assert.equal(error.code, "clarity-not-initialized"); assert.equal(error.changed, false);
  });
  test("yasashii-AR-002", "alias and physical uninitialized identity reach the same next decision", () => {
    assert.equal(cli("link-identity", uninitializedAlias, 3).code, "clarity-not-initialized"); assert.equal(cli("link-identity", uninitializedPhysical, 3).code, "clarity-not-initialized"); assert.equal(cli("link-identity", aliasRepo, 0).projectId, cli("link-identity", physicalRepo, 0).projectId);
  });
  test("yasashii-AR-003", "Repo Git and Clarity identities match", () => {
    const alias = inspectLinkIdentity(aliasRepo); const physical = inspectLinkIdentity(physicalRepo); assert.equal(alias.projectId, physical.projectId); assert.equal(alias.repositoryIdentity.identityId, physical.repositoryIdentity.identityId); assert.deepEqual(inspectRepoIdentity(aliasRepo), inspectRepoIdentity(physicalRepo));
  });
  test("yasashii-AR-004", "preview is read-only and apply targets the physical .clarity tree", () => {
    write(join(uninitializedPhysical, "CLARITY.md"), "# Existing unmanaged entry\n");
    const beforeEntry = sha(readFileSync(join(uninitializedPhysical, "CLARITY.md"))); const beforeGit = gitSnapshot(uninitializedPhysical); const beforeAlias = readlinkSync(aliasWorkspace);
    const previewAlias = cli("init", uninitializedAlias, 0); const previewPhysical = cli("init", uninitializedPhysical, 0); assert.equal(previewAlias.changed, false); assert.equal(previewPhysical.changed, false); assert.deepEqual(previewAlias.writes, previewPhysical.writes);
    const result = applyInit(uninitializedAlias); assert.equal(result.status, "initialized-with-root-entry-conflict"); assert(existsSync(join(uninitializedPhysical, ".clarity/project.json"))); assert.equal(sha(readFileSync(join(uninitializedPhysical, "CLARITY.md"))), beforeEntry); assert.equal(readlinkSync(aliasWorkspace), beforeAlias);
    const afterGit = gitSnapshot(uninitializedPhysical); assert.deepEqual({ head: afterGit.head, branch: afterGit.branch, remotes: afterGit.remotes }, { head: beforeGit.head, branch: beforeGit.branch, remotes: beforeGit.remotes }); const withoutOwnedApply = (status) => status.split("\n").filter((row) => row && !row.slice(3).startsWith(".clarity/")).join("\n"); assert.equal(withoutOwnedApply(afterGit.status), withoutOwnedApply(beforeGit.status));
  });
  test("yasashii-AR-005", "working root itself remains rejected", () => {
    const self = join(fixture, "self-root"); symlinkSync(physicalRepo, self, "dir"); const error = cli("status", self, 3); assert.equal(error.code, "root-self-symlink"); assert.equal(error.changed, false);
  });
  test("yasashii-AR-006", "internal .clarity symlink never follows the external target", () => {
    const root = makeRepo(join(fixture, "internal-link")); const external = join(fixture, "external-clarity"); mkdirSync(external); write(join(external, "canary"), "safe\n"); symlinkSync(external, join(root, ".clarity"), "dir"); const before = tree(external); const error = cli("status", root, 3); assert.equal(error.code, "root-internal-symlink"); assert.equal(tree(external), before);
  });
  test("yasashii-AR-007", "broken ancestor alias fails before Clarity inspection", () => {
    const broken = join(fixture, "broken-alias"); symlinkSync(join(fixture, "absent"), broken, "dir"); const error = cli("status", join(broken, "repo"), 3); assert.equal(error.code, "ancestor-symlink-broken"); assert.equal(error.changed, false);
  });
  test("yasashii-AR-008", "alias replacement is detected before a guarded read or write", () => {
    const parentA = join(fixture, "swap-a"); const parentB = join(fixture, "swap-b"); mkdirSync(parentA); mkdirSync(parentB); const repoA = makeRepo(join(parentA, "repo"), { initialized: true }); makeRepo(join(parentB, "repo"), { initialized: true }); const alias = join(fixture, "swap"); symlinkSync(parentA, alias, "dir"); const requested = join(alias, "repo"); const resolved = resolveClarityRoot(requested); const beforeA = tree(repoA); unlinkSync(alias); symlinkSync(parentB, alias, "dir"); expectCode(() => safeWritePath(resolved.root, ".clarity/project.json"), "clarity-root-changed"); assert.equal(tree(repoA), beforeA);
    const stableRepo = makeRepo(join(fixture, "same-path-repo"), { initialized: true }); const stableObservation = resolveClarityRoot(stableRepo); const displaced = join(fixture, "same-path-repo-old"); renameSync(stableRepo, displaced); makeRepo(stableRepo); const beforeOld = tree(displaced); const beforeNew = tree(stableRepo); expectCode(() => safeWritePath(stableObservation.root, ".clarity/project.json"), "clarity-root-changed"); assert.equal(tree(displaced), beforeOld); assert.equal(tree(stableRepo), beforeNew);

    const interleavedA = join(fixture, "interleaved-a"); const interleavedB = join(fixture, "interleaved-b"); mkdirSync(interleavedA); mkdirSync(interleavedB);
    const interleavedRepoA = makeRepo(join(interleavedA, "repo"), { initialized: true }); const interleavedRepoB = makeRepo(join(interleavedB, "repo"), { initialized: true });
    const aliasOne = join(fixture, "interleaved-alias-1"); const aliasTwo = join(fixture, "interleaved-alias-2"); symlinkSync(interleavedA, aliasOne, "dir"); symlinkSync(interleavedA, aliasTwo, "dir");
    const aliasOneRequest = join(aliasOne, "repo"); const aliasTwoRequest = join(aliasTwo, "repo");
    const aliasOneHandle = resolveClarityRoot(aliasOneRequest); const aliasTwoHandle = resolveClarityRoot(aliasTwoRequest);
    assert.notEqual(aliasOneHandle.observationToken, aliasTwoHandle.observationToken);
    const repeatedAliasTwoHandle = resolveClarityRoot(aliasTwoRequest); assert.equal(repeatedAliasTwoHandle.observationToken, aliasTwoHandle.observationToken);
    const beforeInterleavedA = tree(interleavedRepoA); const beforeInterleavedB = tree(interleavedRepoB);
    unlinkSync(aliasOne); symlinkSync(interleavedB, aliasOne, "dir");
    const readError = expectCode(() => readFileSync(safeWritePath(aliasOneHandle.root, "README.md"), "utf8"), "clarity-root-changed");
    const writeError = expectCode(() => safeWritePath(aliasOneHandle.root, ".clarity/project.json"), "clarity-root-changed");
    assert.equal(readError.details.changed, false); assert.equal(writeError.details.changed, false);
    assert.equal(tree(interleavedRepoA), beforeInterleavedA); assert.equal(tree(interleavedRepoB), beforeInterleavedB);

    clearClarityRootObservation(aliasOneHandle);
    assert.equal(readFileSync(safeWritePath(aliasTwoHandle.root, "README.md"), "utf8").includes("Alias fixture"), true);
    clearClarityRootObservation(aliasTwoHandle); clearClarityRootObservation(repeatedAliasTwoHandle);
    const reused = resolveClarityRoot(aliasOneRequest); assert.equal(reused.root, realpathSync(interleavedRepoB));
    assert.equal(safeWritePath(reused.root, ".clarity/project.json"), join(realpathSync(interleavedRepoB), ".clarity/project.json"));
    clearClarityRootObservation(reused);

    const scopedA = join(fixture, "scoped-a"); const scopedB = join(fixture, "scoped-b"); mkdirSync(scopedA); mkdirSync(scopedB);
    const scopedRepoA = makeRepo(join(scopedA, "repo"), { initialized: true }); const scopedRepoB = makeRepo(join(scopedB, "repo"), { initialized: true });
    const scopedAlias = join(fixture, "scoped-alias"); symlinkSync(scopedA, scopedAlias, "dir"); const scopedRequest = join(scopedAlias, "repo");
    const beforeScopedA = tree(scopedRepoA); const beforeScopedB = tree(scopedRepoB);
    withClarityRootObservation(scopedRequest, (requestHandle) => {
      const nestedHandle = resolveClarityRoot(requestHandle.root); assert.equal(nestedHandle.observationToken, requestHandle.observationToken);
      unlinkSync(scopedAlias); symlinkSync(scopedB, scopedAlias, "dir");
      const scopedRead = expectCode(() => readFileSync(safeWritePath(requestHandle.root, "README.md"), "utf8"), "clarity-root-changed");
      const scopedWrite = expectCode(() => safeWritePath(requestHandle.root, ".clarity/project.json"), "clarity-root-changed");
      assert.equal(scopedRead.details.changed, false); assert.equal(scopedWrite.details.changed, false);
    });
    assert.equal(tree(scopedRepoA), beforeScopedA); assert.equal(tree(scopedRepoB), beforeScopedB);
    assert.equal(previewInit(scopedRepoA).initialized, true);
  });
  test("yasashii-AR-009", "link bundle contains no alias or physical absolute local path", () => {
    const identity = inspectLinkIdentity(aliasRepo); const peer = inspectLinkIdentity(peerRepo); const request = prepareLink(aliasRepo, { targetProjectId: peer.projectId, targetRepositoryIdentity: peer.repositoryIdentity, localRole: "repo" }); const body = JSON.stringify(request); assert(!body.includes(aliasRepo)); assert(!body.includes(physicalRepo)); assert.equal(identity.changed, false);
  });
  test("yasashii-AR-010", "alias operations preserve dirty staged untracked HEAD branch and remote", () => {
    const before = gitSnapshot(physicalRepo); inspectLinkIdentity(aliasRepo); buildProjectionBundle(aliasRepo); const after = gitSnapshot(physicalRepo); assert.deepEqual(after, before);
  });
  test("yasashii-AR-011", "Drift locator symlink stays rejected in read-only comparison", () => {
    const state = JSON.parse(readFileSync(join(physicalRepo, ".clarity/state.json"), "utf8")); const itemId = state.items[0].itemId; write(join(physicalRepo, "decision.md"), "key=email\n"); symlinkSync(join(physicalRepo, "decision.md"), join(physicalRepo, "decision-link.md")); const before = gitSnapshot(physicalRepo); expectCode(() => compareDrift(aliasRepo, { schemaVersion: 1, itemId, decision: { type: "spec-section", locator: { path: "decision-link.md" }, claim: { field: "key", value: "email", markers: ["key=email"] } }, implementation: { type: "file-reference", locator: { path: "README.md" }, claim: { field: "key", value: "email", markers: ["current canonical"] } } }), "drift-path-symlink"); assert.deepEqual(gitSnapshot(physicalRepo), before);
  });
  test("yasashii-AR-012", "macOS platform aliases remain normalized without user path literals", () => {
    if (process.platform === "darwin") { assert.equal(workingRoot("/tmp"), "/private/tmp"); assert.equal(workingRoot("/var"), "/private/var"); }
    const bodies = ["safe-fs.mjs", "clarity-root.mjs"].map((name) => readFileSync(join(sourceRoot, "plugins/secretary/scripts/lib", name), "utf8")).join("\n"); assert(!bodies.includes("/Users/taisei")); assert(!bodies.includes("ExternalSSD"));
  });
  test("yasashii-AR-013", "file-target ancestor alias is rejected distinctly", () => {
    const file = join(fixture, "ordinary-file"); write(file, "not a directory\n"); const alias = join(fixture, "file-alias"); symlinkSync(file, alias); const error = cli("status", join(alias, "repo"), 3); assert.equal(error.code, "ancestor-symlink-not-directory"); assert.equal(error.changed, false);
  });
  test("yasashii-AR-014", "all declared entrypoints share the Clarity internal physical policy and registry", () => {
    const core = previewInit(aliasRepo); const link = inspectLinkIdentity(aliasRepo); const projection = buildProjectionBundle(aliasRepo); const hook = inspectClarityHookRoot(aliasRepo); const observation = secretaryProjectClarityStatus(secretary, "開発案件").canonicalObservation; const root = resolveClarityRoot(aliasRepo);
    assert(core.initialized); assert(link.projectId); assert(projection.digest); assert.equal(hook.root, realpathSync(physicalRepo)); assert.equal(observation.rootPolicy.source, "clarity-internal-root-resolver"); assert.equal(root.policy.source, "clarity-internal-root-resolver");

    // A completed public-core request must release only its own root-observation
    // lease. Retargeting the old alias must not poison a later physical-root
    // request in the same process.
    const lifecycleC = join(fixture, "lifecycle-c"); const lifecycleD = join(fixture, "lifecycle-d"); mkdirSync(lifecycleC); mkdirSync(lifecycleD);
    const lifecycleRepoC = makeRepo(join(lifecycleC, "repo"), { initialized: true }); const lifecycleRepoD = makeRepo(join(lifecycleD, "repo"), { initialized: true });
    const lifecycleAlias = join(fixture, "lifecycle-alias"); symlinkSync(lifecycleC, lifecycleAlias, "dir"); const lifecycleAliasRepo = join(lifecycleAlias, "repo");
    const lifecycleBefore = { c: tree(lifecycleRepoC), d: tree(lifecycleRepoD), cGit: gitSnapshot(lifecycleRepoC), dGit: gitSnapshot(lifecycleRepoD) };
    assert.equal(previewInit(lifecycleAliasRepo).initialized, true); assert.equal(previewInit(lifecycleAliasRepo).initialized, true);
    unlinkSync(lifecycleAlias); symlinkSync(lifecycleD, lifecycleAlias, "dir");
    assert.equal(previewInit(lifecycleRepoC).initialized, true);
    assert.deepEqual({ c: tree(lifecycleRepoC), d: tree(lifecycleRepoD), cGit: gitSnapshot(lifecycleRepoC), dGit: gitSnapshot(lifecycleRepoD) }, lifecycleBefore);

    // The same finally-style lifecycle applies when the public operation fails.
    const failureC = join(fixture, "failure-c"); const failureD = join(fixture, "failure-d"); mkdirSync(failureC); mkdirSync(failureD);
    const failureRepoC = join(failureC, "repo"); const failureRepoD = join(failureD, "repo"); mkdirSync(failureRepoC); mkdirSync(failureRepoD);
    const failureAlias = join(fixture, "failure-alias"); symlinkSync(failureC, failureAlias, "dir"); const failureAliasRepo = join(failureAlias, "repo");
    expectCode(() => applyInit(failureAliasRepo), "no-candidates");
    unlinkSync(failureAlias); symlinkSync(failureD, failureAlias, "dir");
    assert.equal(previewInit(failureRepoC).initialized, false);

    const coreCli = cli("status", aliasRepo, 0);
    const linkCli = cli("link-identity", aliasRepo, 0);
    const projectionCli = cli("project", aliasRepo, 0);
    const driftInputPath = join(fixture, "entrypoint-drift.json");
    const state = JSON.parse(readFileSync(join(physicalRepo, ".clarity/state.json"), "utf8"));
    write(join(physicalRepo, "entrypoint-decision.md"), "key=email\\n");
    write(join(physicalRepo, "entrypoint-implementation.md"), "key=email\\n");
    write(driftInputPath, JSON.stringify({ schemaVersion: 1, itemId: state.items[0].itemId,
      decision: { type: "spec-section", locator: { path: "entrypoint-decision.md" }, claim: { field: "key", value: "email", markers: ["key=email"] } },
      implementation: { type: "file-reference", locator: { path: "entrypoint-implementation.md" }, claim: { field: "key", value: "email", markers: ["key=email"] } } }));
    const driftRun = run(process.execPath, [clarityCli, "drift", aliasRepo, "--input-file", driftInputPath, "--json"]);
    assert.equal(driftRun.status, 0, driftRun.stderr); const driftCli = JSON.parse(driftRun.stdout);
    const secretaryRun = run(process.execPath, [secretaryCli, "status", secretary, "開発案件", "--json"]);
    assert.equal(secretaryRun.status, 0, secretaryRun.stderr); const secretaryResult = JSON.parse(secretaryRun.stdout);
    for (const [name, result] of Object.entries({ cliCore: coreCli, link: linkCli, projection: projectionCli, drift: driftCli, secretary: secretaryResult, hook })) {
      assert.equal(result.rootPolicy?.source, "clarity-internal-root-resolver", name);
    }

    const reg = targetRegistry(); const ids = reg.cases.map((row) => row.id); assert.equal(ids.length, 21); assert.equal(new Set(ids).size, 21); assert.deepEqual([...ids].sort(), tests.map((row) => row.id).sort()); assert(reg.cases.every((row) => row.severity === "Critical" && /^F(?:60|64|69|70|71|73|74|76)$/u.test(row.feature)));
  });

  let passed = 0; let failed = 0;
  for (const row of tests) {
    try { clearClarityRootObservation(physicalRepo); row.fn(); passed += 1; process.stdout.write(`PASS ${row.id} ${row.label}\n`); }
    catch (error) { failed += 1; process.stdout.write(`FAIL ${row.id} ${row.label}: ${error instanceof Error ? error.message : String(error)}\n`); }
  }
  process.stdout.write(`SPRINT043_PATCH002_TARGET_PASS=${passed} FAIL=${failed} TOTAL=${tests.length} EXTERNAL_WRITES=0 NETWORK_CALLS=0\n`);
  if (failed) process.exitCode = 1;
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
