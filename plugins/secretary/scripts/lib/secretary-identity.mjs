import { randomUUID } from "node:crypto";
import {
  existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

export const ACTOR_TYPE = "ai-secretary";
export const IDENTITY_SCHEMA_VERSION = 1;
const GENERIC = new Set(["assistant", "bot", "chatbot", "secretary", "ai", "agent", "claude", "codex", "chatgpt"]);
const SUGGESTIONS = Object.freeze([
  { name: "Alex", reason: "短く、英語でも日本語でも呼びかけやすい名前です。" },
  { name: "Morgan", reason: "落ち着いた印象で、役割名や取引先名と区別しやすい名前です。" },
  { name: "Taylor", reason: "短く覚えやすく、文章の中でも見分けやすい名前です。" },
  { name: "Robin", reason: "親しみやすく、発音しやすい名前です。" },
]);

function plainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function foldName(value) {
  return String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

export function validateSecretaryName(value) {
  const normalized = String(value ?? "").normalize("NFKC").trim();
  if (!normalized) return { accepted: false, reason: "empty", normalized };
  if ([...normalized].length > 32) return { accepted: false, reason: "too-long", normalized };
  if (/\p{Cc}|\p{Cf}/u.test(normalized)) return { accepted: false, reason: "control-character", normalized };
  if (/[@/\\`$]|(?:^|\s)(?:sudo|rm|git|node|python|curl)(?:\s|$)/iu.test(normalized)) {
    return { accepted: false, reason: "email-path-or-command", normalized };
  }
  if (!/^[A-Z][A-Za-z]*(?:['-][A-Za-z]+)?$/u.test(normalized)) {
    return { accepted: false, reason: "not-english-name", normalized };
  }
  if (GENERIC.has(foldName(normalized))) return { accepted: false, reason: "generic-bot-name", normalized };
  return { accepted: true, reason: null, normalized };
}

export function suggestSecretaryName({ seed = "default", excluded = [] } = {}) {
  const blocked = new Set(excluded.map(foldName));
  const available = SUGGESTIONS.filter(({ name }) => !blocked.has(foldName(name)));
  if (!available.length) throw new Error("提案できる英語名がありません。希望の名前を指定してください。");
  let hash = 0;
  for (const character of String(seed)) hash = ((hash * 31) + character.codePointAt(0)) >>> 0;
  return available[hash % available.length];
}

export function createIdentity({ displayName, secretaryId = randomUUID(), aliases = [], createdAt = new Date().toISOString() } = {}) {
  const validated = validateSecretaryName(displayName);
  if (!validated.accepted) throw new Error(`秘書名を保存できません: ${validated.reason}`);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(secretaryId)) {
    throw new Error("secretary_idがUUIDではないため停止しました。");
  }
  const normalizedAliases = [];
  const seen = new Set([foldName(validated.normalized)]);
  for (const alias of aliases) {
    const checked = validateSecretaryName(alias);
    if (!checked.accepted) throw new Error(`aliasを保存できません: ${checked.reason}`);
    const key = foldName(checked.normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    normalizedAliases.push(checked.normalized);
  }
  return {
    schemaVersion: IDENTITY_SCHEMA_VERSION,
    secretary_id: secretaryId,
    actor_type: ACTOR_TYPE,
    display_name: validated.normalized,
    aliases: normalizedAliases,
    created_at: String(createdAt),
  };
}

export function parseIdentity(value) {
  if (!plainObject(value) || Object.keys(value).sort().join(",") !== "actor_type,aliases,created_at,display_name,schemaVersion,secretary_id") {
    throw new Error("秘書identityのschemaが不明です。");
  }
  if (value.schemaVersion !== IDENTITY_SCHEMA_VERSION || value.actor_type !== ACTOR_TYPE || !Array.isArray(value.aliases)) {
    throw new Error("秘書identityのversionまたはAI種別が不正です。");
  }
  return createIdentity({
    displayName: value.display_name,
    secretaryId: value.secretary_id,
    aliases: value.aliases,
    createdAt: value.created_at,
  });
}

export function identityPath(secretaryRoot) {
  return join(resolve(secretaryRoot), "identity.json");
}

export function readIdentity(secretaryRoot) {
  const path = identityPath(secretaryRoot);
  if (!existsSync(path)) throw new Error("secretary/identity.jsonが見つかりません。name Skillで初期設定してください。");
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("secretary/identity.jsonが通常fileではないため停止しました。");
  return parseIdentity(JSON.parse(readFileSync(path, "utf8")));
}

function assertSecretaryRoot(secretaryRoot) {
  const root = resolve(secretaryRoot);
  if (!existsSync(root) || lstatSync(root).isSymbolicLink() || !lstatSync(root).isDirectory()) {
    throw new Error("secretary directoryを安全に確認できません。");
  }
  const required = ["AGENTS.md", join("memory", "MEMORY.md")];
  for (const rel of required) {
    const path = join(root, rel);
    if (!existsSync(path) || lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile()) {
      throw new Error(`必要な秘書正本が見つかりません: ${rel}`);
    }
    const check = relative(root, path);
    if (!check || check === ".." || check.startsWith(`..${sep}`)) throw new Error("秘書正本がworkspace外です。");
  }
  return root;
}

export function atomicWriteFile(path, bytes, { mode = 0o600, failAt = null } = {}) {
  const target = resolve(path);
  const parent = dirname(target);
  mkdirSync(parent, { recursive: true });
  const temp = join(parent, `.${target.split(sep).at(-1)}.tmp-${process.pid}-${randomUUID()}`);
  try {
    writeFileSync(temp, bytes, { mode, flag: "wx" });
    if (failAt === "before-rename") throw new Error("テスト用のatomic write失敗");
    renameSync(temp, target);
  } finally {
    rmSync(temp, { force: true });
  }
}

export function writeNewIdentity(secretaryRoot, { displayName, secretaryId, now, confirm = false } = {}) {
  if (!confirm) throw new Error("確認前のため秘書名を保存しませんでした。--confirm が必要です。");
  const root = assertSecretaryRoot(secretaryRoot);
  const path = identityPath(root);
  if (existsSync(path)) {
    const current = readIdentity(root);
    if (foldName(current.display_name) === foldName(displayName)) return { status: "unchanged", identity: current, path };
    throw new Error("既存identityがあります。変更はrename previewから行ってください。");
  }
  const identity = createIdentity({ displayName, secretaryId, createdAt: now || new Date().toISOString() });
  atomicWriteFile(path, `${JSON.stringify(identity, null, 2)}\n`);
  return { status: "created", identity, path };
}

export function authorMetadata(identity) {
  const parsed = parseIdentity(identity);
  return {
    author: `${parsed.display_name} (AI Secretary)`,
    author_id: parsed.secretary_id,
    author_type: parsed.actor_type,
  };
}

export function renamedIdentity(identity, newName) {
  const current = parseIdentity(identity);
  const checked = validateSecretaryName(newName);
  if (!checked.accepted) throw new Error(`新しい秘書名を保存できません: ${checked.reason}`);
  if (foldName(current.display_name) === foldName(checked.normalized)) throw new Error("現在と同じ名前です。変更はありません。");
  if (current.aliases.some((alias) => foldName(alias) === foldName(checked.normalized))) {
    throw new Error("新しい名前が過去のaliasと衝突しています。");
  }
  return createIdentity({
    displayName: checked.normalized,
    secretaryId: current.secretary_id,
    aliases: [...current.aliases, current.display_name],
    createdAt: current.created_at,
  });
}
