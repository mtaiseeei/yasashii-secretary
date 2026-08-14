import { randomUUID } from "node:crypto";
import {
  existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { readIdentity } from "./secretary-identity.mjs";

export const REGISTRY_SCHEMA_VERSION = 1;
export const REGISTRY_RELATIVE_PATH = join(".agentic-secretary", "workspaces.json");
const ALLOWED_ENTRY_KEYS = "canonical_workspace,edition,secretary_id";

function inside(root, target) {
  const rel = relative(root, target);
  return rel && rel !== ".." && !rel.startsWith(`..${sep}`);
}

function assertHome(homeValue) {
  const home = resolve(String(homeValue || ""));
  if (!existsSync(home) || lstatSync(home).isSymbolicLink() || !lstatSync(home).isDirectory()) throw new Error("user homeを安全に確認できません。");
  return home;
}

export function registryPath(homeValue) {
  return join(assertHome(homeValue), REGISTRY_RELATIVE_PATH);
}

function parseRegistry(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).sort().join(",") !== "schemaVersion,workspaces"
    || value.schemaVersion !== REGISTRY_SCHEMA_VERSION || !Array.isArray(value.workspaces)) {
    throw new Error("workspace registryのschemaが不明です。");
  }
  const workspaces = value.workspaces.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry) || Object.keys(entry).sort().join(",") !== ALLOWED_ENTRY_KEYS) {
      throw new Error("workspace registryに許可されていないmetadataがあります。");
    }
    if (!/^[0-9a-f-]{36}$/iu.test(entry.secretary_id) || !["agentic-secretary", "yasashii-secretary"].includes(entry.edition)
      || typeof entry.canonical_workspace !== "string" || !entry.canonical_workspace) {
      throw new Error("workspace registry entryが不正です。");
    }
    return { ...entry };
  });
  return { schemaVersion: REGISTRY_SCHEMA_VERSION, workspaces };
}

export function readRegistry(homeValue) {
  const path = registryPath(homeValue);
  if (!existsSync(path)) return { schemaVersion: REGISTRY_SCHEMA_VERSION, workspaces: [] };
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("workspace registryが通常fileではありません。");
  return parseRegistry(JSON.parse(readFileSync(path, "utf8")));
}

function readEditionMarker(workspace) {
  const path = join(workspace, ".secretary", "workspace-edition.json");
  if (!existsSync(path) || lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile()) throw new Error("workspace edition markerが見つかりません。");
  const value = JSON.parse(readFileSync(path, "utf8"));
  if (!value || Object.keys(value).sort().join(",") !== "edition,schemaVersion" || value.schemaVersion !== 1
    || !["agentic-secretary", "yasashii-secretary"].includes(value.edition)) throw new Error("workspace edition markerが不正です。");
  return value.edition;
}

export function inspectCanonicalWorkspace(workspaceValue, { expectedEdition = null, expectedSecretaryId = null } = {}) {
  const input = resolve(String(workspaceValue || ""));
  if (!existsSync(input)) return { status: "missing", workspace: input };
  if (lstatSync(input).isSymbolicLink() || !lstatSync(input).isDirectory()) return { status: "unsafe-workspace", workspace: input };
  const workspace = realpathSync(input);
  try {
    const edition = readEditionMarker(workspace);
    if (expectedEdition && edition !== expectedEdition) return { status: "opposite-edition", workspace, edition, expectedEdition };
    const secretary = join(workspace, "secretary");
    const identity = readIdentity(secretary);
    if (expectedSecretaryId && identity.secretary_id !== expectedSecretaryId) return { status: "identity-mismatch", workspace, edition };
    for (const rel of [join("secretary", "AGENTS.md"), join("secretary", "memory", "MEMORY.md")]) {
      const path = join(workspace, rel);
      if (!existsSync(path) || lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile()) return { status: "missing-canonical-file", workspace, edition, missing: rel };
      if (!inside(workspace, realpathSync(path))) return { status: "unsafe-canonical-file", workspace, edition, path: rel };
    }
    return { status: "valid", workspace, edition, identity };
  } catch (error) {
    return { status: "invalid", workspace, reason: error instanceof Error ? error.message : String(error) };
  }
}

function atomicRegistryWrite(path, registry, failAt = null) {
  const parent = dirname(path);
  const parentExisted = existsSync(parent);
  if (existsSync(parent) && (lstatSync(parent).isSymbolicLink() || !lstatSync(parent).isDirectory())) throw new Error("registry directoryを安全に確認できません。");
  mkdirSync(parent, { recursive: true });
  const temp = join(parent, `.workspaces.tmp-${process.pid}-${randomUUID()}`);
  try {
    writeFileSync(temp, `${JSON.stringify(registry, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    if (failAt === "before-rename") throw new Error("テスト用のregistry書込み失敗");
    renameSync(temp, path);
  } finally {
    rmSync(temp, { force: true });
    if (!parentExisted && existsSync(parent) && !existsSync(path)) rmSync(parent);
  }
}

export function registerWorkspace({ home, workspace, edition, confirm = false, failAt = null } = {}) {
  if (!confirm) throw new Error("canonical workspace登録は明示確認前のため変更しません。--confirm が必要です。");
  const inspected = inspectCanonicalWorkspace(workspace, { expectedEdition: edition });
  if (inspected.status !== "valid") throw new Error(`canonical workspaceを登録できません: ${inspected.status}`);
  const registry = readRegistry(home);
  const sameId = registry.workspaces.filter((entry) => entry.secretary_id === inspected.identity.secretary_id);
  if (sameId.length > 1) throw new Error("同じsecretary_idのregistry entryが重複しているため停止しました。");
  const otherLive = registry.workspaces.filter((entry) => entry.secretary_id !== inspected.identity.secretary_id)
    .filter((entry) => inspectCanonicalWorkspace(entry.canonical_workspace, { expectedEdition: entry.edition, expectedSecretaryId: entry.secretary_id }).status === "valid");
  if (otherLive.length) throw new Error("複数active秘書が見つかったため自動登録しません。");
  const entry = { secretary_id: inspected.identity.secretary_id, edition: inspected.edition, canonical_workspace: inspected.workspace };
  let next;
  if (sameId.length === 1) {
    const index = registry.workspaces.findIndex((item) => item.secretary_id === entry.secretary_id);
    next = { ...registry, workspaces: registry.workspaces.map((item, itemIndex) => itemIndex === index ? entry : item) };
  } else next = { ...registry, workspaces: [...registry.workspaces, entry] };
  const before = JSON.stringify(registry);
  const after = JSON.stringify(next);
  if (before === after) return { status: "unchanged", entry };
  atomicRegistryWrite(registryPath(home), next, failAt);
  return { status: sameId.length ? "moved" : "registered", entry };
}

export function resolveCanonicalWorkspace({ home, edition = null } = {}) {
  const registry = readRegistry(home);
  const entries = edition ? registry.workspaces.filter((entry) => entry.edition === edition) : registry.workspaces;
  if (!entries.length) return { status: "registry-missing", sideEffects: 0 };
  if (entries.length !== 1) return { status: "duplicate", sideEffects: 0, candidates: entries.length };
  const entry = entries[0];
  const inspected = inspectCanonicalWorkspace(entry.canonical_workspace, { expectedEdition: entry.edition, expectedSecretaryId: entry.secretary_id });
  if (inspected.status !== "valid") return { status: inspected.status, sideEffects: 0, entry };
  if (edition && inspected.edition !== edition) return { status: "opposite-edition", sideEffects: 0 };
  return { status: "resolved", sideEffects: 0, workspace: inspected.workspace, secretaryRoot: join(inspected.workspace, "secretary"), identity: inspected.identity, edition: inspected.edition };
}

export function registryContainsOnlyAllowedMetadata(registry) {
  try { parseRegistry(registry); return true; } catch { return false; }
}
