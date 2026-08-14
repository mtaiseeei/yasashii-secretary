import { randomUUID } from "node:crypto";
import {
  chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { parseIdentity } from "./secretary-identity.mjs";

export const ROUTING_MARKER = "agentic-secretary:name-routing:v1";
const START = `<!-- ${ROUTING_MARKER}:start -->`;
const END = `<!-- ${ROUTING_MARKER}:end -->`;

function inside(root, target) {
  const rel = relative(root, target);
  return rel && rel !== ".." && !rel.startsWith(`..${sep}`);
}

function assertSafeHome(homeValue) {
  const home = resolve(String(homeValue || ""));
  if (!existsSync(home) || lstatSync(home).isSymbolicLink() || !lstatSync(home).isDirectory()) {
    throw new Error("user homeを安全に確認できません。");
  }
  return home;
}

function assertSafeTarget(home, target) {
  if (!inside(home, target)) throw new Error("user-scope fileがhome外を指しています。");
  let cursor = home;
  for (const part of relative(home, target).split(sep)) {
    cursor = join(cursor, part);
    if (!existsSync(cursor)) continue;
    const stat = lstatSync(cursor);
    if (stat.isSymbolicLink()) throw new Error("symlink／junction経由のuser-scope変更は行いません。");
    if (cursor !== target && !stat.isDirectory()) throw new Error("user-scope fileの親がdirectoryではありません。");
  }
  if (existsSync(target)) {
    const stat = lstatSync(target);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("user-scope対象が通常fileではありません。");
    if ((stat.mode & 0o222) === 0) throw new Error("user-scope対象がread-onlyのため変更しません。");
  }
}

export function selectUserScopeTargets(homeValue, hosts = ["codex", "claude"]) {
  const home = assertSafeHome(homeValue);
  const selected = [];
  if (hosts.includes("codex")) {
    const override = join(home, ".codex", "AGENTS.override.md");
    const regular = join(home, ".codex", "AGENTS.md");
    const path = existsSync(override) ? override : regular;
    assertSafeTarget(home, path);
    selected.push({ host: "codex", path, precedence: existsSync(override) ? "override" : "regular" });
  }
  if (hosts.includes("claude")) {
    const path = join(home, ".claude", "CLAUDE.md");
    assertSafeTarget(home, path);
    selected.push({ host: "claude", path, precedence: "user-scope" });
  }
  if (hosts.some((host) => !["codex", "claude"].includes(host))) throw new Error("未対応hostが含まれています。");
  return selected;
}

function newlineOf(content) {
  return content.includes("\r\n") ? "\r\n" : "\n";
}

function occurrences(content) {
  const starts = content.split(START).length - 1;
  const ends = content.split(END).length - 1;
  if (starts !== ends || starts > 1) throw new Error("managed blockが重複または破損しているため変更しません。");
  if (!starts) return null;
  const begin = content.indexOf(START);
  const finish = content.indexOf(END, begin) + END.length;
  return { begin, finish };
}

export function inspectManagedRoutingBlock(contentValue) {
  const content = String(contentValue ?? "");
  const range = occurrences(content);
  return {
    enabled: Boolean(range),
    content: range ? content.slice(range.begin, range.finish) : "",
  };
}

export function renderRoutingBlock(identity, { newline = "\n" } = {}) {
  const parsed = parseIdentity(identity);
  return [
    START,
    "## AI Secretary name routing",
    `- Secretary identity: ${parsed.display_name} (AI Secretary); secretary_id=${parsed.secretary_id}; actor_type=${parsed.actor_type}.`,
    `- Direct requests such as \"${parsed.display_name}, ...\" or \"${parsed.display_name}に聞いて\" refer to this AI Secretary. Resolve its canonical workspace from the product registry instead of onboarding in the current repository.`,
    "- Do not route mentions about a human, customer, business partner, author, quotation, code, or file body. If the context is genuinely ambiguous, ask once before any side effect.",
    "- This block is only a routing hint. Identity and history remain in the canonical Secretary workspace. Disable it with the name Skill; do not delete identity or history.",
    END,
  ].join(newline);
}

export function composeManagedBlock(contentValue, identity, { operation = "enable" } = {}) {
  const content = String(contentValue ?? "");
  const newline = newlineOf(content);
  const range = occurrences(content);
  if (operation === "disable") {
    if (!range) return { content, status: "unchanged" };
    let next = `${content.slice(0, range.begin)}${content.slice(range.finish)}`;
    if (next.startsWith(newline)) next = next.slice(newline.length);
    if (next.endsWith(`${newline}${newline}`)) next = next.slice(0, -newline.length);
    return { content: next, status: "disabled" };
  }
  if (operation !== "enable") throw new Error("managed block operationが不正です。");
  const block = renderRoutingBlock(identity, { newline });
  if (range) {
    const next = `${content.slice(0, range.begin)}${block}${content.slice(range.finish)}`;
    return { content: next, status: next === content ? "unchanged" : "updated" };
  }
  const separator = content.length === 0 ? "" : content.endsWith(newline) ? newline : `${newline}${newline}`;
  return { content: `${content}${separator}${block}${newline}`, status: "created" };
}

function snapshot(path) {
  if (!existsSync(path)) return { present: false, bytes: null, mode: 0o600 };
  const stat = lstatSync(path);
  return { present: true, bytes: readFileSync(path), mode: stat.mode };
}

function restore(path, state) {
  if (!state.present) { rmSync(path, { force: true }); return; }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, state.bytes, { mode: state.mode });
}

function atomicReplace(path, content, mode) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = join(dirname(path), `.${path.split(sep).at(-1)}.tmp-${process.pid}-${randomUUID()}`);
  try {
    writeFileSync(temp, content, { mode, flag: "wx" });
    renameSync(temp, path);
    chmodSync(path, mode);
  } finally { rmSync(temp, { force: true }); }
}

export function updateUserScopeRouting({
  home, identity, hosts = ["codex", "claude"], operation = "enable", confirm = false, failAt = null,
} = {}) {
  if (!confirm) throw new Error("user-scope連携は明示確認前のため変更しません。--confirm が必要です。");
  const parsed = parseIdentity(identity);
  const targets = selectUserScopeTargets(home, hosts);
  const states = new Map(targets.map(({ path }) => [path, snapshot(path)]));
  const parentStates = new Map(targets.map(({ path }) => [dirname(path), existsSync(dirname(path))]));
  const plans = targets.map((target) => {
    const before = states.get(target.path).present ? states.get(target.path).bytes.toString("utf8") : "";
    return { ...target, ...composeManagedBlock(before, parsed, { operation }) };
  });
  try {
    plans.forEach((plan, index) => {
      if (plan.status === "unchanged") return;
      if (failAt === `before-write-${index + 1}`) throw new Error("テスト用のuser-scope部分書込み失敗");
      atomicReplace(plan.path, plan.content, states.get(plan.path).mode);
    });
    return { status: plans.every(({ status }) => status === "unchanged") ? "unchanged" : operation === "disable" ? "disabled" : "enabled", targets: plans.map(({ host, path, precedence, status }) => ({ host, path, precedence, status })) };
  } catch (error) {
    for (const [path, state] of [...states.entries()].reverse()) restore(path, state);
    for (const [parent, existed] of [...parentStates.entries()].reverse()) {
      if (!existed && existsSync(parent) && readdirSync(parent).length === 0) rmSync(parent);
    }
    throw error;
  }
}

export function inspectUserScopeRouting({ home, hosts = ["codex", "claude"] } = {}) {
  return selectUserScopeTargets(home, hosts).map((target) => {
    const content = existsSync(target.path) ? readFileSync(target.path, "utf8") : "";
    const range = occurrences(content);
    return { ...target, enabled: Boolean(range), managedBlocks: range ? 1 : 0 };
  });
}
