#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  chmodSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  readdirSync, rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyIdentityMigration, diagnoseIdentityMigration, IDENTITY_BLOCK_START,
  previewIdentityMigration,
} from "../plugins/secretary/scripts/lib/secretary-identity-migration.mjs";
import { createIdentity } from "../plugins/secretary/scripts/lib/secretary-identity.mjs";
import { applyRename, previewRename } from "../plugins/secretary/scripts/lib/secretary-rename.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const plugin = join(root, "plugins/secretary");
const temporary = mkdtempSync(join(tmpdir(), "yasashii-secretary-s039-p001-"));
let pass = 0;
let fail = 0;

function check(label, operation) {
  try { operation(); pass += 1; process.stdout.write(`PASS ${label}\n`); }
  catch (error) { fail += 1; process.stdout.write(`FAIL ${label}: ${error.message}\n`); }
}

function git(cwd, args, { allowFailure = false } = {}) {
  try { return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
  catch (error) { if (allowFailure) return null; throw error; }
}

function hash(bytes) { return `sha256:${createHash("sha256").update(bytes).digest("hex")}`; }
function json(path, value) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`); }
function fill(content, values) {
  let result = content;
  for (const [key, value] of Object.entries(values)) result = result.replaceAll(`{{${key}}}`, value);
  return result.replace(/\{\{[A-Z0-9_]+\}\}/gu, "fixture");
}

function fixedIdentity() {
  return createIdentity({
    displayName: "Morgan",
    secretaryId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    createdAt: "2026-08-14T00:00:00.000Z",
  });
}

function fixtureValues(identity) {
  return {
    OWNER_NAME: "Synthetic Owner", OWNER_ROLE: "Engineering", PRIMARY_SERVICE: "Google",
    PRIMARY_SERVICE_DETAIL: "fixture", TASKS: "fixture tasks", REPORT_DETAIL: "みじかく",
    CREATED_DATE: "2026-08-14", CREATED_AT: "2026-08-14 09:00",
    SECRETARY_NAME: identity.display_name, SECRETARY_ID: identity.secretary_id,
    CREATED_AT_ISO: identity.created_at,
  };
}

function historicalTemplate(version, identity) {
  const legacyIdentity = [
    "## 秘書identity",
    "",
    `- 表示名: ${identity.display_name} (AI Secretary)`,
    `- stable ID: ${identity.secretary_id}`,
    "- 種別: ai-secretary",
    "- 過去名: なし",
    "",
    "表示名は利用者の「呼び方」と別の設定です。変更してもstable IDと過去のauthor記録は変えません。",
  ].join("\n");
  return {
    agents: version === "v0.10.0"
      ? `# 秘書への指示（AGENTS.md）\n\n${legacyIdentity}\n\n## 通常の仕事\n\nYasashii Secretaryの既存workspaceです。\n`
      : "# 秘書への指示（AGENTS.md）\n\nYasashii Secretaryの既存workspaceです。\n",
    claude: "# 秘書への補足（CLAUDE.md）\n\n指示の正本は、同じフォルダの `AGENTS.md` です。\n",
  };
}

function seed(name, {
  templateVersion = "v0.9.2", identityBeforeCommit = false, identityAfterCommit = false,
  currentTemplate = false, crlf = false, initializeGit = true,
} = {}) {
  const workspace = join(temporary, name);
  const identity = fixedIdentity();
  mkdirSync(join(workspace, "secretary/memory"), { recursive: true });
  const historical = historicalTemplate(templateVersion, identity);
  let agents = currentTemplate
    ? fill(readFileSync(join(plugin, "templates/AGENTS.md"), "utf8"), fixtureValues(identity))
    : historical.agents;
  let claude = currentTemplate
    ? fill(readFileSync(join(plugin, "templates/CLAUDE.md"), "utf8"), fixtureValues(identity))
    : historical.claude;
  agents += "\n<!-- fixture:other-managed:start -->\nOTHER-MANAGED\n<!-- fixture:other-managed:end -->\n\nUSER-FREE-TEXT\n";
  claude += "\nCLAUDE-USER-FREE-TEXT\n";
  if (crlf) { agents = agents.replace(/\r?\n/gu, "\r\n"); claude = claude.replace(/\r?\n/gu, "\r\n"); }
  writeFileSync(join(workspace, "secretary/AGENTS.md"), agents);
  writeFileSync(join(workspace, "secretary/CLAUDE.md"), claude);
  writeFileSync(join(workspace, "secretary/memory/MEMORY.md"), "# MEMORY\n");
  json(join(workspace, ".secretary/workspace-edition.json"), { schemaVersion: 1, edition: "yasashii-secretary" });
  if (identityBeforeCommit) json(join(workspace, "secretary/identity.json"), identity);
  const recordPaths = ["secretary/AGENTS.md", "secretary/CLAUDE.md", ...(identityBeforeCommit ? ["secretary/identity.json"] : [])];
  const version = currentTemplate ? "0.10.1" : templateVersion.slice(1);
  json(join(workspace, ".secretary/update-ledger.json"), {
    schemaVersion: 2,
    edition: "yasashii-secretary",
    records: [
      { path: "secretary/memory/MEMORY.md", installedVersion: version, baselineHash: hash(readFileSync(join(workspace, "secretary/memory/MEMORY.md"))), templateVariables: { CREATED_DATE: "2026-08-14" } },
      ...recordPaths.map((path) => ({ path, installedVersion: version, baselineHash: hash(readFileSync(join(workspace, path))), templateVariables: {} })),
    ],
  });
  writeFileSync(join(workspace, "outside-unstaged.txt"), "BASE\n");
  writeFileSync(join(workspace, "outside-staged.txt"), "BASE\n");
  if (crlf) { chmodSync(join(workspace, "secretary/AGENTS.md"), 0o640); chmodSync(join(workspace, "secretary/CLAUDE.md"), 0o640); }
  if (initializeGit) {
    git(workspace, ["init", "-q"]);
    git(workspace, ["config", "user.name", "Synthetic Maintainer"]);
    git(workspace, ["config", "user.email", "synthetic@example.invalid"]);
    git(workspace, ["add", "."]);
    git(workspace, ["commit", "-qm", "historical fixture"]);
    git(workspace, ["remote", "add", "origin", "https://example.invalid/synthetic.git"]);
  }
  if (identityAfterCommit) json(join(workspace, "secretary/identity.json"), identity);
  return { workspace, identity };
}

function walk(rootPath, current = rootPath, rows = []) {
  if (!existsSync(current)) return rows;
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    const path = join(current, entry.name);
    const rel = relative(rootPath, path).split("\\").join("/");
    if (entry.isSymbolicLink()) rows.push([rel, "symlink"]);
    else if (entry.isDirectory()) { rows.push([`${rel}/`, lstatSync(path).mode & 0o777]); walk(rootPath, path, rows); }
    else rows.push([rel, lstatSync(path).mode & 0o777, hash(readFileSync(path))]);
  }
  return rows;
}

function workspaceSnapshot(workspace) {
  return JSON.stringify({
    tree: walk(workspace).sort((a, b) => a[0].localeCompare(b[0])),
    head: git(workspace, ["rev-parse", "HEAD"], { allowFailure: true })?.trim() ?? null,
    status: git(workspace, ["status", "--porcelain=v1", "-z", "--untracked-files=all"], { allowFailure: true }) ?? null,
    index: git(workspace, ["ls-files", "--stage", "-z"], { allowFailure: true }) ?? null,
    remotes: git(workspace, ["remote", "-v"], { allowFailure: true }) ?? null,
    tags: git(workspace, ["show-ref", "--tags"], { allowFailure: true }) ?? "",
  });
}

function expectRollback(workspace, operation) {
  const before = workspaceSnapshot(workspace);
  assert.throws(operation, /rollback/u);
  assert.equal(workspaceSnapshot(workspace), before);
}

function committedPaths(workspace) {
  return git(workspace, ["diff-tree", "--root", "--no-commit-id", "--name-only", "-r", "HEAD"])
    .trim().split("\n").filter(Boolean).sort();
}

try {
  const missing = seed("identity-missing");
  check("Yasashiiの固定v0.9.2／v0.10.0状態はcurrent templateと区別できる", () => {
    assert.notEqual(hash(Buffer.from(historicalTemplate("v0.9.2", fixedIdentity()).agents)), hash(readFileSync(join(plugin, "templates/AGENTS.md"))));
    assert.match(historicalTemplate("v0.10.0", fixedIdentity()).agents, /## 秘書identity/u);
    assert.doesNotMatch(historicalTemplate("v0.10.0", fixedIdentity()).agents, new RegExp(IDENTITY_BLOCK_START, "u"));
  });
  check("identity未導入のdiagnose／previewはread-only", () => {
    const before = workspaceSnapshot(missing.workspace);
    assert.equal(diagnoseIdentityMigration({ workspace: missing.workspace, pluginRoot: plugin }).status, "identity-missing");
    assert.equal(previewIdentityMigration({ workspace: missing.workspace, pluginRoot: plugin }).status, "identity-missing");
    assert.equal(previewIdentityMigration({ workspace: missing.workspace, pluginRoot: plugin, name: "Alex" }).status, "migration-ready");
    assert.equal(workspaceSnapshot(missing.workspace), before);
  });
  check("不適格名／確認拒否／取消はwrite 0", () => {
    const before = workspaceSnapshot(missing.workspace);
    assert.equal(previewIdentityMigration({ workspace: missing.workspace, pluginRoot: plugin, name: "日本語" }).status, "migration-conflict");
    assert.throws(() => applyIdentityMigration({ workspace: missing.workspace, pluginRoot: plugin, name: "Alex" }), /--confirm/u);
    assert.equal(workspaceSnapshot(missing.workspace), before);
  });
  check("identity未導入を4所有pathの1 checkpointへ移行", () => {
    writeFileSync(join(missing.workspace, "outside-unstaged.txt"), "DIRTY\n");
    writeFileSync(join(missing.workspace, "outside-staged.txt"), "STAGED\n");
    git(missing.workspace, ["add", "outside-staged.txt"]);
    writeFileSync(join(missing.workspace, "outside-untracked.txt"), "UNTRACKED\n");
    const outsideBefore = {
      unstaged: readFileSync(join(missing.workspace, "outside-unstaged.txt"), "utf8"),
      staged: git(missing.workspace, ["diff", "--cached", "--", "outside-staged.txt"]),
      untracked: readFileSync(join(missing.workspace, "outside-untracked.txt"), "utf8"),
      remote: git(missing.workspace, ["remote", "-v"]),
    };
    const result = applyIdentityMigration({
      workspace: missing.workspace, pluginRoot: plugin, name: "Alex", confirm: true,
      secretaryId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", now: "2026-08-14T01:00:00.000Z",
    });
    assert.equal(result.status, "migration-applied");
    assert.deepEqual(committedPaths(missing.workspace), [
      ".secretary/update-ledger.json", "secretary/AGENTS.md", "secretary/CLAUDE.md", "secretary/identity.json",
    ]);
    assert.equal(readFileSync(join(missing.workspace, "outside-unstaged.txt"), "utf8"), outsideBefore.unstaged);
    assert.equal(git(missing.workspace, ["diff", "--cached", "--", "outside-staged.txt"]), outsideBefore.staged);
    assert.equal(readFileSync(join(missing.workspace, "outside-untracked.txt"), "utf8"), outsideBefore.untracked);
    assert.equal(git(missing.workspace, ["remote", "-v"]), outsideBefore.remote);
    assert.equal(diagnoseIdentityMigration({ workspace: missing.workspace, pluginRoot: plugin }).status, "migration-current");
  });
  check("成功後rerunは差分／追加commit 0", () => {
    const before = workspaceSnapshot(missing.workspace);
    const head = git(missing.workspace, ["rev-parse", "HEAD"]);
    assert.equal(applyIdentityMigration({ workspace: missing.workspace, pluginRoot: plugin, confirm: true }).status, "migration-current");
    assert.equal(git(missing.workspace, ["rev-parse", "HEAD"]), head);
    assert.equal(workspaceSnapshot(missing.workspace), before);
  });

  const identityOnly = seed("identity-only", { identityAfterCommit: true, crlf: true });
  check("0.10.0 name Skill相当identity-onlyをstable identity保持で移行", () => {
    const home = join(temporary, "synthetic-home"); mkdirSync(join(home, ".codex"), { recursive: true });
    writeFileSync(join(home, ".codex/AGENTS.md"), "HOME-UNCHANGED\n");
    const homeBefore = walk(home);
    const idBefore = readFileSync(join(identityOnly.workspace, "secretary/identity.json"));
    const createdBefore = JSON.parse(idBefore).created_at;
    const result = applyIdentityMigration({ workspace: identityOnly.workspace, pluginRoot: plugin, confirm: true });
    assert.equal(result.status, "migration-applied");
    assert.ok(readFileSync(join(identityOnly.workspace, "secretary/identity.json")).equals(idBefore));
    assert.equal(JSON.parse(readFileSync(join(identityOnly.workspace, "secretary/identity.json"))).created_at, createdBefore);
    assert.deepEqual(walk(home), homeBefore);
    assert.ok(committedPaths(identityOnly.workspace).includes("secretary/identity.json"));
    for (const rel of ["secretary/AGENTS.md", "secretary/CLAUDE.md"]) {
      const bytes = readFileSync(join(identityOnly.workspace, rel));
      assert.equal(lstatSync(join(identityOnly.workspace, rel)).mode & 0o777, 0o640);
      assert.doesNotMatch(bytes.toString("utf8"), /(^|[^\r])\n/u);
      assert.match(bytes.toString("utf8"), /USER-FREE-TEXT|CLAUDE-USER-FREE-TEXT/u);
    }
    assert.match(readFileSync(join(identityOnly.workspace, "secretary/AGENTS.md"), "utf8"), /OTHER-MANAGED/u);
  });

  const legacy010 = seed("legacy-010", { templateVersion: "v0.10.0", identityBeforeCommit: true });
  check("0.10.0 markerなしidentity節を限定移行", () => {
    const beforeUser = "USER-FREE-TEXT";
    assert.equal(previewIdentityMigration({ workspace: legacy010.workspace, pluginRoot: plugin }).status, "migration-ready");
    applyIdentityMigration({ workspace: legacy010.workspace, pluginRoot: plugin, confirm: true });
    const agents = readFileSync(join(legacy010.workspace, "secretary/AGENTS.md"), "utf8");
    assert.equal(agents.split(IDENTITY_BLOCK_START).length - 1, 1);
    assert.match(agents, new RegExp(beforeUser, "u"));
  });

  const current = seed("current-new-install", { currentTemplate: true, identityBeforeCommit: true });
  check("0.10.1新規導入相当はmigration-current", () => {
    const before = workspaceSnapshot(current.workspace);
    assert.equal(diagnoseIdentityMigration({ workspace: current.workspace, pluginRoot: plugin }).status, "migration-current");
    assert.equal(applyIdentityMigration({ workspace: current.workspace, pluginRoot: plugin, confirm: true }).status, "migration-current");
    assert.equal(workspaceSnapshot(current.workspace), before);
  });
  check("0.10.1 managed identityはrename後もAGENTS／CLAUDE／ledgerがcurrent", () => {
    const preview = previewRename({ secretaryRoot: join(current.workspace, "secretary"), newName: "Taylor" });
    assert.deepEqual(preview.checkpoint.ownedPaths.sort(), ["secretary/AGENTS.md", "secretary/CLAUDE.md", "secretary/identity.json"]);
    const renamed = applyRename({ secretaryRoot: join(current.workspace, "secretary"), newName: "Taylor", confirm: true, confirmedClasses: ["current-config"] });
    assert.equal(renamed.status, "renamed");
    assert.match(readFileSync(join(current.workspace, "secretary/AGENTS.md"), "utf8"), /表示名: Taylor \(AI Secretary\)/u);
    assert.match(readFileSync(join(current.workspace, "secretary/CLAUDE.md"), "utf8"), /表示名: Taylor \(AI Secretary\)/u);
    assert.equal(diagnoseIdentityMigration({ workspace: current.workspace, pluginRoot: plugin }).status, "migration-current");
  });

  for (const failure of ["before-write-1", "before-write-2", "before-write-3", "before-write-4", "ledger", "consistency", "stage", "commit", "post-commit"]) {
    check(`failure ${failure}はworkspace／Gitを完全rollback`, () => {
      const item = seed(`failure-${failure}`);
      expectRollback(item.workspace, () => applyIdentityMigration({
        workspace: item.workspace, pluginRoot: plugin, name: "Taylor", confirm: true,
        secretaryId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", now: "2026-08-14T02:00:00.000Z", failAt: failure,
      }));
    });
  }
  check("failure後retryは1 checkpointで成功", () => {
    const item = seed("retry");
    expectRollback(item.workspace, () => applyIdentityMigration({ workspace: item.workspace, pluginRoot: plugin, name: "Robin", confirm: true, failAt: "commit" }));
    const beforeHead = git(item.workspace, ["rev-parse", "HEAD"]).trim();
    const result = applyIdentityMigration({ workspace: item.workspace, pluginRoot: plugin, name: "Robin", confirm: true });
    assert.equal(result.status, "migration-applied");
    assert.notEqual(git(item.workspace, ["rev-parse", "HEAD"]).trim(), beforeHead);
  });

  check("marker重複／利用者編集衝突／ledger重複はwrite 0停止", () => {
    for (const kind of ["marker", "managed-edit", "ledger"]) {
      const item = seed(`conflict-${kind}`, { currentTemplate: true, identityBeforeCommit: true });
      if (kind === "marker") writeFileSync(join(item.workspace, "secretary/AGENTS.md"), `${readFileSync(join(item.workspace, "secretary/AGENTS.md"), "utf8")}\n${IDENTITY_BLOCK_START}\n`);
      if (kind === "managed-edit") writeFileSync(join(item.workspace, "secretary/AGENTS.md"), readFileSync(join(item.workspace, "secretary/AGENTS.md"), "utf8").replace("(AI Secretary)", "(USER EDIT)"));
      if (kind === "ledger") {
        const path = join(item.workspace, ".secretary/update-ledger.json"); const ledger = JSON.parse(readFileSync(path));
        ledger.records.push({ ...ledger.records.find((record) => record.path === "secretary/AGENTS.md") }); json(path, ledger);
      }
      git(item.workspace, ["add", "."]); git(item.workspace, ["commit", "-qm", `conflict ${kind}`]);
      const before = workspaceSnapshot(item.workspace);
      assert.equal(diagnoseIdentityMigration({ workspace: item.workspace, pluginRoot: plugin }).status, "migration-conflict");
      assert.equal(workspaceSnapshot(item.workspace), before);
    }
  });

  check("edition不一致／symlink／read-onlyは副作用0停止", () => {
    const opposite = seed("opposite");
    json(join(opposite.workspace, ".secretary/workspace-edition.json"), { schemaVersion: 1, edition: "agentic-secretary" });
    const oppositeLedger = JSON.parse(readFileSync(join(opposite.workspace, ".secretary/update-ledger.json"))); oppositeLedger.edition = "agentic-secretary";
    json(join(opposite.workspace, ".secretary/update-ledger.json"), oppositeLedger); git(opposite.workspace, ["add", "."]); git(opposite.workspace, ["commit", "-qm", "opposite"]);
    assert.equal(diagnoseIdentityMigration({ workspace: opposite.workspace, pluginRoot: plugin }).status, "migration-conflict");

    const linked = seed("linked"); const outside = join(temporary, "outside-claude.md"); writeFileSync(outside, "OUTSIDE\n");
    rmSync(join(linked.workspace, "secretary/CLAUDE.md")); symlinkSync(outside, join(linked.workspace, "secretary/CLAUDE.md"));
    assert.equal(diagnoseIdentityMigration({ workspace: linked.workspace, pluginRoot: plugin }).status, "migration-conflict");
    assert.equal(readFileSync(outside, "utf8"), "OUTSIDE\n");

    const readOnly = seed("read-only"); chmodSync(join(readOnly.workspace, "secretary/AGENTS.md"), 0o444);
    assert.equal(diagnoseIdentityMigration({ workspace: readOnly.workspace, pluginRoot: plugin }).status, "migration-conflict");
    chmodSync(join(readOnly.workspace, "secretary/AGENTS.md"), 0o644);
  });

  check("target dirty／別Git root／Git-freeはwrite 0停止", () => {
    const dirty = seed("target-dirty"); writeFileSync(join(dirty.workspace, "secretary/AGENTS.md"), `${readFileSync(join(dirty.workspace, "secretary/AGENTS.md"), "utf8")}DIRTY\n`);
    const dirtyBefore = workspaceSnapshot(dirty.workspace);
    assert.equal(diagnoseIdentityMigration({ workspace: dirty.workspace, pluginRoot: plugin }).status, "migration-conflict");
    assert.equal(workspaceSnapshot(dirty.workspace), dirtyBefore);

    const parent = join(temporary, "parent-repo"); mkdirSync(parent); git(parent, ["init", "-q"]); git(parent, ["config", "user.name", "Synthetic"]); git(parent, ["config", "user.email", "synthetic@example.invalid"]);
    const nestedSource = seed("nested-source"); const nested = join(parent, "nested"); cpSync(nestedSource.workspace, nested, { recursive: true, filter: (source) => !source.includes(`${join(nestedSource.workspace, ".git")}`) });
    git(parent, ["add", "."]); git(parent, ["commit", "-qm", "parent"]);
    assert.equal(diagnoseIdentityMigration({ workspace: nested, pluginRoot: plugin }).status, "migration-conflict");

    const gitFree = seed("git-free"); rmSync(join(gitFree.workspace, ".git"), { recursive: true, force: true });
    const before = JSON.stringify(walk(gitFree.workspace));
    assert.equal(diagnoseIdentityMigration({ workspace: gitFree.workspace, pluginRoot: plugin }).status, "migration-conflict");
    assert.equal(JSON.stringify(walk(gitFree.workspace)), before);
  });

  check("unknown failure pointは書込み前に拒否", () => {
    const item = seed("unknown-failure"); const before = workspaceSnapshot(item.workspace);
    assert.throws(() => applyIdentityMigration({ workspace: item.workspace, pluginRoot: plugin, name: "Alex", confirm: true, failAt: "unknown" }), /未知/u);
    assert.equal(workspaceSnapshot(item.workspace), before);
  });
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

process.stdout.write(`SPRINT039_PATCH001_MIGRATION_PASS=${pass} FAIL=${fail}\n`);
if (fail) process.exitCode = 1;
