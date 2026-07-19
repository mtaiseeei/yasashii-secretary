#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { safeWritePath, workingRoot, writeFileAtomicSafe } from "./lib/safe-fs.mjs";

const EXIT_USAGE = 2;
const EXIT_REFUSED = 3;
const LEDGER_PATH = ".yasashii-secretary/update-ledger.json";
const SEMVER = /^\d+\.\d+\.\d+$/;
const ALLOWED_VARIABLES = new Set(["CREATED_DATE", "CREATED_AT", "REPORT_DETAIL"]);
const VARIABLE_FORMATS = {
  CREATED_DATE: /^\d{4}-\d{2}-\d{2}$/,
  CREATED_AT: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,
  REPORT_DETAIL: /^(?:みじかく|くわしく)$/,
};
const STATIC_MANAGED_PATHS = new Set([
  "secretary/AGENTS.md",
  "secretary/CLAUDE.md",
  "secretary/memory/MEMORY.md",
  "secretary/memory/preferences.md",
  ".github/workflows/chatwork-sync.yml",
  "chatwork/config.json",
  "chatwork/rooms.json",
  "chatwork/scripts/chatwork-sync.mjs",
]);

function fail(message, code = EXIT_USAGE) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const parsed = { command: argv[0], values: new Map(), repeated: new Map(), flags: new Set() };
  const repeatable = new Set(["--managed-path", "--template-variable"]);
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) fail(`未対応の引数です: ${token}`);
    if (["--new-install", "--confirm"].includes(token)) {
      parsed.flags.add(token);
      continue;
    }
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

function isManagedPath(value) {
  if (STATIC_MANAGED_PATHS.has(value)) return true;
  return /^secretary\/memory\/decisions\/\d{4}-\d{2}-\d{2}-decisions\.md$/.test(value);
}

function safeWorkspaceRoot(value) {
  try { return workingRoot(value); }
  catch { fail(`workspaceを安全に確認できません: ${value}`, EXIT_REFUSED); }
}

function safeFile(root, rel) {
  if (!isManagedPath(rel) || rel.startsWith("/") || rel.split(/[\\/]/).some((part) => !part || part === "." || part === "..")) {
    fail(`管理対象として許可されていないpathです: ${rel}`, EXIT_REFUSED);
  }
  const target = resolve(root, rel);
  const relToRoot = relative(root, target);
  if (!relToRoot || relToRoot === ".." || relToRoot.startsWith(`..${sep}`)) {
    fail(`workspace外のpathは台帳へ登録できません: ${rel}`, EXIT_REFUSED);
  }
  let cursor = root;
  for (const part of rel.split("/")) {
    cursor = join(cursor, part);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) {
      fail(`symlinkを含むpathは台帳へ登録できません: ${rel}`, EXIT_REFUSED);
    }
  }
  if (!existsSync(target) || !lstatSync(target).isFile()) {
    fail(`新規生成された管理対象ファイルが見つかりません: ${rel}`, EXIT_REFUSED);
  }
  return target;
}

function parseVariables(values) {
  const variables = {};
  for (const item of values) {
    const separator = item.indexOf("=");
    if (separator <= 0) fail("template variableは NAME=VALUE 形式で指定してください。", EXIT_REFUSED);
    const name = item.slice(0, separator);
    const value = item.slice(separator + 1);
    if (!ALLOWED_VARIABLES.has(name)) {
      fail(`私的内容になり得るtemplate variableは台帳へ保存できません: ${name}`, EXIT_REFUSED);
    }
    if (!value || /[\r\n]/.test(value)) fail(`template variable ${name} は安全な1行の値にしてください。`, EXIT_REFUSED);
    if (!VARIABLE_FORMATS[name].test(value)) {
      fail(`template variable ${name} は許可された形式ではないため保存しません。`, EXIT_REFUSED);
    }
    if (/(?:password|api[_-]?key|token|secret|credential)\s*[:=]/i.test(value)) {
      fail(`template variable ${name} に資格情報らしき値があるため保存しません。`, EXIT_REFUSED);
    }
    variables[name] = value;
  }
  return Object.fromEntries(Object.entries(variables).sort(([left], [right]) => left.localeCompare(right)));
}

function sha256(path) {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

function pluginVersion(pluginRoot) {
  const manifestPath = join(pluginRoot, ".claude-plugin", "plugin.json");
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    fail("plugin manifestを読み取れないため台帳を作成しません。", EXIT_REFUSED);
  }
  if (!SEMVER.test(String(manifest.version ?? ""))) {
    fail("plugin manifestのversionがsemverではないため台帳を作成しません。", EXIT_REFUSED);
  }
  return manifest.version;
}

function initialize(args) {
  if (!args.flags.has("--new-install") || !args.flags.has("--confirm")) {
    fail("最小台帳は新規導入時だけ作成できます。--new-install と --confirm が必要です。", EXIT_REFUSED);
  }
  const workspaceValue = args.values.get("--workspace");
  const pluginRootValue = args.values.get("--plugin-root");
  const managedPaths = [...new Set(args.repeated.get("--managed-path") ?? [])].sort();
  if (!workspaceValue || !pluginRootValue || managedPaths.length === 0) {
    fail("initには --workspace、--plugin-root、1件以上の --managed-path が必要です。");
  }
  const workspace = safeWorkspaceRoot(workspaceValue);
  const ledger = safeWritePath(workspace, LEDGER_PATH);
  if (existsSync(ledger)) fail("既存の最小台帳は上書きしません。", EXIT_REFUSED);
  const ledgerDirectory = dirname(ledger);
  if (existsSync(ledgerDirectory) && (lstatSync(ledgerDirectory).isSymbolicLink() || !lstatSync(ledgerDirectory).isDirectory())) {
    fail("最小台帳の保存先が安全なdirectoryではないため作成しません。", EXIT_REFUSED);
  }

  let pluginRoot;
  try {
    pluginRoot = realpathSync(resolve(pluginRootValue));
  } catch {
    fail("plugin rootを読み取れないため台帳を作成しません。", EXIT_REFUSED);
  }
  const version = pluginVersion(pluginRoot);
  const templateVariables = parseVariables(args.repeated.get("--template-variable") ?? []);
  const records = managedPaths.map((path) => ({
    path,
    installedVersion: version,
    baselineHash: sha256(safeFile(workspace, path)),
    templateVariables,
  }));

  try {
    writeFileAtomicSafe(workspace, ledger, `${JSON.stringify(records, null, 2)}\n`, { encoding: "utf8" });
  } catch {
    fail("最小台帳を安全に作成できませんでした。既存workspaceの診断では作り直しません。", EXIT_REFUSED);
  }
  process.stdout.write(`新規導入の最小台帳を作成しました: ${LEDGER_PATH}（管理対象${records.length}件）\n`);
}

const args = parseArgs(process.argv.slice(2));
if (args.command === "init") initialize(args);
else fail("使い方: update-ledger.mjs init --workspace . --plugin-root <plugin> --managed-path <path> --new-install --confirm");
