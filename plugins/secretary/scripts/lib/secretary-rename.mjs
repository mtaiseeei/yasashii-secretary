import { createHash, randomUUID } from "node:crypto";
import {
  existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync,
} from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { identityPath, readIdentity, renamedIdentity } from "./secretary-identity.mjs";
import {
  composeManagedBlock, inspectManagedRoutingBlock, inspectUserScopeRouting,
} from "./user-scope-routing.mjs";

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

export function previewRename({ secretaryRoot, newName, home = null } = {}) {
  const root = resolve(secretaryRoot);
  if (!existsSync(root) || lstatSync(root).isSymbolicLink() || !lstatSync(root).isDirectory()) throw new Error("secretary directoryを安全に確認できません。");
  const identity = readIdentity(root);
  const nextIdentity = renamedIdentity(identity, newName);
  const pattern = namePattern(identity.display_name);
  const matches = [];
  for (const path of walk(root)) {
    const content = readFileSync(path, "utf8");
    const count = [...content.matchAll(pattern)].length;
    if (!count) continue;
    const rel = relative(root, path).split(sep).join("/");
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
      const count = [...managed.content.matchAll(pattern)].length;
      if (count) matches.push({ classification: "current-config", path: target.path, count, recommended: recommendation("current-config"), scope: "user" });
    }
  }
  const counts = Object.fromEntries(["current-config", "user-content", "historical-author", "unknown-or-conflict"].map((kind) => [kind, matches.filter((item) => item.classification === kind).reduce((sum, item) => sum + item.count, 0)]));
  return {
    status: "preview",
    readOnly: true,
    oldName: identity.display_name,
    newName: nextIdentity.display_name,
    secretary_id: identity.secretary_id,
    counts,
    matches,
    nonTargets: ["Git履歴", "historical-author", "unknown-or-conflict", "選択されていないuser-content"],
    rollback: "identity、現行設定、選択済み本文を開始前snapshotへ戻します。",
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
  const root = resolve(secretaryRoot);
  const preview = previewRename({ secretaryRoot: root, newName, home });
  const identity = readIdentity(root);
  const nextIdentity = renamedIdentity(identity, newName);
  const availableB = new Set(preview.matches.filter((item) => item.classification === "user-content").map((item) => item.path));
  if (selectedUserContent.length && !confirmedClasses.includes("user-content")) throw new Error("user-content変更の分類確認がありません。");
  if (selectedUserContent.some((path) => !availableB.has(path))) throw new Error("previewにないuser-contentは変更できません。");

  const targets = new Map();
  const idPath = identityPath(root);
  targets.set(idPath, `${JSON.stringify(nextIdentity, null, 2)}\n`);
  const agentsPath = join(root, "AGENTS.md");
  if (existsSync(agentsPath)) {
    const before = readFileSync(agentsPath, "utf8");
    const inspected = inspectAgentsIdentity(before, identity.display_name, nextIdentity.display_name);
    if (inspected.content !== before) targets.set(agentsPath, inspected.content);
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

  const states = new Map([...targets.keys()].map((path) => [path, snapshot(path)]));
  try {
    let index = 0;
    for (const [path, content] of targets) {
      index += 1;
      const bytes = Buffer.from(content);
      if (states.get(path).present && digest(states.get(path).bytes) === digest(bytes)) continue;
      if (failAt === `before-write-${index}`) throw new Error("テスト用のrename部分書込み失敗");
      atomicReplace(path, bytes, states.get(path).mode);
    }
    return {
      status: "renamed",
      secretary_id: nextIdentity.secretary_id,
      oldName: identity.display_name,
      newName: nextIdentity.display_name,
      aliases: nextIdentity.aliases,
      updated: [...targets.keys()],
      preservedHistorical: preview.counts["historical-author"],
      unchangedUnknown: preview.counts["unknown-or-conflict"],
    };
  } catch (error) {
    for (const [path, state] of [...states.entries()].reverse()) restore(path, state);
    throw error;
  }
}
