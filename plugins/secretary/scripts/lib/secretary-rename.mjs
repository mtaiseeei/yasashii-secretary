import { createHash, randomUUID } from "node:crypto";
import {
  existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync,
} from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { foldName, identityPath, readIdentity, renamedIdentity } from "./secretary-identity.mjs";
import { updateIdentityManagedSection } from "./secretary-identity-migration.mjs";
import { commitOwnedChanges, inspectOwnedCheckpoint, restoreOwnedCommit } from "./safe-git.mjs";
import {
  composeManagedBlock, inspectManagedRoutingBlock, inspectUserScopeRouting,
} from "./user-scope-routing.mjs";
import { inspectCanonicalWorkspace } from "./workspace-registry.mjs";

const TEXT_EXTENSIONS = new Set([".md", ".txt", ".json", ".yaml", ".yml", ".toml"]);

function digest(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"); }
function namePattern(name) { return new RegExp(`(?<![A-Za-z])${escapeRegExp(name)}(?![A-Za-z])`, "gu"); }

function agentsIdentityPattern(name) {
  return new RegExp(`^([ \\t]*-[ \\t]*(?:表示名|display)[ \\t]*:[ \\t]*)${escapeRegExp(name)}([ \\t]+\\(AI Secretary\\)[ \\t]*)(\\r?)$`, "gimu");
}

function inspectAgentsIdentity(content, oldName, newName = oldName) {
  const pattern = agentsIdentityPattern(oldName);
  let ownedCount = 0;
  const updated = content.replace(pattern, (_match, prefix, suffix, carriageReturn) => {
    ownedCount += 1;
    return `${prefix}${newName}${suffix}${carriageReturn}`;
  });
  const totalCount = [...content.matchAll(namePattern(oldName))].length;
  return { content: updated, ownedCount, unownedCount: Math.max(0, totalCount - ownedCount) };
}

function walk(root, current = root, rows = []) {
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const path = join(current, entry.name);
    if (entry.isDirectory()) walk(root, path, rows);
    else if (entry.isFile() && TEXT_EXTENSIONS.has(extname(entry.name).toLowerCase())) rows.push(path);
  }
  return rows;
}

function classification(relativePath) {
  if (relativePath === "identity.json") return "current-config";
  if (/^(?:docs|projects|inbox)\//u.test(relativePath)) return "user-content";
  if (/^memory\/(?:journal|archive|decisions)\//u.test(relativePath)) return "historical-author";
  return "unknown-or-conflict";
}

function recommendation(kind) {
  return {
    "current-config": "一体更新（必須）",
    "user-content": "fileごとの明示選択後だけ更新",
    "historical-author": "原則保持し、旧名をaliasへ追加",
    "unknown-or-conflict": "自動変更しない",
  }[kind];
}

function nextIdentityForRename(identity, newName) {
  return foldName(identity.display_name) === foldName(newName) ? identity : renamedIdentity(identity, newName);
}

function canonicalWorkspace(root) {
  const workspace = dirname(root);
  const inspected = inspectCanonicalWorkspace(workspace);
  if (inspected.status !== "valid") throw new Error(`canonical workspaceを確認できません: ${inspected.status}`);
  if (resolve(join(inspected.workspace, "secretary")) !== root) throw new Error("secretary pathがcanonical workspaceの正確なrootを指していません。");
  return inspected;
}

function workspaceRelativePaths(workspace, paths) {
  return paths.map((path) => relative(workspace, path).split(sep).join("/"));
}

function checkpointSummary(inspected, gitState) {
  return {
    status: gitState.ownedPaths.length ? "required" : "not-applicable",
    reason: gitState.ownedPaths.length ? "workspace所有fileが変更対象です。" : "workspace変更0件です。",
    workspaceRoot: inspected.workspace,
    gitTopLevel: gitState.topLevel,
    edition: inspected.edition,
    ownedPaths: gitState.ownedPaths,
    push: "not-run",
  };
}

export function previewRename({ secretaryRoot, newName, home = null } = {}) {
  const requestedRoot = resolve(secretaryRoot);
  if (!existsSync(requestedRoot) || lstatSync(requestedRoot).isSymbolicLink() || !lstatSync(requestedRoot).isDirectory()) throw new Error("secretary directoryを安全に確認できません。");
  const root = realpathSync(requestedRoot);
  const identity = readIdentity(root);
  const nextIdentity = nextIdentityForRename(identity, newName);
  const sameName = foldName(identity.display_name) === foldName(nextIdentity.display_name);
  const pattern = namePattern(identity.display_name);
  const matches = [];
  for (const path of sameName ? [] : walk(root)) {
    const content = readFileSync(path, "utf8");
    const count = [...content.matchAll(pattern)].length;
    if (!count) continue;
    const rel = relative(root, path).split(sep).join("/");
    if (["AGENTS.md", "CLAUDE.md"].includes(rel)) {
      const managed = updateIdentityManagedSection(content, {
        kind: rel === "AGENTS.md" ? "agents" : "claude",
        currentIdentity: identity,
        nextIdentity,
      });
      if (managed.status !== "missing") {
        const ownedNameCount = [...content.slice(content.indexOf("<!-- secretary:workspace-identity:v1:start -->"), content.indexOf("<!-- secretary:workspace-identity:v1:end -->") + "<!-- secretary:workspace-identity:v1:end -->".length).matchAll(pattern)].length;
        if (managed.content !== content) matches.push({
          classification: "current-config", path: rel, count: Math.max(1, ownedNameCount),
          recommended: recommendation("current-config"), ownedField: "identity-managed-section",
        });
        const total = [...content.matchAll(pattern)].length;
        if (total > ownedNameCount) matches.push({
          classification: "unknown-or-conflict", path: rel, count: total - ownedNameCount,
          recommended: recommendation("unknown-or-conflict"), ownedField: null,
        });
        continue;
      }
    }
    if (rel === "AGENTS.md") {
      const inspected = inspectAgentsIdentity(content, identity.display_name);
      if (inspected.ownedCount) matches.push({
        classification: "current-config", path: rel, count: inspected.ownedCount,
        recommended: recommendation("current-config"), ownedField: "display-name",
      });
      if (inspected.unownedCount) matches.push({
        classification: "unknown-or-conflict", path: rel, count: inspected.unownedCount,
        recommended: recommendation("unknown-or-conflict"), ownedField: null,
      });
      continue;
    }
    const kind = classification(rel);
    matches.push({ classification: kind, path: rel, count, recommended: recommendation(kind) });
  }
  if (home) {
    for (const target of inspectUserScopeRouting({ home })) {
      if (!target.enabled) continue;
      const content = readFileSync(target.path, "utf8");
      const managed = inspectManagedRoutingBlock(content);
      const composed = composeManagedBlock(content, nextIdentity, { operation: "enable" });
      const count = [...managed.content.matchAll(pattern)].length;
      if (composed.content !== content) matches.push({ classification: "current-config", path: target.path, count: Math.max(1, count), recommended: recommendation("current-config"), scope: "user" });
    }
  }
  const workspaceTargets = [];
  if (!sameName) {
    workspaceTargets.push(identityPath(root));
    for (const [rel, kind] of [["AGENTS.md", "agents"], ["CLAUDE.md", "claude"]]) {
      const guidancePath = join(root, rel);
      if (!existsSync(guidancePath)) continue;
      const before = readFileSync(guidancePath, "utf8");
      const managed = updateIdentityManagedSection(before, { kind, currentIdentity: identity, nextIdentity });
      const updated = managed.status === "missing" && rel === "AGENTS.md"
        ? inspectAgentsIdentity(before, identity.display_name, nextIdentity.display_name).content
        : managed.content;
      if (updated !== before) workspaceTargets.push(guidancePath);
    }
  }
  const inspectedWorkspace = canonicalWorkspace(root);
  const gitState = inspectOwnedCheckpoint(inspectedWorkspace.workspace, workspaceRelativePaths(inspectedWorkspace.workspace, workspaceTargets));
  const counts = Object.fromEntries(["current-config", "user-content", "historical-author", "unknown-or-conflict"].map((kind) => [kind, matches.filter((item) => item.classification === kind).reduce((sum, item) => sum + item.count, 0)]));
  return {
    status: "preview",
    readOnly: true,
    oldName: identity.display_name,
    newName: nextIdentity.display_name,
    secretary_id: identity.secretary_id,
    counts,
    matches,
    checkpoint: checkpointSummary(inspectedWorkspace, gitState),
    nonTargets: ["開始前のstage／unstaged／untracked", "remote／push／fetch／branch／tag", "Git履歴", "historical-author", "unknown-or-conflict", "選択されていないuser-content"],
    rollback: "identity、現行設定、選択済み本文、Git HEAD／index／working treeを開始前snapshotへ戻します。",
  };
}

function snapshot(path) {
  if (!existsSync(path)) return { present: false, bytes: null, mode: 0o600 };
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`通常fileではない対象は変更しません: ${path}`);
  return { present: true, bytes: readFileSync(path), mode: stat.mode };
}

function restore(path, state) {
  if (!state.present) { rmSync(path, { force: true }); return; }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, state.bytes, { mode: state.mode });
}

function atomicReplace(path, bytes, mode) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = join(dirname(path), `.${path.split(sep).at(-1)}.rename-${process.pid}-${randomUUID()}`);
  try { writeFileSync(temp, bytes, { mode, flag: "wx" }); renameSync(temp, path); }
  finally { rmSync(temp, { force: true }); }
}

function replaceExact(content, oldName, newName) {
  return content.replace(namePattern(oldName), newName);
}

export function applyRename({
  secretaryRoot, newName, home = null, confirm = false, confirmedClasses = [], selectedUserContent = [], failAt = null,
} = {}) {
  if (!confirm) throw new Error("rename applyは明示確認前のため変更しません。--confirm が必要です。");
  if (!confirmedClasses.includes("current-config")) throw new Error("current-config一体更新の確認がありません。");
  if (confirmedClasses.some((kind) => !["current-config", "user-content"].includes(kind))) throw new Error("履歴または所有不明の自動変更はできません。");
  const requestedRoot = resolve(secretaryRoot);
  if (!existsSync(requestedRoot) || lstatSync(requestedRoot).isSymbolicLink() || !lstatSync(requestedRoot).isDirectory()) throw new Error("secretary directoryを安全に確認できません。");
  const root = realpathSync(requestedRoot);
  const preview = previewRename({ secretaryRoot: root, newName, home });
  const identity = readIdentity(root);
  const nextIdentity = nextIdentityForRename(identity, newName);
  const sameName = foldName(identity.display_name) === foldName(nextIdentity.display_name);
  const availableB = new Set(preview.matches.filter((item) => item.classification === "user-content").map((item) => item.path));
  if (selectedUserContent.length && !confirmedClasses.includes("user-content")) throw new Error("user-content変更の分類確認がありません。");
  if (selectedUserContent.some((path) => !availableB.has(path))) throw new Error("previewにないuser-contentは変更できません。");

  const targets = new Map();
  const idPath = identityPath(root);
  if (!sameName) targets.set(idPath, `${JSON.stringify(nextIdentity, null, 2)}\n`);
  for (const [rel, kind] of [["AGENTS.md", "agents"], ["CLAUDE.md", "claude"]]) {
    const guidancePath = join(root, rel);
    if (!existsSync(guidancePath)) continue;
    const before = readFileSync(guidancePath, "utf8");
    const managed = updateIdentityManagedSection(before, { kind, currentIdentity: identity, nextIdentity });
    const updated = managed.status === "missing" && rel === "AGENTS.md"
      ? inspectAgentsIdentity(before, identity.display_name, nextIdentity.display_name).content
      : managed.content;
    if (updated !== before) targets.set(guidancePath, updated);
  }
  for (const rel of selectedUserContent) {
    const path = resolve(root, rel);
    const check = relative(root, path);
    if (!check || check === ".." || check.startsWith(`..${sep}`)) throw new Error("user-content対象がsecretary外です。");
    targets.set(path, replaceExact(readFileSync(path, "utf8"), identity.display_name, nextIdentity.display_name));
  }
  if (home) {
    for (const target of inspectUserScopeRouting({ home })) {
      if (!target.enabled) continue;
      const before = readFileSync(target.path, "utf8");
      const composed = composeManagedBlock(before, nextIdentity, { operation: "enable" });
      if (composed.status !== "unchanged") targets.set(target.path, composed.content);
    }
  }

  for (const [path, content] of [...targets]) {
    const before = readFileSync(path);
    if (digest(before) === digest(Buffer.from(content))) targets.delete(path);
  }

  const inspectedWorkspace = canonicalWorkspace(root);
  const workspaceTargets = [...targets.keys()].filter((path) => {
    const rel = relative(inspectedWorkspace.workspace, path);
    return rel && rel !== ".." && !rel.startsWith(`..${sep}`);
  });
  const ownedPaths = workspaceRelativePaths(inspectedWorkspace.workspace, workspaceTargets);
  const gitBefore = inspectOwnedCheckpoint(inspectedWorkspace.workspace, ownedPaths);
  const allowedFailures = new Set(["before-checkpoint", "stage", "commit", "post-commit"]);
  for (let index = 1; index <= targets.size; index += 1) allowedFailures.add(`before-write-${index}`);
  if (failAt && !allowedFailures.has(failAt)) throw new Error(`未知のrename failure pointです: ${failAt}`);
  if (failAt && ["before-checkpoint", "stage", "commit", "post-commit"].includes(failAt) && !workspaceTargets.length) {
    throw new Error(`workspace変更0件のためfailure pointへ到達できません: ${failAt}`);
  }

  const states = new Map([...targets.keys()].map((path) => [path, snapshot(path)]));
  let checkpoint = null;
  try {
    let index = 0;
    for (const [path, content] of targets) {
      index += 1;
      const bytes = Buffer.from(content);
      if (states.get(path).present && digest(states.get(path).bytes) === digest(bytes)) continue;
      if (failAt === `before-write-${index}`) throw new Error("テスト用のrename部分書込み失敗");
      atomicReplace(path, bytes, states.get(path).mode);
    }
    if (failAt === "before-checkpoint") throw new Error("テスト用のcheckpoint前失敗");
    if (workspaceTargets.length) {
      checkpoint = commitOwnedChanges({
        root: inspectedWorkspace.workspace,
        ownedPaths,
        message: "[secretary-name] Record local rename checkpoint",
        failAt: ["stage", "commit", "post-commit"].includes(failAt) ? failAt : null,
      });
      if (checkpoint.status !== "committed") throw new Error("required local checkpointを作成できませんでした。");
      const gitAfter = inspectOwnedCheckpoint(inspectedWorkspace.workspace, ownedPaths);
      if (gitAfter.head !== checkpoint.newHead || gitAfter.status !== gitBefore.status || gitAfter.staged !== gitBefore.staged
        || gitAfter.branch !== gitBefore.branch || gitAfter.remotes !== gitBefore.remotes || gitAfter.tags !== gitBefore.tags) {
        throw new Error("checkpoint後のGit状態が契約どおりではありません。");
      }
    } else {
      checkpoint = { status: "not-applicable", oldHead: gitBefore.head, newHead: null, candidates: [] };
    }
    return {
      status: targets.size ? "renamed" : "unchanged",
      secretary_id: nextIdentity.secretary_id,
      oldName: identity.display_name,
      newName: nextIdentity.display_name,
      aliases: nextIdentity.aliases,
      updated: [...targets.keys()],
      checkpoint: {
        status: checkpoint.status === "committed" ? "required-completed" : "not-applicable",
        reason: checkpoint.status === "committed" ? "workspace所有pathだけをlocal commitへ記録しました。" : "workspace変更0件のためlocal commitは作成していません。",
        commit: checkpoint.status === "committed" ? checkpoint.newHead : null,
        ownedPaths,
        push: "not-run",
      },
      preservedHistorical: preview.counts["historical-author"],
      unchangedUnknown: preview.counts["unknown-or-conflict"],
    };
  } catch (error) {
    let rollbackError = null;
    try {
      if (checkpoint?.status === "committed") {
        restoreOwnedCommit({ root: inspectedWorkspace.workspace, oldHead: checkpoint.oldHead, newHead: checkpoint.newHead, ownedPaths });
      }
      for (const [path, state] of [...states.entries()].reverse()) restore(path, state);
      const gitRestored = inspectOwnedCheckpoint(inspectedWorkspace.workspace, ownedPaths);
      if (gitRestored.head !== gitBefore.head || gitRestored.status !== gitBefore.status || gitRestored.staged !== gitBefore.staged) {
        throw new Error("Git rollback後の状態が開始前と一致しません。");
      }
    } catch (failedRollback) {
      rollbackError = failedRollback;
    }
    if (rollbackError) {
      throw new Error(`rename rollbackを完了できませんでした。確認してください: ${[...states.keys()].join(", ")} / ${inspectedWorkspace.workspace}; ${rollbackError.message}`);
    }
    throw error;
  }
}
