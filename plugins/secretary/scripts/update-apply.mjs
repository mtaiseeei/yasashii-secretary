#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { removeSafe, safeWritePath, workingRoot, writeFileAtomicSafe } from "./lib/safe-fs.mjs";
import { runExternalSync } from "./lib/external-ops.mjs";
import { assertWorkspaceEdition, inspectWorkspaceEdition, loadEditionConfig } from "./lib/edition-guard.mjs";

const EXIT_USAGE = 2;
const EXIT_REFUSED = 3;
const EXIT_FAILED = 4;
const SESSION_NAME = "session.json";
const SEMVER = /^\d+\.\d+\.\d+$/;
const HASH = /^sha256:[a-f0-9]{64}$/;
const ALLOWED_SCOPES = new Set(["user", "project", "local"]);
const UPDATE_HOSTS = new Set(["claude-code", "codex"]);
const ALLOWED_SELECTIONS = new Set(["keep", "replace", "diff", "cancel"]);
const ALLOWED_MANAGED_PATHS = new Set(["secretary/AGENTS.md", "secretary/CLAUDE.md"]);
const ALLOWED_LEDGER_FIELDS = new Set(["path", "installedVersion", "baselineHash", "templateVariables"]);
const ALLOWED_LEDGER_VARIABLES = new Set(["CREATED_DATE", "CREATED_AT", "REPORT_DETAIL"]);
const LEDGER_VARIABLE_FORMATS = {
  CREATED_DATE: /^\d{4}-\d{2}-\d{2}$/,
  CREATED_AT: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,
  REPORT_DETAIL: /^(?:みじかく|くわしく)$/,
};
const STATIC_LEDGER_PATHS = new Set([
  ...ALLOWED_MANAGED_PATHS,
  "secretary/memory/MEMORY.md",
  "secretary/memory/preferences.md",
  ".github/workflows/chatwork-sync.yml",
  "chatwork/config.json",
  "chatwork/rooms.json",
  "chatwork/scripts/chatwork-sync.mjs",
]);
const TEST_MODE = process.env.YASASHII_UPDATE_TEST_MODE === "fixture";
const SECRET_PATTERN = /(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|["']?(?:password|api[_-]?key|access[_-]?token|secret|credential)["']?\s*[:=]\s*["']?[^\s"']{8,})/i;

// 0.2.0公開時の未置換テンプレート。値そのものではなくhashだけを持つ。
// 個人向け置換後のAGENTS.mdは一致しないためunknown-baselineとなり、既定で保持される。
const KNOWN_020_BASELINES = new Map([
  ["secretary/AGENTS.md", "sha256:e0137cb213c35abcb4efcbcf14d45f2ead19986bd60c0436975e2d1f78e5969b"],
  ["secretary/CLAUDE.md", "sha256:3e7c5bd8dab62586b3be302e6b0019b87168adfa8b23df19793435a7cc80ef50"],
]);

function fail(message, code = EXIT_USAGE) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function updateHost(args) {
  const requested = args.values.get("--host");
  // Sprint 018以前のClaude Code呼び出しとの互換性を保つ。新しい案内は常に--hostを明示する。
  if (!requested) return "claude-code";
  if (!UPDATE_HOSTS.has(requested)) {
    fail("更新hostを確認できないため、workspace・Git・session・backup・pluginを変更せず停止しました。", EXIT_REFUSED);
  }
  return requested;
}

function requireClaudePluginUpdater(args) {
  const host = updateHost(args);
  if (host === "codex") {
    fail("CodexではClaude Code用のplugin updaterを実行しません。workspace・Git・session・backup・pluginは変更していません。CodexのPlugins Directoryまたは現在のCodex CLI plugin操作を使ってください。", EXIT_REFUSED);
  }
  return host;
}

function parseArgs(argv) {
  const parsed = { command: argv[0] ?? "start", values: new Map(), repeated: new Map(), flags: new Set() };
  const flags = new Set(["--json", "--apply", "--rollback", "--no-network"]);
  const repeatable = new Set(["--selection"]);
  const start = argv[0]?.startsWith("--") ? 0 : 1;
  if (start === 0) parsed.command = "start";
  for (let index = start; index < argv.length; index += 1) {
    const token = argv[index];
    if (flags.has(token)) {
      parsed.flags.add(token);
      continue;
    }
    if (!token.startsWith("--")) fail("未対応の引数があります。変更は行っていません。");
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) fail(`${token} の値を指定してください。`);
    if (repeatable.has(token)) {
      const values = parsed.repeated.get(token) ?? [];
      values.push(value);
      parsed.repeated.set(token, values);
    } else {
      parsed.values.set(token, value);
    }
    index += 1;
  }
  return parsed;
}

function sha256Buffer(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(path) {
  return sha256Buffer(readFileSync(path));
}

function atomicJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  renameSync(temporary, path);
}

function run(binary, args, options = {}) {
  try {
    return runExternalSync(binary, args, {
      cwd: options.cwd,
      encoding: "utf8",
      input: options.input,
      env: options.env ?? process.env,
      maxBuffer: 8 * 1024 * 1024,
      timeoutMs: Number(options.timeout || process.env.YASASHII_CLI_TIMEOUT_MS || 30_000),
      label: basename(binary),
      allowFailure: true,
    });
  } catch (error) {
    return { stdout: String(error.stdout || ""), stderr: String(error.stderr || error.message || ""), status: error.code === "timeout" ? 124 : 125, signal: error.signal || null, code: error.code };
  }
}

function git(workspace, args, options = {}) {
  return run("git", args, { ...options, cwd: workspace });
}

function safeWorkspace(value) {
  const candidate = resolve(value ?? ".");
  let workspace;
  try {
    // realpathで参照先をworkspaceとして採用する前に、入力pathの全componentを確認する。
    workspace = workingRoot(candidate);
  } catch {
    fail("workspaceを安全に読み取れないため、更新を開始しません。", EXIT_REFUSED);
  }
  const top = git(workspace, ["rev-parse", "--show-toplevel"]);
  if (top.status !== 0 || resolve(top.stdout.trim()) !== workspace) {
    fail("workspace rootのGitリポジトリで実行してください。更新は開始していません。", EXIT_REFUSED);
  }
  const gitDirectory = git(workspace, ["rev-parse", "--absolute-git-dir"]);
  if (gitDirectory.status !== 0) fail("Gitの状態を確認できないため、更新を開始しません。", EXIT_REFUSED);
  const gitDir = resolve(gitDirectory.stdout.trim());
  if (!existsSync(gitDir) || lstatSync(gitDir).isSymbolicLink()) {
    fail("Git管理領域が安全でないため、更新を開始しません。", EXIT_REFUSED);
  }
  return { workspace, gitDir };
}

function pluginName(config) {
  const [name, marketplace, ...rest] = config.distribution.pluginId.split("@");
  if (!name || !marketplace || rest.length) fail("EditionConfigのplugin IDが不正です。", EXIT_REFUSED);
  return name;
}

function safePluginRoot(value, config) {
  try {
    const root = realpathSync(resolve(value));
    const manifest = JSON.parse(readFileSync(join(root, ".claude-plugin", "plugin.json"), "utf8"));
    if (manifest.name !== pluginName(config) || !SEMVER.test(String(manifest.version ?? ""))) throw new Error("manifest");
    return { root, version: manifest.version };
  } catch {
    fail("pluginのversionを安全に確認できないため、更新を進めません。", EXIT_REFUSED);
  }
}

function inspectPluginTree(value, expectedVersion, expectedPluginName) {
  const root = realpathSync(resolve(value));
  if (!lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink()) throw new Error("plugin-root");
  const manifest = JSON.parse(readFileSync(join(root, ".claude-plugin", "plugin.json"), "utf8"));
  if (manifest.name !== expectedPluginName || !SEMVER.test(String(manifest.version ?? ""))) throw new Error("plugin-manifest");
  if (expectedVersion && manifest.version !== expectedVersion) throw new Error("plugin-version");
  const requiredSkills = ["secretary", "update"];
  if (requiredSkills.some((name) => !existsSync(join(root, "skills", name, "SKILL.md")))) throw new Error("plugin-skills");
  const entries = [];
  const walk = (directory, prefix = "") => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = join(directory, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error("plugin-symlink");
      if (entry.isDirectory()) {
        walk(absolute, rel);
      } else if (entry.isFile()) {
        const bytes = readFileSync(absolute);
        entries.push({ rel, mode: lstatSync(absolute).mode & 0o777, hash: sha256Buffer(bytes) });
      } else {
        throw new Error("plugin-special-file");
      }
    }
  };
  walk(root);
  return {
    root,
    version: manifest.version,
    fileCount: entries.length,
    treeHash: sha256Buffer(JSON.stringify(entries)),
    requiredSkills,
  };
}

function copyPluginTree(source, destination) {
  mkdirSync(destination, { recursive: false });
  const walk = (from, to) => {
    for (const entry of readdirSync(from, { withFileTypes: true })) {
      const sourcePath = join(from, entry.name);
      const targetPath = join(to, entry.name);
      if (entry.isSymbolicLink()) throw new Error("plugin-symlink");
      if (entry.isDirectory()) {
        mkdirSync(targetPath, { recursive: false });
        walk(sourcePath, targetPath);
      } else if (entry.isFile()) {
        copyFileSync(sourcePath, targetPath);
        chmodSync(targetPath, lstatSync(sourcePath).mode & 0o777);
      } else {
        throw new Error("plugin-special-file");
      }
    }
  };
  walk(source, destination);
}

function backupPlugin(pluginRoot, gitDir, scope, config) {
  const expectedPluginName = pluginName(config);
  const source = inspectPluginTree(pluginRoot, null, expectedPluginName);
  const sessionDirectory = join(gitDir, config.update.sessionDirectory);
  if (existsSync(sessionDirectory) && (lstatSync(sessionDirectory).isSymbolicLink() || !lstatSync(sessionDirectory).isDirectory())) {
    fail("plugin復元用の保護領域を安全に作れないため、更新を開始しません。", EXIT_REFUSED);
  }
  mkdirSync(sessionDirectory, { recursive: true });
  const backupRoot = join(sessionDirectory, "plugin-backup");
  if (existsSync(backupRoot)) {
    if (lstatSync(backupRoot).isSymbolicLink() || !lstatSync(backupRoot).isDirectory()) {
      fail("plugin復元用の保護領域が安全でないため、更新を開始しません。", EXIT_REFUSED);
    }
    rmSync(backupRoot, { recursive: true, force: false });
  }
  try {
    copyPluginTree(source.root, backupRoot);
    const copied = inspectPluginTree(backupRoot, source.version, expectedPluginName);
    if (copied.treeHash !== source.treeHash || copied.fileCount !== source.fileCount) throw new Error("plugin-backup-mismatch");
    return { directory: "plugin-backup", version: source.version, scope, treeHash: source.treeHash, fileCount: source.fileCount, requiredSkills: source.requiredSkills };
  } catch {
    if (existsSync(backupRoot) && !lstatSync(backupRoot).isSymbolicLink()) rmSync(backupRoot, { recursive: true, force: true });
    fail("plugin更新前版を安全に退避できないため、更新を開始しません。", EXIT_REFUSED);
  }
}

function ensurePluginBackup(session, sessionDirectory, currentPluginRoot, config) {
  const expectedPluginName = pluginName(config);
  const backupRoot = join(sessionDirectory, "plugin-backup");
  try {
    if (session.pluginBackup?.directory === "plugin-backup") {
      const existing = inspectPluginTree(backupRoot, session.fromVersion, expectedPluginName);
      if (existing.treeHash !== session.pluginBackup.treeHash || existing.fileCount !== session.pluginBackup.fileCount) throw new Error("backup-mismatch");
      return false;
    }
  } catch {
    fail("更新前pluginの退避物を検証できません。workspace migrationは開始していません。", EXIT_REFUSED);
  }

  let current;
  try { current = inspectPluginTree(currentPluginRoot, session.toVersion, expectedPluginName); }
  catch { fail("更新後pluginを検証できないため、workspace migrationは開始していません。", EXIT_REFUSED); }
  const parent = dirname(current.root);
  const candidates = [];
  for (const entry of readdirSync(parent, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const candidate = join(parent, entry.name);
    if (candidate === current.root) continue;
    try {
      const inspected = inspectPluginTree(candidate, session.fromVersion, expectedPluginName);
      candidates.push(inspected.root);
    } catch {}
  }
  if (candidates.length !== 1) {
    fail(`更新前plugin ${session.fromVersion}を一意に確認できないため、workspace migrationは開始していません。`, EXIT_REFUSED);
  }
  session.pluginBackup = backupPlugin(candidates[0], gitDir, session.scope, config);
  session.pluginBackup.recoveredAfterReload = true;
  return true;
}

function safeManagedFile(workspace, rel, { allowMissing = false } = {}) {
  if (!ALLOWED_MANAGED_PATHS.has(rel) || rel.startsWith("/") || rel.split(/[\\/]/).some((part) => !part || part === "." || part === "..")) {
    fail("許可されていない管理対象が含まれるため、更新を止めました。", EXIT_REFUSED);
  }
  let target;
  try { target = safeWritePath(workspace, rel); }
  catch { fail("symlink経由またはworkspace外への変更を拒否しました。", EXIT_REFUSED); }
  const relToRoot = relative(workspace, target);
  if (!relToRoot || relToRoot === ".." || relToRoot.startsWith(`..${sep}`)) fail("workspace外への変更を拒否しました。", EXIT_REFUSED);
  let cursor = workspace;
  for (const part of rel.split("/")) {
    cursor = join(cursor, part);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) fail("symlinkを含む管理対象は変更しません。", EXIT_REFUSED);
  }
  if (!existsSync(target)) {
    if (allowMissing) return target;
    fail("管理対象が見つからないため、既定の現状維持で止めました。", EXIT_REFUSED);
  }
  if (!lstatSync(target).isFile()) fail("管理対象が通常ファイルではないため、更新を止めました。", EXIT_REFUSED);
  return target;
}

function sessionPath(gitDir, config, { existing = false } = {}) {
  const directories = [config.update.sessionDirectory, ...config.update.legacySessionDirectories]
    .map((name) => join(gitDir, name));
  for (const directory of directories) {
    if (existsSync(directory) && (lstatSync(directory).isSymbolicLink() || !lstatSync(directory).isDirectory())) {
      fail("更新の再開情報を置く領域が安全ではありません。", EXIT_REFUSED);
    }
    const path = join(directory, SESSION_NAME);
    if (existsSync(path) && (lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile())) {
      fail("更新の再開情報が安全な通常ファイルではありません。", EXIT_REFUSED);
    }
  }
  if (!existing) return join(directories[0], SESSION_NAME);
  const present = directories.map((directory) => join(directory, SESSION_NAME)).filter((path) => existsSync(path));
  if (present.length > 1) fail("新旧の更新sessionが同時に存在するため、推測で再開せず停止しました。", EXIT_REFUSED);
  return present[0] ?? join(directories[0], SESSION_NAME);
}

function readSession(path, config) {
  try {
    const value = JSON.parse(readFileSync(path, "utf8"));
    if (value?.schemaVersion !== 1 || !SEMVER.test(value.fromVersion) || !SEMVER.test(value.toVersion) || !/^[a-f0-9]{40,64}$/.test(value.protectionCommit)) throw new Error("schema");
    if (value.edition !== undefined && value.edition !== config.edition) throw new Error("edition");
    if (value.pluginId !== undefined && value.pluginId !== config.distribution.pluginId) throw new Error("plugin-id");
    return value;
  } catch {
    fail("安全な更新の再開情報を確認できません。最初の診断からやり直してください。", EXIT_REFUSED);
  }
}

function parseSelections(values) {
  const selections = {};
  for (const item of values) {
    const separator = item.lastIndexOf("=");
    if (separator < 1) fail("ファイル選択は path=keep|replace|diff|cancel 形式で指定してください。", EXIT_REFUSED);
    const path = item.slice(0, separator);
    const choice = item.slice(separator + 1);
    if (!ALLOWED_MANAGED_PATHS.has(path) || !ALLOWED_SELECTIONS.has(choice) || path in selections) {
      fail("ファイル選択が不明または重複しています。上書きせず停止しました。", EXIT_REFUSED);
    }
    selections[path] = choice;
  }
  return selections;
}

function trackedSecretRisk(workspace) {
  const listed = git(workspace, ["ls-files", "-z"]);
  if (listed.status !== 0) return true;
  for (const rel of listed.stdout.split("\0").filter(Boolean)) {
    if (rel.startsWith("/") || rel.split(/[\\/]/).some((part) => !part || part === "." || part === "..")) return true;
    if (/(?:^|\/)(?:\.env(?:\..+)?|credentials?\.json|id_(?:rsa|dsa|ecdsa|ed25519)|[^/]+\.(?:pem|p12|pfx|key))$/i.test(rel)) return true;
    const target = resolve(workspace, rel);
    const relToRoot = relative(workspace, target);
    if (!relToRoot || relToRoot === ".." || relToRoot.startsWith(`..${sep}`) || !existsSync(target) || lstatSync(target).isSymbolicLink() || !lstatSync(target).isFile()) return true;
    const bytes = readFileSync(target);
    if (bytes.length > 10 * 1024 * 1024) return true;
    if (!bytes.includes(0) && SECRET_PATTERN.test(bytes.toString("utf8"))) return true;
  }
  return false;
}

function readLedgerFile(workspace, rel) {
  let path;
  try { path = safeWritePath(workspace, rel); }
  catch { return { path: resolve(workspace, rel), records: "unsafe" }; }
  if (!existsSync(path)) return { path, records: null };
  if (lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile()) return { path, records: "unsafe" };
  try {
    return { path, value: JSON.parse(readFileSync(path, "utf8")) };
  } catch {
    return { path, records: "unsafe" };
  }
}

function readLedger(workspace, config) {
  const canonical = readLedgerFile(workspace, config.update.ledgerPath);
  const legacy = config.update.legacyLedgerPaths.map((rel) => ({ rel, ...readLedgerFile(workspace, rel) }));
  if (canonical.records === "unsafe" || legacy.some((item) => item.records === "unsafe")) {
    return { path: canonical.path, records: "unsafe" };
  }
  const presentLegacy = legacy.filter((item) => item.value !== undefined);
  if (presentLegacy.length > 1) return { path: canonical.path, records: "unsafe" };
  for (const item of presentLegacy) {
    if (!Array.isArray(item.value) || item.value.some((record) => !validLedgerRecord(record))) {
      return { path: canonical.path, records: "unsafe" };
    }
  }
  if (canonical.value !== undefined) {
    const value = canonical.value;
    if (!value || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).sort().join(",") !== "edition,records,schemaVersion"
      || value.schemaVersion !== 2 || value.edition !== config.edition
      || !Array.isArray(value.records) || value.records.some((record) => !validLedgerRecord(record))) {
      return { path: canonical.path, records: "unsafe" };
    }
    return { path: canonical.path, records: value.records, source: "canonical", legacyPaths: presentLegacy.map((item) => item.rel) };
  }
  if (presentLegacy.length === 1) {
    return { path: canonical.path, records: presentLegacy[0].value, source: "legacy", legacyPaths: [presentLegacy[0].rel] };
  }
  return { path: canonical.path, records: null, source: "none", legacyPaths: [] };
}

function validLedgerRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return false;
  if (Object.keys(record).length !== ALLOWED_LEDGER_FIELDS.size || Object.keys(record).some((key) => !ALLOWED_LEDGER_FIELDS.has(key))) return false;
  const pathAllowed = STATIC_LEDGER_PATHS.has(record.path)
    || /^secretary\/memory\/decisions\/\d{4}-\d{2}-\d{2}-decisions\.md$/.test(String(record.path ?? ""));
  if (!pathAllowed || !SEMVER.test(String(record.installedVersion ?? "")) || !HASH.test(String(record.baselineHash ?? ""))) return false;
  if (!record.templateVariables || typeof record.templateVariables !== "object" || Array.isArray(record.templateVariables)) return false;
  return Object.entries(record.templateVariables).every(([name, value]) => (
    ALLOWED_LEDGER_VARIABLES.has(name)
    && typeof value === "string"
    && LEDGER_VARIABLE_FORMATS[name].test(value)
  ));
}

function classifyManaged(workspace, fromVersion, diagnosis) {
  return [...ALLOWED_MANAGED_PATHS].map((path) => {
    const target = safeManagedFile(workspace, path);
    const currentHash = sha256File(target);
    const diagnosed = diagnosis.workspace?.files?.find((item) => item.path === path)?.status;
    if (["clean", "customized", "unknown-baseline"].includes(diagnosed)) return { path, status: diagnosed, currentHash };
    if (fromVersion === "0.2.0" && KNOWN_020_BASELINES.get(path) === currentHash) return { path, status: "unchanged", currentHash };
    return { path, status: "unknown-baseline", currentHash };
  });
}

function diagnosisCommand(scriptDir, workspace, currentPluginRoot, args) {
  const command = [
    join(scriptDir, "update-diagnose.mjs"),
    "--workspace", workspace,
    "--plugin-root", currentPluginRoot,
    "--choice", "proceed-update",
    "--json",
  ];
  const latestManifest = args.values.get("--latest-manifest");
  const changelog = args.values.get("--changelog");
  if (latestManifest || changelog) {
    if (!latestManifest || !changelog) fail("最新版情報はmanifestとCHANGELOGを一組で指定してください。", EXIT_REFUSED);
    command.push("--latest-manifest", resolve(latestManifest), "--changelog", resolve(changelog));
  }
  if (args.flags.has("--no-network")) command.push("--no-network");
  const result = run(process.execPath, command, { cwd: workspace });
  if (result.status !== 0) fail("読み取り専用診断に失敗したため、更新を開始しません。", EXIT_REFUSED);
  try {
    return JSON.parse(result.stdout);
  } catch {
    fail("診断結果を安全に確認できないため、更新を開始しません。", EXIT_REFUSED);
  }
}

function output(args, value) {
  if (args.flags.has("--json")) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return;
  }
  const explanation = value.explanation;
  const plan = value.plan;
  const lines = [
    value.title ?? "安全な更新",
    value.message,
    explanation ? `現在版: ${explanation.currentVersion ?? "確認できません"}` : null,
    explanation ? `最新版: ${explanation.latestVersion ?? "確認できません"}` : null,
    explanation ? `主な変更: ${(explanation.changes ?? []).join(" / ") || "確認できません"}` : null,
    explanation ? `設定・ファイルへの影響: ${(explanation.impact ?? []).join(" / ") || "確認できません"}` : null,
    explanation ? `衝突可能性: ${explanation.collision}` : null,
    explanation ? `更新対象: ${(explanation.target ?? []).join(" / ")}` : null,
    explanation?.protection,
    explanation?.push,
    explanation ? `戻し方: ${explanation.rollback}` : null,
    value.managed?.length ? `ファイル判定: ${value.managed.map((item) => `${item.path}=${item.status}（既定:${item.default}）`).join(" / ")}` : null,
    plan ? `migration: ${plan.fromVersion}→${plan.toVersion}` : null,
    plan ? `追加: ${plan.add.join(" / ") || "なし"}` : null,
    plan ? `変更: ${plan.change.join(" / ") || "なし"}` : null,
    plan ? `維持: ${plan.keep.join(" / ") || "なし"}` : null,
    plan ? `plan hash: ${plan.planHash}` : null,
    value.nextAction ? `次の操作: ${value.nextAction}` : null,
    value.protectionCommit ? `保護commit: ${value.protectionCommit}` : null,
    value.status ? `復元状態: ${value.status}` : null,
    value.pluginVersion ? `plugin version: ${value.pluginVersion}` : null,
    value.pluginScope ? `plugin scope: ${value.pluginScope}` : null,
    value.fallback?.pluginRoot ? `実行可能な旧版: ${value.fallback.pluginRoot}` : null,
    value.fallback?.command ? `旧版の起動: ${value.fallback.command}` : null,
    value.fallback?.verify ? `旧版の確認: ${value.fallback.verify}` : null,
    value.unresolved?.length ? `未復元項目: ${value.unresolved.join(" / ")}` : null,
  ].filter(Boolean);
  process.stdout.write(`${lines.join("\n")}\n`);
}

function pluginBinary(args) {
  const requested = args.values.get("--claude-binary");
  if (!requested) return "claude";
  if (!TEST_MODE || !isAbsolute(requested) || basename(requested) !== "claude-fixture") {
    fail("plugin更新コマンドは固定されたClaude Code公式経路だけを使用します。", EXIT_REFUSED);
  }
  const resolved = realpathSync(requested);
  if (lstatSync(resolved).isSymbolicLink() || !lstatSync(resolved).isFile()) fail("fixture adapterが安全ではありません。", EXIT_REFUSED);
  return resolved;
}

function runPluginUpdate(args, workspace, scope, config) {
  const binary = pluginBinary(args);
  const commands = [
    ["plugin", "marketplace", "update", config.distribution.marketplaceId],
    ["plugin", "update", config.distribution.pluginId, "--scope", scope],
  ];
  for (const command of commands) {
    const result = run(binary, command, { cwd: workspace });
    if (result.status !== 0) return { ok: false, failedStep: command[1] === "marketplace" ? "marketplace-refresh" : "plugin-update" };
  }
  return { ok: true, commands };
}

function protectionCommit(workspace, fromVersion, toVersion, config) {
  const before = git(workspace, ["rev-parse", "HEAD"]);
  if (before.status !== 0) fail("更新前commitを確認できないため、更新を開始しません。", EXIT_REFUSED);
  const result = git(workspace, ["commit", "--allow-empty", "-m", `${config.update.protectionCommitPrefix} 更新前の保護地点 ${fromVersion}→${toVersion}`]);
  if (result.status !== 0) fail("pushしない保護commitを作れなかったため、plugin更新とmigrationは行っていません。", EXIT_REFUSED);
  const after = git(workspace, ["rev-parse", "HEAD"]);
  if (after.status !== 0 || after.stdout.trim() === before.stdout.trim()) fail("保護commitの成立を確認できないため、更新を止めました。", EXIT_FAILED);
  return after.stdout.trim();
}

function guardEdition(workspace, pluginRoot, entry) {
  try {
    const config = loadEditionConfig(pluginRoot);
    const editionState = assertWorkspaceEdition(workspace, config, entry);
    return { config, editionState };
  } catch (error) {
    fail(error.message, EXIT_REFUSED);
  }
}

function start(args, scriptDir) {
  requireClaudePluginUpdater(args);
  const { workspace, gitDir } = safeWorkspace(args.values.get("--workspace"));
  const currentPluginRoot = args.values.get("--current-plugin-root") ?? resolve(scriptDir, "..");
  const { config, editionState } = guardEdition(workspace, currentPluginRoot, "update");
  const currentPlugin = safePluginRoot(currentPluginRoot, config);
  const diagnosis = diagnosisCommand(scriptDir, workspace, currentPlugin.root, args);
  const explanation = {
    currentVersion: diagnosis.currentVersion,
    latestVersion: diagnosis.latestVersion,
    changes: diagnosis.latest?.sections?.["変わること"] ?? [],
    impact: diagnosis.latest?.sections?.["設定・ファイルへの影響"] ?? [],
    collision: diagnosis.workspace?.status ?? "unknown-baseline",
    target: [config.distribution.pluginId, "secretary/AGENTS.md", "secretary/CLAUDE.md"],
    protection: "更新前にpushしないローカルcommitを1件作ります。",
    push: "この更新ではpushとremote変更を行いません。",
    rollback: "workspaceは保護commitの管理対象だけを戻します。pluginは自動復元できない場合に手動手順を示します。",
  };
  if (diagnosis.status !== "update-available" || !diagnosis.latestVersion) {
    output(args, { title: "更新は開始していません", message: "現在版・最新版・影響を確定できないため、すべて変更せず停止しました。", explanation, sideEffects: 0 });
    return;
  }
  const managed = classifyManaged(workspace, currentPlugin.version, diagnosis);
  const selections = parseSelections(args.repeated.get("--selection") ?? []);
  for (const item of managed) {
    const choice = selections[item.path] ?? (["customized", "unknown-baseline"].includes(item.status) ? "keep" : "replace");
    if (choice === "cancel") {
      output(args, { title: "更新を中止しました", message: "ファイルもGitもpluginも変更していません。", explanation, sideEffects: 0 });
      return;
    }
    if (choice === "diff") {
      output(args, {
        title: "差分の安全な要約",
        message: `${item.path} は配布時の基準と一致しません。私的本文やsecretを表示せず、現状維持のまま停止しました。`,
        explanation,
        sideEffects: 0,
      });
      return;
    }
    selections[item.path] = choice;
  }
  if (args.values.get("--consent") !== "update-approved") {
    output(args, { title: "最終確認待ち", message: "明示了承がないため、plugin・workspace・Git・設定を変更していません。", explanation, managed: managed.map(({ path, status }) => ({ path, status, default: "keep" })), sideEffects: 0 });
    return;
  }
  const status = git(workspace, ["status", "--porcelain=v1", "--untracked-files=all"]);
  if (status.status !== 0 || status.stdout.trim()) fail("未commitの変更または意図不明のファイルがあります。内容を勝手にcommitせず、更新を停止しました。", EXIT_REFUSED);
  if (trackedSecretRisk(workspace)) fail("資格情報らしき内容または安全に検査できないtracked fileを検出したため、commit・表示・更新を行わず停止しました。", EXIT_REFUSED);
  const scope = args.values.get("--scope") ?? "user";
  if (!ALLOWED_SCOPES.has(scope)) fail("pluginのscopeが不明なため更新を停止しました。", EXIT_REFUSED);
  const protection = protectionCommit(workspace, currentPlugin.version, diagnosis.latestVersion, config);
  const pluginBackup = backupPlugin(currentPlugin.root, gitDir, scope, config);
  const session = {
    schemaVersion: 1,
    edition: config.edition,
    pluginId: config.distribution.pluginId,
    phase: "protection-created",
    fromVersion: currentPlugin.version,
    toVersion: diagnosis.latestVersion,
    protectionCommit: protection,
    scope,
    workspaceEditionBefore: editionState.state,
    managed: managed.map(({ path, status, currentHash }) => ({ path, status, currentHash })),
    selections,
    pluginBackup,
    plugin: { updated: false, requiresReload: false },
    migration: { changedPaths: [], appliedHashes: {}, ledgerChanged: false, ledgerHash: null, markerChanged: false, markerHash: null },
  };
  const statePath = sessionPath(gitDir, config);
  atomicJson(statePath, session);
  const pluginUpdate = runPluginUpdate(args, workspace, scope, config);
  if (!pluginUpdate.ok) {
    session.phase = "plugin-update-failed";
    session.plugin.failedStep = pluginUpdate.failedStep;
    atomicJson(statePath, session);
    output(args, { title: "plugin更新に失敗しました", message: "workspace migrationは0件です。保護commitは残しています。", protectionCommit: protection, pluginUpdated: false, migrationCount: 0, pushCount: 0, nextAction: "接続状態を確認し、同じ更新を再試行するかrollbackを選んでください。" });
    process.exitCode = EXIT_FAILED;
    return;
  }
  session.phase = "awaiting-reload";
  session.plugin = { updated: true, requiresReload: true, officialCommand: `claude plugin update ${config.distribution.pluginId} --scope ${scope}` };
  atomicJson(statePath, session);
  output(args, {
    title: "plugin更新を受け付けました",
    message: "workspace migrationはまだ行っていません。新しいpluginを読み込むため /reload-plugins を実行してください。",
    protectionCommit: protection,
    pushCount: 0,
    nextAction: "/reload-plugins の後に「やさしい秘書の更新を再開」と伝えてください。残りはversion再確認、dry-run、確認後のmigration、検証です。",
  });
}

function retryPlugin(args) {
  requireClaudePluginUpdater(args);
  const { workspace, gitDir } = safeWorkspace(args.values.get("--workspace"));
  const pluginRoot = args.values.get("--plugin-root") ?? resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const { config } = guardEdition(workspace, pluginRoot, "update");
  safePluginRoot(pluginRoot, config);
  const statePath = sessionPath(gitDir, config, { existing: true });
  const session = readSession(statePath, config);
  if (session.phase !== "plugin-update-failed") fail("再試行できるplugin更新失敗状態がありません。", EXIT_REFUSED);
  const head = git(workspace, ["rev-parse", "HEAD"]);
  const status = git(workspace, ["status", "--porcelain=v1", "--untracked-files=all"]);
  if (head.status !== 0 || head.stdout.trim() !== session.protectionCommit || status.status !== 0 || status.stdout.trim()) {
    fail("保護commit後の状態が変わっています。新しいcommitを重ねず停止しました。", EXIT_REFUSED);
  }
  const pluginUpdate = runPluginUpdate(args, workspace, session.scope, config);
  if (!pluginUpdate.ok) {
    session.plugin.failedStep = pluginUpdate.failedStep;
    atomicJson(statePath, session);
    output(args, { title: "plugin更新の再試行に失敗しました", message: "workspace migrationは0件のままです。", protectionCommit: session.protectionCommit, migrationCount: 0, pushCount: 0 });
    process.exitCode = EXIT_FAILED;
    return;
  }
  session.phase = "awaiting-reload";
  session.plugin = { updated: true, requiresReload: true, officialCommand: `claude plugin update ${config.distribution.pluginId} --scope ${session.scope}` };
  atomicJson(statePath, session);
  output(args, { title: "plugin更新を再試行できました", message: "保護commitは増やしていません。/reload-plugins 後に更新を再開してください。", protectionCommit: session.protectionCommit, pushCount: 0 });
}

function migrationFiles(pluginRoot, fromVersion, toVersion) {
  const directory = join(pluginRoot, "migrations");
  const edges = readdirSync(directory)
    .map((file) => ({ file, match: file.match(/^(\d+\.\d+\.\d+)-to-(\d+\.\d+\.\d+)\.json$/) }))
    .filter(({ match }) => match)
    .map(({ file, match }) => ({ file, from: match[1], to: match[2] }))
    .sort((left, right) => left.file.localeCompare(right.file));
  const queue = [{ version: fromVersion, files: [] }];
  const visited = new Set([fromVersion]);
  while (queue.length) {
    const current = queue.shift();
    if (current.version === toVersion) return current.files;
    for (const edge of edges.filter((candidate) => candidate.from === current.version)) {
      if (visited.has(edge.to)) continue;
      visited.add(edge.to);
      queue.push({ version: edge.to, files: [...current.files, edge.file] });
    }
  }
  fail("対応するversion別migrationを確認できません。workspaceは変更していません。", EXIT_REFUSED);
}

function loadMigration(pluginRoot, fromVersion, toVersion) {
  const files = migrationFiles(pluginRoot, fromVersion, toVersion);
  const operations = [];
  for (const file of files) {
    const manifestPath = join(pluginRoot, "migrations", file);
    let manifest;
    try { manifest = JSON.parse(readFileSync(manifestPath, "utf8")); } catch { fail("対応するversion別migrationを確認できません。workspaceは変更していません。", EXIT_REFUSED); }
    const expected = file.match(/^(\d+\.\d+\.\d+)-to-(\d+\.\d+\.\d+)\.json$/);
    if (manifest.schemaVersion !== 1 || manifest.fromVersion !== expected?.[1] || manifest.toVersion !== expected?.[2] || !Array.isArray(manifest.operations)) fail("migration定義が不正なため停止しました。", EXIT_REFUSED);
    for (const operation of manifest.operations) {
      if (!ALLOWED_MANAGED_PATHS.has(operation.path) || operation.type !== "append-section" || typeof operation.marker !== "string" || typeof operation.asset !== "string") fail("migrationに許可外の操作があるため停止しました。", EXIT_REFUSED);
      const asset = realpathSync(join(pluginRoot, "migrations", operation.asset));
      const migrationRoot = realpathSync(join(pluginRoot, "migrations"));
      if (!asset.startsWith(`${migrationRoot}${sep}`)) fail("migration assetがplugin外を指すため停止しました。", EXIT_REFUSED);
      operations.push({ ...operation, assetPath: asset });
    }
  }
  return operations;
}

function buildPlan(workspace, session, pluginRoot) {
  const operations = loadMigration(pluginRoot, session.fromVersion, session.toVersion);
  const items = operations.map((operation) => {
    const target = safeManagedFile(workspace, operation.path);
    const body = readFileSync(target, "utf8");
    const managed = session.managed.find((item) => item.path === operation.path);
    const selection = session.selections[operation.path] ?? (["customized", "unknown-baseline"].includes(managed?.status) ? "keep" : "replace");
    if (selection === "keep") return { id: operation.id, path: operation.path, action: "keep", reason: "現状を残す選択", beforeHash: sha256Buffer(body) };
    if (body.includes(operation.marker)) return { id: operation.id, path: operation.path, action: "already-applied", reason: "同じmigrationは適用済み", beforeHash: sha256Buffer(body) };
    return { id: operation.id, path: operation.path, action: "change", reason: "確認後に更新安全性の固定セクションを追記", beforeHash: sha256Buffer(body), assetHash: sha256File(operation.assetPath) };
  });
  const plan = { fromVersion: session.fromVersion, toVersion: session.toVersion, add: [], change: items.filter((item) => item.action === "change").map((item) => item.path), keep: items.filter((item) => item.action !== "change").map((item) => item.path), items };
  plan.planHash = sha256Buffer(JSON.stringify(plan));
  return plan;
}

function resume(args) {
  const { workspace, gitDir } = safeWorkspace(args.values.get("--workspace"));
  const requestedPlugin = args.values.get("--plugin-root") ?? resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const { config } = guardEdition(workspace, requestedPlugin, "migration");
  const guardedPlugin = safePluginRoot(requestedPlugin, config);
  const statePath = sessionPath(gitDir, config, { existing: true });
  const session = readSession(statePath, config);
  if (!["awaiting-reload", "awaiting-migration-confirmation", "migration-partial", "verification-failed", "completed"].includes(session.phase)) {
    fail("plugin更新が完了していないため、workspace migrationへ進みません。", EXIT_REFUSED);
  }
  const plugin = guardedPlugin;
  if (plugin.version !== session.toVersion) fail("reload後のplugin versionが予定版と一致しません。migrationは行っていません。", EXIT_REFUSED);
  if (ensurePluginBackup(session, dirname(statePath), plugin.root, config)) atomicJson(statePath, session);
  session.migration = { changedPaths: [], appliedHashes: {}, ledgerChanged: false, ledgerHash: null, markerChanged: false, markerHash: null, ...(session.migration ?? {}) };
  const plan = session.phase === "migration-partial" && session.plan
    ? session.plan
    : buildPlan(workspace, session, plugin.root);
  if (session.phase === "completed") {
    output(args, { title: "更新は完了済みです", message: "同じmigrationの追加変更は0件です。", plan, migrationCount: 0, pushCount: 0 });
    return;
  }
  if (session.phase !== "migration-partial") {
    session.phase = "awaiting-migration-confirmation";
    session.plan = plan;
    atomicJson(statePath, session);
  }
  if (!args.flags.has("--apply")) {
    output(args, { title: "migration dry-run", message: "追加・変更・維持する対象を確認しました。まだworkspaceは変更していません。", plan, pluginVersion: plugin.version, nextAction: `内容を確認後、plan hash ${plan.planHash} を指定して本実行してください。` });
    return;
  }
  if (args.values.get("--plan-hash") !== plan.planHash) fail("dry-runと一致する明示確認がないため、migrationを実行しません。", EXIT_REFUSED);
  const head = git(workspace, ["rev-parse", "HEAD"]);
  if (head.status !== 0 || head.stdout.trim() !== session.protectionCommit) fail("保護commit後に別のcommitがあります。意図不明の変更を避けるため停止しました。", EXIT_REFUSED);
  const operations = loadMigration(plugin.root, session.fromVersion, session.toVersion);
  let applied = 0;
  for (const item of plan.items) {
    if (item.action !== "change") continue;
    const operation = operations.find((candidate) => candidate.id === item.id);
    const target = safeManagedFile(workspace, item.path);
    const body = readFileSync(target, "utf8");
    if (body.includes(operation.marker)) continue;
    if (sha256Buffer(body) !== item.beforeHash) fail("dry-run後に対象ファイルが変わったため、本実行せず停止しました。", EXIT_REFUSED);
    if (SECRET_PATTERN.test(body)) fail("資格情報らしき内容を検出したため、migrationを止めました。", EXIT_REFUSED);
    const asset = readFileSync(operation.assetPath, "utf8").trimEnd();
    writeFileAtomicSafe(workspace, target, `${body.trimEnd()}\n\n${asset}\n`, { encoding: "utf8" });
    session.migration.changedPaths = [...new Set([...session.migration.changedPaths, item.path])];
    session.migration.appliedHashes = { ...(session.migration.appliedHashes ?? {}), [item.path]: sha256File(target) };
    session.phase = "migration-partial";
    atomicJson(statePath, session);
    applied += 1;
    if (TEST_MODE && args.values.get("--test-fail-after") === "workspace-write") {
      output(args, { title: "migrationを中断しました", message: "途中状態を保存しました。同じplanで再開しても追記は重複しません。", applied, pushCount: 0 });
      process.exitCode = EXIT_FAILED;
      return;
    }
  }
  const ledgerResult = updateLedger(workspace, session, plan, config);
  session.migration.ledgerChanged = ledgerResult.changed;
  session.migration.ledgerHash = ledgerResult.hash;
  atomicJson(statePath, session);
  if (TEST_MODE && args.values.get("--test-fail-after") === "ledger-write") {
    session.phase = "migration-partial";
    atomicJson(statePath, session);
    output(args, { title: "migrationを中断しました", message: "edition付き台帳の更新後に停止しました。pluginとworkspaceの両方をrollbackできます。", applied, pushCount: 0 });
    process.exitCode = EXIT_FAILED;
    return;
  }
  const markerResult = updateEditionMarker(workspace, config);
  session.migration.markerChanged = markerResult.changed;
  session.migration.markerHash = markerResult.hash;
  atomicJson(statePath, session);
  const verification = verifyUpdate(workspace, plugin.root, session, plan, args, config);
  if (!verification.ok) {
    session.phase = "verification-failed";
    session.verification = verification;
    atomicJson(statePath, session);
    output(args, { title: "更新後の検証に失敗しました", message: "成功とは報告しません。pluginとworkspaceを分けてrollbackできます。", verification, pushCount: 0, nextAction: "rollbackを実行してください。" });
    process.exitCode = EXIT_FAILED;
    return;
  }
  session.phase = "completed";
  session.verification = verification;
  atomicJson(statePath, session);
  output(args, { title: "安全な更新が完了しました", message: "plugin version、台帳、選択、migration、主要導線を確認しました。pushは行っていません。", protectionCommit: session.protectionCommit, plan, verification, pushCount: 0 });
}

function updateLedger(workspace, session, plan, config) {
  const ledger = readLedger(workspace, config);
  if (ledger.records === "unsafe") fail("台帳を安全に更新できないため、成功とは報告しません。", EXIT_FAILED);
  const records = Array.isArray(ledger.records) ? ledger.records.filter((record) => record && typeof record === "object") : [];
  for (const item of plan.items) {
    if (!ALLOWED_MANAGED_PATHS.has(item.path)) continue;
    const managed = session.managed.find((candidate) => candidate.path === item.path);
    const confirmed = item.action === "change" || item.action === "already-applied" || managed?.status === "unchanged" || managed?.status === "clean";
    if (!confirmed) continue;
    const target = safeManagedFile(workspace, item.path);
    const existing = records.find((record) => record.path === item.path);
    const record = {
      path: item.path,
      installedVersion: session.toVersion,
      baselineHash: sha256File(target),
      templateVariables: existing?.templateVariables && typeof existing.templateVariables === "object" ? existing.templateVariables : {},
    };
    const index = records.findIndex((candidate) => candidate.path === item.path);
    if (index >= 0) records[index] = record;
    else records.push(record);
  }
  for (const managed of session.managed) {
    if (!["clean", "unchanged"].includes(managed.status)) continue;
    const index = records.findIndex((record) => record.path === managed.path);
    if (index < 0) continue;
    const target = safeManagedFile(workspace, managed.path);
    if (records[index].baselineHash !== sha256File(target)) continue;
    records[index] = { ...records[index], installedVersion: session.toVersion };
  }
  if (records.length === 0) return { changed: false, hash: null };
  const directory = dirname(ledger.path);
  if (existsSync(directory) && lstatSync(directory).isSymbolicLink()) fail("台帳の保存先がsymlinkのため停止しました。", EXIT_FAILED);
  const value = { schemaVersion: 2, edition: config.edition, records: records.sort((left, right) => left.path.localeCompare(right.path)) };
  const content = `${JSON.stringify(value, null, 2)}\n`;
  const before = existsSync(ledger.path) ? readFileSync(ledger.path, "utf8") : null;
  if (before !== content) writeFileAtomicSafe(workspace, ledger.path, content, { encoding: "utf8" });
  return { changed: before !== content, hash: sha256Buffer(content) };
}

function updateEditionMarker(workspace, config) {
  let marker;
  try { marker = safeWritePath(workspace, config.workspaceProtection.canonicalMarker); }
  catch { fail("neutral workspace markerの保存先が安全ではないため停止しました。", EXIT_FAILED); }
  if (existsSync(marker) && (lstatSync(marker).isSymbolicLink() || !lstatSync(marker).isFile())) {
    fail("neutral workspace markerが安全な通常ファイルではないため停止しました。", EXIT_FAILED);
  }
  const content = `${JSON.stringify({ schemaVersion: config.workspaceProtection.markerSchemaVersion, edition: config.edition }, null, 2)}\n`;
  const before = existsSync(marker) ? readFileSync(marker, "utf8") : null;
  if (before !== content) writeFileAtomicSafe(workspace, marker, content, { encoding: "utf8" });
  return { changed: before !== content, hash: sha256Buffer(content) };
}

function verifyUpdate(workspace, pluginRoot, session, plan, args, config) {
  const ledger = readLedger(workspace, config);
  const expectedLedgerPaths = [...new Set([...plan.items
    .filter((item) => {
      const managed = session.managed.find((candidate) => candidate.path === item.path);
      return item.action === "change" || item.action === "already-applied" || managed?.status === "unchanged" || managed?.status === "clean";
    })
    .map((item) => item.path), ...session.managed.filter((item) => ["clean", "unchanged"].includes(item.status)).map((item) => item.path)])];
  const ledgerValid = expectedLedgerPaths.every((path) => {
    if (!Array.isArray(ledger.records)) return false;
    const record = ledger.records.find((candidate) => candidate?.path === path);
    if (!record || record.installedVersion !== session.toVersion || !HASH.test(String(record.baselineHash ?? ""))) return false;
    return record.baselineHash === sha256File(safeManagedFile(workspace, path));
  });
  const checks = {
    pluginVersion: safePluginRoot(pluginRoot, config).version === session.toVersion,
    ledger: ledgerValid,
    workspaceEdition: inspectWorkspaceEdition(workspace, config).state === "same-edition",
    selectionHonored: plan.items.every((item) => item.action !== "keep" || !session.migration.changedPaths.includes(item.path)),
    migrationState: plan.items.every((item) => {
      if (item.action !== "change") return true;
      const operation = loadMigration(pluginRoot, session.fromVersion, session.toVersion).find((candidate) => candidate.id === item.id);
      return Boolean(operation && readFileSync(safeManagedFile(workspace, item.path), "utf8").includes(operation.marker));
    }),
    updateSkill: existsSync(join(pluginRoot, "skills", "update", "SKILL.md")),
    secretary: existsSync(join(pluginRoot, "skills", "secretary", "SKILL.md")),
    memory: existsSync(join(pluginRoot, "skills", "memory-care", "SKILL.md")),
    settings: existsSync(join(pluginRoot, "skills", "settings", "SKILL.md")),
    chatwork: existsSync(join(pluginRoot, "skills", "chatwork", "SKILL.md")),
    projects: existsSync(join(pluginRoot, "skills", "projects", "SKILL.md")),
    build: existsSync(join(pluginRoot, "skills", "build", "SKILL.md")),
    push: true,
  };
  if (TEST_MODE && args.values.get("--test-post-verify-fail") === "yes") checks.fixture = false;
  return { ok: Object.values(checks).every(Boolean), checks };
}

function metadataPath(workspace, rel, config) {
  if (![config.update.ledgerPath, config.workspaceProtection.canonicalMarker].includes(rel)) return null;
  try { return safeWritePath(workspace, rel); }
  catch { fail("復元対象のmetadata pathを安全に確認できないため停止しました。", EXIT_FAILED); }
}

function restoreFromCommit(workspace, commit, rel, config) {
  let target;
  try { target = metadataPath(workspace, rel, config) ?? safeManagedFile(workspace, rel, { allowMissing: true }); }
  catch { fail("復元対象のsymlink境界を確認できないため停止しました。", EXIT_FAILED); }
  const existsAtCommit = git(workspace, ["cat-file", "-e", `${commit}:${rel}`]);
  if (existsAtCommit.status === 0) {
    const content = git(workspace, ["show", `${commit}:${rel}`]);
    if (content.status !== 0) fail("保護commitからworkspaceを復元できませんでした。", EXIT_FAILED);
    writeFileAtomicSafe(workspace, target, content.stdout, { encoding: "utf8" });
  } else if (existsSync(target)) {
    if (lstatSync(target).isSymbolicLink() || !lstatSync(target).isFile()) fail("安全に削除できない復元対象があります。", EXIT_FAILED);
    removeSafe(workspace, target);
  }
}

function pluginFallback(backup, scope, version) {
  return {
    version,
    scope,
    pluginRoot: backup,
    command: `claude --plugin-dir "${backup}"`,
    verify: `.claude-plugin/plugin.json=${version} / skills/secretary/SKILL.md / skills/update/SKILL.md`,
  };
}

function restorePlugin(workspace, sessionDirectory, session, requestedRoot, config) {
  const backupInfo = session.pluginBackup;
  const expectedPluginName = pluginName(config);
  const backupRoot = join(sessionDirectory, "plugin-backup");
  try {
    if (!backupInfo || backupInfo.directory !== "plugin-backup" || backupInfo.version !== session.fromVersion || backupInfo.scope !== session.scope) throw new Error("backup-state");
    const backup = inspectPluginTree(backupRoot, session.fromVersion, expectedPluginName);
    if (backup.treeHash !== backupInfo.treeHash || backup.fileCount !== backupInfo.fileCount) throw new Error("backup-integrity");
    const fallback = pluginFallback(backup.root, session.scope, session.fromVersion);
    if (!requestedRoot) return { restored: false, verified: false, fallback, reason: "plugin復元先が指定されていません。" };

    const candidate = resolve(requestedRoot);
    const relToWorkspace = relative(workspace, candidate);
    if (!relToWorkspace || (relToWorkspace !== ".." && !relToWorkspace.startsWith(`..${sep}`))) {
      return { restored: false, verified: false, fallback, reason: "workspace内のpathをplugin復元先にしないでください。" };
    }
    const current = inspectPluginTree(candidate, null, expectedPluginName);
    if (current.version === session.fromVersion && current.treeHash === backup.treeHash) {
      return { restored: true, verified: true, version: current.version, scope: session.scope, requiredSkills: current.requiredSkills, fallback };
    }
    if (current.version !== session.toVersion) {
      return { restored: false, verified: false, fallback, reason: `復元先のplugin versionが予定した${session.toVersion}ではありません。` };
    }
    const parent = realpathSync(dirname(current.root));
    if (lstatSync(parent).isSymbolicLink()) throw new Error("plugin-parent-symlink");
    const staging = join(parent, `.${expectedPluginName}-rollback-stage-${process.pid}`);
    const quarantine = join(parent, `.${expectedPluginName}-rollback-new-${process.pid}`);
    if (existsSync(staging) || existsSync(quarantine)) throw new Error("plugin-rollback-collision");
    let targetMoved = false;
    try {
      copyPluginTree(backup.root, staging);
      const staged = inspectPluginTree(staging, session.fromVersion, expectedPluginName);
      if (staged.treeHash !== backup.treeHash) throw new Error("plugin-staging-mismatch");
      renameSync(current.root, quarantine);
      targetMoved = true;
      renameSync(staging, current.root);
      const restored = inspectPluginTree(current.root, session.fromVersion, expectedPluginName);
      if (restored.treeHash !== backup.treeHash) throw new Error("plugin-restore-mismatch");
      rmSync(quarantine, { recursive: true, force: false });
      return { restored: true, verified: true, version: restored.version, scope: session.scope, requiredSkills: restored.requiredSkills, fallback };
    } catch (error) {
      if (existsSync(staging) && !lstatSync(staging).isSymbolicLink()) rmSync(staging, { recursive: true, force: true });
      if (targetMoved && existsSync(quarantine)) {
        if (existsSync(current.root)) {
          if (lstatSync(current.root).isSymbolicLink()) throw error;
          rmSync(current.root, { recursive: true, force: true });
        }
        renameSync(quarantine, current.root);
      }
      throw error;
    }
  } catch {
    let fallback = null;
    try {
      const backup = inspectPluginTree(backupRoot, session.fromVersion, expectedPluginName);
      fallback = pluginFallback(backup.root, session.scope, session.fromVersion);
    } catch {}
    return { restored: false, verified: false, fallback, reason: "pluginを自動復元できませんでした。" };
  }
}

function hashFromCommit(workspace, commit, rel) {
  const existsAtCommit = git(workspace, ["cat-file", "-e", `${commit}:${rel}`]);
  if (existsAtCommit.status !== 0) return null;
  const content = git(workspace, ["show", `${commit}:${rel}`]);
  return content.status === 0 ? sha256Buffer(content.stdout) : undefined;
}

function currentPathHash(workspace, rel, config) {
  let target;
  try { target = metadataPath(workspace, rel, config) ?? safeManagedFile(workspace, rel, { allowMissing: true }); }
  catch { return undefined; }
  if (!existsSync(target)) return null;
  if (lstatSync(target).isSymbolicLink() || !lstatSync(target).isFile()) return undefined;
  return sha256File(target);
}

function rollback(args) {
  const { workspace, gitDir } = safeWorkspace(args.values.get("--workspace"));
  const pluginRoot = args.values.get("--plugin-root") ?? resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const { config } = guardEdition(workspace, pluginRoot, "update");
  safePluginRoot(pluginRoot, config);
  const statePath = sessionPath(gitDir, config, { existing: true });
  const session = readSession(statePath, config);
  const head = git(workspace, ["rev-parse", "HEAD"]);
  const unresolved = [];
  let workspaceRestored = Boolean(session.workspaceRestored);
  if (!workspaceRestored) {
    if (head.status !== 0 || head.stdout.trim() !== session.protectionCommit) {
      unresolved.push("保護commit後に別のcommitがあるため、workspaceを上書きしていません。");
    } else {
      const targets = [...new Set([
        ...(session.migration?.changedPaths ?? []),
        ...(session.migration?.ledgerChanged ? [config.update.ledgerPath] : []),
        ...(session.migration?.markerChanged ? [config.workspaceProtection.canonicalMarker] : []),
      ])];
      let safe = true;
      for (const path of targets) {
        const currentHash = currentPathHash(workspace, path, config);
        const protectedHash = hashFromCommit(workspace, session.protectionCommit, path);
        const expectedAppliedHash = path === config.update.ledgerPath
          ? session.migration?.ledgerHash
          : path === config.workspaceProtection.canonicalMarker
            ? session.migration?.markerHash
            : session.migration?.appliedHashes?.[path];
        if (currentHash === protectedHash) continue;
        if (currentHash === undefined || !expectedAppliedHash || currentHash !== expectedAppliedHash) {
          safe = false;
          unresolved.push(`${path} は更新後に利用者変更がある可能性があるため、上書きしていません。`);
        }
      }
      if (safe) {
        for (const path of targets) {
          if (currentPathHash(workspace, path, config) !== hashFromCommit(workspace, session.protectionCommit, path)) restoreFromCommit(workspace, session.protectionCommit, path, config);
        }
        workspaceRestored = targets.every((path) => currentPathHash(workspace, path, config) === hashFromCommit(workspace, session.protectionCommit, path));
        if (!workspaceRestored) unresolved.push("workspaceの管理対象を保護commitと一致させられませんでした。");
      }
    }
  }
  const pluginResult = restorePlugin(workspace, dirname(statePath), session, args.values.get("--plugin-root"), config);
  if (!pluginResult.restored) unresolved.push(pluginResult.reason);
  session.workspaceRestored = workspaceRestored;
  session.pluginRestored = pluginResult.restored;
  session.phase = workspaceRestored && pluginResult.restored ? "rolled-back" : "rollback-partial";
  atomicJson(statePath, session);
  output(args, {
    title: workspaceRestored && pluginResult.restored ? "workspaceとpluginを復元しました" : "復元はまだ完了していません",
    status: workspaceRestored && pluginResult.restored ? "rolled-back" : "partial-restoration",
    message: workspaceRestored && pluginResult.restored
      ? "workspaceの管理対象とpluginを更新前へ戻し、plugin versionと主要skillを確認しました。"
      : "workspaceとpluginの片方または両方に未復元項目があります。完了として扱っていません。",
    protectionCommit: session.protectionCommit,
    workspaceRestored,
    pluginRestored: pluginResult.restored,
    pluginVersion: pluginResult.version ?? session.fromVersion,
    pluginScope: session.scope,
    pluginVerified: pluginResult.verified,
    requiredSkills: pluginResult.requiredSkills ?? session.pluginBackup?.requiredSkills ?? [],
    fallback: pluginResult.fallback,
    unresolved,
    pushCount: 0,
  });
  if (!workspaceRestored || !pluginResult.restored) process.exitCode = EXIT_FAILED;
}

const args = parseArgs(process.argv.slice(2));
updateHost(args);
const scriptDir = dirname(fileURLToPath(import.meta.url));
if (args.command === "start") start(args, scriptDir);
else if (args.command === "retry-plugin") retryPlugin(args);
else if (args.command === "resume") resume(args);
else if (args.command === "rollback") rollback(args);
else fail("使い方: update-apply.mjs start|resume|rollback --workspace <private-workspace>");
