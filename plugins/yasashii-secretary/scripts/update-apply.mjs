#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const EXIT_USAGE = 2;
const EXIT_REFUSED = 3;
const EXIT_FAILED = 4;
const PLUGIN_ID = "yasashii-secretary@yasashii-secretary";
const MARKETPLACE_ID = "yasashii-secretary";
const LEDGER_PATH = ".yasashii-secretary/update-ledger.json";
const SESSION_DIRECTORY = "yasashii-secretary-update";
const SESSION_NAME = "session.json";
const SEMVER = /^\d+\.\d+\.\d+$/;
const HASH = /^sha256:[a-f0-9]{64}$/;
const ALLOWED_SCOPES = new Set(["user", "project", "local"]);
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
  return spawnSync(binary, args, {
    cwd: options.cwd,
    encoding: "utf8",
    shell: false,
    input: options.input,
    env: options.env ?? process.env,
    maxBuffer: 8 * 1024 * 1024,
  });
}

function git(workspace, args, options = {}) {
  return run("git", args, { ...options, cwd: workspace });
}

function safeWorkspace(value) {
  const candidate = resolve(value ?? ".");
  if (!existsSync(candidate) || !lstatSync(candidate).isDirectory() || lstatSync(candidate).isSymbolicLink()) {
    fail("workspaceを安全に読み取れないため、更新を開始しません。", EXIT_REFUSED);
  }
  const workspace = realpathSync(candidate);
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

function safePluginRoot(value) {
  try {
    const root = realpathSync(resolve(value));
    const manifest = JSON.parse(readFileSync(join(root, ".claude-plugin", "plugin.json"), "utf8"));
    if (manifest.name !== "yasashii-secretary" || !SEMVER.test(String(manifest.version ?? ""))) throw new Error("manifest");
    return { root, version: manifest.version };
  } catch {
    fail("pluginのversionを安全に確認できないため、更新を進めません。", EXIT_REFUSED);
  }
}

function safeManagedFile(workspace, rel, { allowMissing = false } = {}) {
  if (!ALLOWED_MANAGED_PATHS.has(rel) || rel.startsWith("/") || rel.split(/[\\/]/).some((part) => !part || part === "." || part === "..")) {
    fail("許可されていない管理対象が含まれるため、更新を止めました。", EXIT_REFUSED);
  }
  const target = resolve(workspace, rel);
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

function sessionPath(gitDir) {
  return join(gitDir, SESSION_DIRECTORY, SESSION_NAME);
}

function readSession(path) {
  try {
    const value = JSON.parse(readFileSync(path, "utf8"));
    if (value?.schemaVersion !== 1 || !SEMVER.test(value.fromVersion) || !SEMVER.test(value.toVersion) || !/^[a-f0-9]{40,64}$/.test(value.protectionCommit)) throw new Error("schema");
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

function readLedger(workspace) {
  const path = resolve(workspace, LEDGER_PATH);
  if (!existsSync(path)) return { path, records: null };
  if (lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile()) return { path, records: "unsafe" };
  try {
    const records = JSON.parse(readFileSync(path, "utf8"));
    if (!Array.isArray(records) || records.some((record) => !validLedgerRecord(record))) throw new Error("schema");
    return { path, records };
  } catch {
    return { path, records: "unsafe" };
  }
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

function runPluginUpdate(args, workspace, scope) {
  const binary = pluginBinary(args);
  const commands = [
    ["plugin", "marketplace", "update", MARKETPLACE_ID],
    ["plugin", "update", PLUGIN_ID, "--scope", scope],
  ];
  for (const command of commands) {
    const result = run(binary, command, { cwd: workspace });
    if (result.status !== 0) return { ok: false, failedStep: command[1] === "marketplace" ? "marketplace-refresh" : "plugin-update" };
  }
  return { ok: true, commands };
}

function protectionCommit(workspace, fromVersion, toVersion) {
  const before = git(workspace, ["rev-parse", "HEAD"]);
  if (before.status !== 0) fail("更新前commitを確認できないため、更新を開始しません。", EXIT_REFUSED);
  const result = git(workspace, ["commit", "--allow-empty", "-m", `[yasashii-secretary] 更新前の保護地点 ${fromVersion}→${toVersion}`]);
  if (result.status !== 0) fail("pushしない保護commitを作れなかったため、plugin更新とmigrationは行っていません。", EXIT_REFUSED);
  const after = git(workspace, ["rev-parse", "HEAD"]);
  if (after.status !== 0 || after.stdout.trim() === before.stdout.trim()) fail("保護commitの成立を確認できないため、更新を止めました。", EXIT_FAILED);
  return after.stdout.trim();
}

function start(args, scriptDir) {
  const { workspace, gitDir } = safeWorkspace(args.values.get("--workspace"));
  const currentPlugin = safePluginRoot(args.values.get("--current-plugin-root") ?? resolve(scriptDir, ".."));
  const diagnosis = diagnosisCommand(scriptDir, workspace, currentPlugin.root, args);
  const explanation = {
    currentVersion: diagnosis.currentVersion,
    latestVersion: diagnosis.latestVersion,
    changes: diagnosis.latest?.sections?.["変わること"] ?? [],
    impact: diagnosis.latest?.sections?.["設定・ファイルへの影響"] ?? [],
    collision: diagnosis.workspace?.status ?? "unknown-baseline",
    target: [PLUGIN_ID, "secretary/AGENTS.md", "secretary/CLAUDE.md"],
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
  const protection = protectionCommit(workspace, currentPlugin.version, diagnosis.latestVersion);
  const session = {
    schemaVersion: 1,
    phase: "protection-created",
    fromVersion: currentPlugin.version,
    toVersion: diagnosis.latestVersion,
    protectionCommit: protection,
    scope,
    managed: managed.map(({ path, status, currentHash }) => ({ path, status, currentHash })),
    selections,
    plugin: { updated: false, requiresReload: false },
    migration: { changedPaths: [], ledgerChanged: false },
  };
  const statePath = sessionPath(gitDir);
  atomicJson(statePath, session);
  const pluginUpdate = runPluginUpdate(args, workspace, scope);
  if (!pluginUpdate.ok) {
    session.phase = "plugin-update-failed";
    session.plugin.failedStep = pluginUpdate.failedStep;
    atomicJson(statePath, session);
    output(args, { title: "plugin更新に失敗しました", message: "workspace migrationは0件です。保護commitは残しています。", protectionCommit: protection, pluginUpdated: false, migrationCount: 0, pushCount: 0, nextAction: "接続状態を確認し、同じ更新を再試行するかrollbackを選んでください。" });
    process.exitCode = EXIT_FAILED;
    return;
  }
  session.phase = "awaiting-reload";
  session.plugin = { updated: true, requiresReload: true, officialCommand: `claude plugin update ${PLUGIN_ID} --scope ${scope}` };
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
  const { workspace, gitDir } = safeWorkspace(args.values.get("--workspace"));
  const statePath = sessionPath(gitDir);
  const session = readSession(statePath);
  if (session.phase !== "plugin-update-failed") fail("再試行できるplugin更新失敗状態がありません。", EXIT_REFUSED);
  const head = git(workspace, ["rev-parse", "HEAD"]);
  const status = git(workspace, ["status", "--porcelain=v1", "--untracked-files=all"]);
  if (head.status !== 0 || head.stdout.trim() !== session.protectionCommit || status.status !== 0 || status.stdout.trim()) {
    fail("保護commit後の状態が変わっています。新しいcommitを重ねず停止しました。", EXIT_REFUSED);
  }
  const pluginUpdate = runPluginUpdate(args, workspace, session.scope);
  if (!pluginUpdate.ok) {
    session.plugin.failedStep = pluginUpdate.failedStep;
    atomicJson(statePath, session);
    output(args, { title: "plugin更新の再試行に失敗しました", message: "workspace migrationは0件のままです。", protectionCommit: session.protectionCommit, migrationCount: 0, pushCount: 0 });
    process.exitCode = EXIT_FAILED;
    return;
  }
  session.phase = "awaiting-reload";
  session.plugin = { updated: true, requiresReload: true, officialCommand: `claude plugin update ${PLUGIN_ID} --scope ${session.scope}` };
  atomicJson(statePath, session);
  output(args, { title: "plugin更新を再試行できました", message: "保護commitは増やしていません。/reload-plugins 後に更新を再開してください。", protectionCommit: session.protectionCommit, pushCount: 0 });
}

function loadMigration(pluginRoot, fromVersion, toVersion) {
  const files = fromVersion === "0.2.0" && toVersion === "0.4.0"
    ? ["0.2.0-to-0.3.0.json", "0.3.0-to-0.4.0.json"]
    : [`${fromVersion}-to-${toVersion}.json`];
  const operations = [];
  for (const file of files) {
    const manifestPath = join(pluginRoot, "migrations", file);
    let manifest;
    try { manifest = JSON.parse(readFileSync(manifestPath, "utf8")); } catch { fail("対応するversion別migrationを確認できません。workspaceは変更していません。", EXIT_REFUSED); }
    if (manifest.schemaVersion !== 1 || !SEMVER.test(manifest.fromVersion) || !SEMVER.test(manifest.toVersion) || !Array.isArray(manifest.operations)) fail("migration定義が不正なため停止しました。", EXIT_REFUSED);
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
  const statePath = sessionPath(gitDir);
  const session = readSession(statePath);
  if (!["awaiting-reload", "awaiting-migration-confirmation", "migration-partial", "verification-failed", "completed"].includes(session.phase)) {
    fail("plugin更新が完了していないため、workspace migrationへ進みません。", EXIT_REFUSED);
  }
  const plugin = safePluginRoot(args.values.get("--plugin-root") ?? resolve(dirname(fileURLToPath(import.meta.url)), ".."));
  if (plugin.version !== session.toVersion) fail("reload後のplugin versionが予定版と一致しません。migrationは行っていません。", EXIT_REFUSED);
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
    writeFileSync(target, `${body.trimEnd()}\n\n${asset}\n`, "utf8");
    session.migration.changedPaths = [...new Set([...session.migration.changedPaths, item.path])];
    session.phase = "migration-partial";
    atomicJson(statePath, session);
    applied += 1;
    if (TEST_MODE && args.values.get("--test-fail-after") === "workspace-write") {
      output(args, { title: "migrationを中断しました", message: "途中状態を保存しました。同じplanで再開しても追記は重複しません。", applied, pushCount: 0 });
      process.exitCode = EXIT_FAILED;
      return;
    }
  }
  updateLedger(workspace, session, plan);
  session.migration.ledgerChanged = true;
  const verification = verifyUpdate(workspace, plugin.root, session, plan, args);
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

function updateLedger(workspace, session, plan) {
  const ledger = readLedger(workspace);
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
  if (records.length === 0) return;
  const directory = dirname(ledger.path);
  if (existsSync(directory) && lstatSync(directory).isSymbolicLink()) fail("台帳の保存先がsymlinkのため停止しました。", EXIT_FAILED);
  atomicJson(ledger.path, records.sort((left, right) => left.path.localeCompare(right.path)));
}

function verifyUpdate(workspace, pluginRoot, session, plan, args) {
  const ledger = readLedger(workspace);
  const expectedLedgerPaths = plan.items
    .filter((item) => {
      const managed = session.managed.find((candidate) => candidate.path === item.path);
      return item.action === "change" || item.action === "already-applied" || managed?.status === "unchanged" || managed?.status === "clean";
    })
    .map((item) => item.path);
  const ledgerValid = expectedLedgerPaths.every((path) => {
    if (!Array.isArray(ledger.records)) return false;
    const record = ledger.records.find((candidate) => candidate?.path === path);
    if (!record || record.installedVersion !== session.toVersion || !HASH.test(String(record.baselineHash ?? ""))) return false;
    return record.baselineHash === sha256File(safeManagedFile(workspace, path));
  });
  const checks = {
    pluginVersion: safePluginRoot(pluginRoot).version === session.toVersion,
    ledger: ledgerValid,
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

function restoreFromCommit(workspace, commit, rel) {
  const target = rel === LEDGER_PATH ? resolve(workspace, rel) : safeManagedFile(workspace, rel, { allowMissing: true });
  const existsAtCommit = git(workspace, ["cat-file", "-e", `${commit}:${rel}`]);
  if (existsAtCommit.status === 0) {
    const content = git(workspace, ["show", `${commit}:${rel}`]);
    if (content.status !== 0) fail("保護commitからworkspaceを復元できませんでした。", EXIT_FAILED);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content.stdout, "utf8");
  } else if (existsSync(target)) {
    if (lstatSync(target).isSymbolicLink() || !lstatSync(target).isFile()) fail("安全に削除できない復元対象があります。", EXIT_FAILED);
    rmSync(target);
  }
}

function rollback(args) {
  const { workspace, gitDir } = safeWorkspace(args.values.get("--workspace"));
  const statePath = sessionPath(gitDir);
  const session = readSession(statePath);
  const head = git(workspace, ["rev-parse", "HEAD"]);
  if (head.status !== 0 || head.stdout.trim() !== session.protectionCommit) fail("保護commit後に別のcommitがあります。自動で上書きせず、手動確認へ切り替えます。", EXIT_REFUSED);
  for (const path of session.migration?.changedPaths ?? []) restoreFromCommit(workspace, session.protectionCommit, path);
  if (session.migration?.ledgerChanged || existsSync(resolve(workspace, LEDGER_PATH))) restoreFromCommit(workspace, session.protectionCommit, LEDGER_PATH);
  session.phase = "rolled-back";
  atomicJson(statePath, session);
  output(args, {
    title: "workspaceを復元しました",
    message: "管理対象だけを保護commitの状態へ戻しました。git reset --hard、push、remote変更は行っていません。pluginは自動で旧版へ戻していません。",
    protectionCommit: session.protectionCommit,
    workspaceRestored: true,
    pluginRestored: false,
    unresolved: ["Claude Codeの /plugin → Installed でyasashii-secretaryの状態を確認し、旧版が必要なら保守者へ連絡してください。旧cacheは一時的であり自動復元の正本にしません。"],
    pushCount: 0,
  });
}

const args = parseArgs(process.argv.slice(2));
const scriptDir = dirname(fileURLToPath(import.meta.url));
if (args.command === "start") start(args, scriptDir);
else if (args.command === "retry-plugin") retryPlugin(args);
else if (args.command === "resume") resume(args);
else if (args.command === "rollback") rollback(args);
else fail("使い方: update-apply.mjs start|resume|rollback --workspace <private-workspace>");
