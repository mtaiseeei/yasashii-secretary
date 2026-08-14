#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createIdentity, readIdentity } from "../plugins/secretary/scripts/lib/secretary-identity.mjs";
import { applyRename, previewRename } from "../plugins/secretary/scripts/lib/secretary-rename.mjs";
import { updateUserScopeRouting } from "../plugins/secretary/scripts/lib/user-scope-routing.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "plugins", "secretary", "scripts", "secretary-name.mjs");
const sandbox = mkdtempSync(join(tmpdir(), "sprint-039-patch-001-"));
let pass = 0;
let fail = 0;

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } });
}
function sha(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function tree(root) {
  const rows = [];
  function walk(path) {
    if (!existsSync(path)) return;
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (entry.name === ".git") continue;
      const target = join(path, entry.name);
      const rel = relative(root, target).split("\\").join("/");
      if (entry.isDirectory()) walk(target);
      else rows.push([rel, entry.isSymbolicLink() ? "symlink" : sha(readFileSync(target))]);
    }
  }
  walk(root);
  return rows;
}
function gitState(workspace) {
  return {
    head: git(workspace, ["rev-parse", "HEAD"]).trim(),
    index: git(workspace, ["diff", "--cached", "--binary", "--full-index"]),
    status: git(workspace, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]),
    branch: git(workspace, ["symbolic-ref", "-q", "HEAD"]).trim(),
    remotes: git(workspace, ["remote", "-v"]),
    commits: Number(git(workspace, ["rev-list", "--count", "HEAD"]).trim()),
  };
}
function check(label, fn) {
  try { fn(); pass += 1; process.stdout.write(`PASS ${label}\n`); }
  catch (error) { fail += 1; process.stdout.write(`FAIL ${label}: ${error?.stack || error}\n`); }
}
function commit(workspace, message = "fixture baseline") {
  git(workspace, ["add", "-A"]);
  git(workspace, ["commit", "-q", "-m", message]);
}
function fixture(name, { parentRepository = false } = {}) {
  const container = join(sandbox, name);
  const workspace = parentRepository ? join(container, "workspace") : container;
  const secretary = join(workspace, "secretary");
  mkdirSync(join(secretary, "memory"), { recursive: true });
  mkdirSync(join(secretary, "docs"), { recursive: true });
  mkdirSync(join(workspace, ".secretary"), { recursive: true });
  writeFileSync(join(workspace, ".secretary", "workspace-edition.json"), `${JSON.stringify({ schemaVersion: 1, edition: "yasashii-secretary" })}\n`);
  writeFileSync(join(secretary, "identity.json"), `${JSON.stringify(createIdentity({ displayName: "Alex", secretaryId: randomUUID(), createdAt: "2026-08-14T00:00:00.000Z" }), null, 2)}\n`);
  writeFileSync(join(secretary, "AGENTS.md"), "# Secretary\n\n- 表示名: Alex (AI Secretary)\n- 顧客Alexの本文は保持\n");
  writeFileSync(join(secretary, "memory", "MEMORY.md"), "# Memory\n");
  writeFileSync(join(secretary, "docs", "selected.md"), "Alex CURRENT-DRAFT-SENTINEL\n");
  const gitRoot = parentRepository ? container : workspace;
  git(gitRoot, ["init", "-q"]);
  git(gitRoot, ["config", "user.name", "Fixture User"]);
  git(gitRoot, ["config", "user.email", "fixture@example.invalid"]);
  git(gitRoot, ["remote", "add", "origin", "https://example.invalid/fixture.git"]);
  commit(gitRoot);
  return { workspace, secretary, gitRoot };
}
function home(name, identity) {
  const path = join(sandbox, `${name}-home`);
  mkdirSync(join(path, ".codex"), { recursive: true });
  mkdirSync(join(path, ".claude"), { recursive: true });
  writeFileSync(join(path, ".codex", "AGENTS.md"), "CODEX USER CONTENT\n");
  writeFileSync(join(path, ".claude", "CLAUDE.md"), "CLAUDE USER CONTENT\n");
  updateUserScopeRouting({ home: path, identity, confirm: true });
  return path;
}
function assertRolledBack(item, before) {
  assert.deepEqual(tree(item.workspace), before.workspace);
  assert.deepEqual(tree(before.homePath), before.home);
  assert.deepEqual(gitState(item.workspace), before.git);
}

try {
  const previewCase = fixture("preview");
  const previewHome = home("preview", readIdentity(previewCase.secretary));
  const previewWorkspaceBefore = tree(previewCase.workspace);
  const previewHomeBefore = tree(previewHome);
  const previewGitBefore = gitState(previewCase.workspace);
  check("previewはrequired checkpointと正確なGit root／pushなしを表示しwrite 0", () => {
    const report = previewRename({ secretaryRoot: previewCase.secretary, newName: "Morgan", home: previewHome });
    assert.equal(report.readOnly, true);
    assert.equal(report.checkpoint.status, "required");
    assert.equal(report.checkpoint.workspaceRoot, realpathSync(previewCase.workspace));
    assert.equal(report.checkpoint.gitTopLevel, realpathSync(previewCase.workspace));
    assert.deepEqual(report.checkpoint.ownedPaths.sort(), ["secretary/AGENTS.md", "secretary/identity.json"]);
    assert.equal(report.checkpoint.push, "not-run");
    assert.deepEqual(tree(previewCase.workspace), previewWorkspaceBefore);
    assert.deepEqual(tree(previewHome), previewHomeBefore);
    assert.deepEqual(gitState(previewCase.workspace), previewGitBefore);
  });
  check("確認拒否はworkspace／HOME／Git write 0", () => {
    assert.throws(() => applyRename({ secretaryRoot: previewCase.secretary, newName: "Morgan", home: previewHome }), /明示確認前/u);
    assert.deepEqual(tree(previewCase.workspace), previewWorkspaceBefore);
    assert.deepEqual(tree(previewHome), previewHomeBefore);
    assert.deepEqual(gitState(previewCase.workspace), previewGitBefore);
  });

  const success = fixture("success");
  writeFileSync(join(success.workspace, "staged-user.md"), "BASE\n");
  writeFileSync(join(success.workspace, "unstaged-user.md"), "BASE\n");
  commit(success.workspace, "user files baseline");
  writeFileSync(join(success.workspace, "staged-user.md"), "STAGED USER CHANGE\n");
  git(success.workspace, ["add", "staged-user.md"]);
  writeFileSync(join(success.workspace, "unstaged-user.md"), "UNSTAGED USER CHANGE\n");
  writeFileSync(join(success.workspace, "untracked-user.md"), "UNTRACKED USER CHANGE\n");
  const successHome = home("success", readIdentity(success.secretary));
  const successBefore = gitState(success.workspace);
  check("required checkpointは所有pathだけを1 commitし既存dirty／stage／untrackedを保持", () => {
    const result = applyRename({ secretaryRoot: success.secretary, newName: "Morgan", home: successHome, confirm: true, confirmedClasses: ["current-config", "user-content"], selectedUserContent: ["docs/selected.md"] });
    assert.equal(result.checkpoint.status, "required-completed");
    assert.equal(result.checkpoint.push, "not-run");
    assert.equal(gitState(success.workspace).commits, successBefore.commits + 1);
    const changed = git(success.workspace, ["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"]).trim().split("\n").sort();
    assert.deepEqual(changed, ["secretary/AGENTS.md", "secretary/docs/selected.md", "secretary/identity.json"]);
    const after = gitState(success.workspace);
    assert.equal(after.status, successBefore.status);
    assert.equal(after.index, successBefore.index);
    assert.equal(after.remotes, successBefore.remotes);
    assert.match(readFileSync(join(success.secretary, "AGENTS.md"), "utf8"), /顧客Alexの本文は保持/u);
  });
  check("checkpoint messageは旧名／新名／利用者本文を含まずremote操作0", () => {
    const message = git(success.workspace, ["show", "-s", "--format=%B", "HEAD"]);
    assert.doesNotMatch(message, /Alex|Morgan|CURRENT-DRAFT-SENTINEL/u);
    assert.equal(git(success.workspace, ["remote", "-v"]), successBefore.remotes);
  });

  const userOnly = fixture("user-only");
  const userOnlyHome = home("user-only", readIdentity(userOnly.secretary));
  applyRename({ secretaryRoot: userOnly.secretary, newName: "Morgan", confirm: true, confirmedClasses: ["current-config"] });
  const userOnlyHead = gitState(userOnly.workspace);
  check("workspace変更0のuser-scope-onlyはnot-applicableでcommit 0", () => {
    const preview = previewRename({ secretaryRoot: userOnly.secretary, newName: "Morgan", home: userOnlyHome });
    assert.equal(preview.checkpoint.status, "not-applicable");
    const result = applyRename({ secretaryRoot: userOnly.secretary, newName: "Morgan", home: userOnlyHome, confirm: true, confirmedClasses: ["current-config"] });
    assert.equal(result.checkpoint.status, "not-applicable");
    assert.deepEqual(gitState(userOnly.workspace), userOnlyHead);
    assert.match(readFileSync(join(userOnlyHome, ".codex", "AGENTS.md"), "utf8"), /Morgan/u);
  });

  for (const point of ["before-write-2", "before-checkpoint", "stage", "commit", "post-commit"]) {
    const item = fixture(`failure-${point}`);
    const itemHome = home(`failure-${point}`, readIdentity(item.secretary));
    const before = { workspace: tree(item.workspace), homePath: itemHome, home: tree(itemHome), git: gitState(item.workspace) };
    check(`${point} failureはworkspace／HOME／HEAD／index／worktreeを完全rollback`, () => {
      assert.throws(() => applyRename({ secretaryRoot: item.secretary, newName: "Morgan", home: itemHome, confirm: true, confirmedClasses: ["current-config"], failAt: point }));
      assertRolledBack(item, before);
      assert.equal(existsSync(join(item.workspace, ".git", "secretary-name-rename.lock")), false);
    });
  }

  const cliFailure = fixture("cli-commit-failure");
  const cliHome = home("cli-commit-failure", readIdentity(cliFailure.secretary));
  const cliBefore = { workspace: tree(cliFailure.workspace), homePath: cliHome, home: tree(cliHome), git: gitState(cliFailure.workspace) };
  check("rename-apply --fail-at commitは実在commit工程で非0となりrollback", () => {
    const result = spawnSync(process.execPath, [CLI, "rename-apply", "--secretary", cliFailure.secretary, "--name", "Morgan", "--home", cliHome, "--confirm", "--confirm-class", "current-config", "--fail-at", "commit"], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}${result.stderr}`, /Gitの安全なcommit処理に失敗/u);
    assertRolledBack(cliFailure, cliBefore);
  });
  check("commit failure後retryは1 commit、成功後再実行は追加commit／差分0", () => {
    const retry = applyRename({ secretaryRoot: cliFailure.secretary, newName: "Morgan", home: cliHome, confirm: true, confirmedClasses: ["current-config"] });
    assert.equal(retry.checkpoint.status, "required-completed");
    const afterRetry = gitState(cliFailure.workspace);
    assert.equal(afterRetry.commits, cliBefore.git.commits + 1);
    const rerun = applyRename({ secretaryRoot: cliFailure.secretary, newName: "Morgan", home: cliHome, confirm: true, confirmedClasses: ["current-config"] });
    assert.equal(rerun.status, "unchanged");
    assert.equal(rerun.checkpoint.status, "not-applicable");
    assert.deepEqual(gitState(cliFailure.workspace), afterRetry);
  });

  const dirtyTarget = fixture("dirty-target");
  writeFileSync(join(dirtyTarget.secretary, "AGENTS.md"), `${readFileSync(join(dirtyTarget.secretary, "AGENTS.md"), "utf8")}USER PREEXISTING\n`);
  const dirtyBefore = { workspace: tree(dirtyTarget.workspace), git: gitState(dirtyTarget.workspace) };
  check("rename対象自身の開始前dirtyは自動commitせずsafe stop", () => {
    assert.throws(() => previewRename({ secretaryRoot: dirtyTarget.secretary, newName: "Morgan" }), /開始前のGit変更/u);
    assert.deepEqual(tree(dirtyTarget.workspace), dirtyBefore.workspace);
    assert.deepEqual(gitState(dirtyTarget.workspace), dirtyBefore.git);
  });

  const parent = fixture("parent-repo", { parentRepository: true });
  const parentBefore = { workspace: tree(parent.workspace), git: gitState(parent.gitRoot) };
  check("親repoをcanonical Git rootとして誤採用せずsafe stop", () => {
    assert.throws(() => previewRename({ secretaryRoot: parent.secretary, newName: "Morgan" }), /Git top-level/u);
    assert.deepEqual(tree(parent.workspace), parentBefore.workspace);
    assert.deepEqual(gitState(parent.gitRoot), parentBefore.git);
  });

  const nested = fixture("nested-repo");
  const nestedDir = join(nested.secretary, "docs", "nested");
  mkdirSync(nestedDir, { recursive: true });
  writeFileSync(join(nestedDir, "note.md"), "Alex nested\n");
  git(nestedDir, ["init", "-q"]);
  const nestedBefore = { workspace: tree(nested.workspace), git: gitState(nested.workspace) };
  check("nested別repoのselected pathはsafe stopし親Git変更0", () => {
    assert.throws(() => applyRename({ secretaryRoot: nested.secretary, newName: "Morgan", confirm: true, confirmedClasses: ["current-config", "user-content"], selectedUserContent: ["docs/nested/note.md"] }), /nested別repo/u);
    assert.deepEqual(tree(nested.workspace), nestedBefore.workspace);
    assert.deepEqual(gitState(nested.workspace), nestedBefore.git);
  });

  const unknown = fixture("unknown-failure");
  const unknownBefore = { workspace: tree(unknown.workspace), git: gitState(unknown.workspace) };
  check("未知failure pointは受理せず副作用0", () => {
    assert.throws(() => applyRename({ secretaryRoot: unknown.secretary, newName: "Morgan", confirm: true, confirmedClasses: ["current-config"], failAt: "ignored-point" }), /未知/u);
    assert.deepEqual(tree(unknown.workspace), unknownBefore.workspace);
    assert.deepEqual(gitState(unknown.workspace), unknownBefore.git);
  });
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}

process.stdout.write(`SPRINT039_PATCH001_PASS=${pass} SPRINT039_PATCH001_FAIL=${fail}\n`);
process.exitCode = fail === 0 ? 0 : 1;
