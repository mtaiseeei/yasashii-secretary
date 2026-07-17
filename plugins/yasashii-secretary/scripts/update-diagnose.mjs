#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_NAME = "yasashii-secretary";
const LEDGER_PATH = ".yasashii-secretary/update-ledger.json";
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const ALLOWED_RECORD_FIELDS = new Set(["path", "installedVersion", "baselineHash", "templateVariables"]);
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
const DEFAULT_MARKETPLACE_URL = "https://raw.githubusercontent.com/mtaiseeei/yasashii-secretary/main/.claude-plugin/marketplace.json";
const DEFAULT_CHANGELOG_URL = "https://raw.githubusercontent.com/mtaiseeei/yasashii-secretary/main/plugins/yasashii-secretary/CHANGELOG.md";

function parseArgs(argv) {
  const result = { values: new Map(), flags: new Set() };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (["--json", "--no-network"].includes(token)) {
      result.flags.add(token);
      continue;
    }
    if (!token.startsWith("--")) throw new Error(`未対応の引数です: ${token}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${token} の値を指定してください。`);
    result.values.set(token, value);
    index += 1;
  }
  return result;
}

const SAFE_CHOICES = new Set(["check-only", "decline", "cancel", "proceed-update"]);

function isManagedPath(value) {
  return STATIC_MANAGED_PATHS.has(value)
    || /^secretary\/memory\/decisions\/\d{4}-\d{2}-\d{2}-decisions\.md$/.test(value);
}

function semver(value) {
  const match = String(value ?? "").match(SEMVER);
  return match ? match.slice(1).map(Number) : null;
}

function compareVersions(left, right) {
  const a = semver(left);
  const b = semver(right);
  if (!a || !b) return null;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return 0;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function marketplaceVersion(data) {
  const entries = Array.isArray(data?.plugins) ? data.plugins : [];
  const matches = entries.filter((item) => item?.name === PLUGIN_NAME);
  return matches.length === 1 && semver(matches[0]?.version) ? matches[0].version : null;
}

function completeRelease(sections) {
  return ["対象者", "変わること", "設定・ファイルへの影響", "必要な操作", "互換性上の注意"]
    .every((heading) => Array.isArray(sections?.[heading]) && sections[heading].length > 0);
}

function parseChangelog(markdown) {
  const releases = new Map();
  const duplicates = new Set();
  const matches = [...markdown.matchAll(/^## \[(\d+\.\d+\.\d+)\](?:\s+-\s+[^\n]+)?$/gm)];
  for (let index = 0; index < matches.length; index += 1) {
    const start = matches[index].index + matches[index][0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : markdown.length;
    const body = markdown.slice(start, end);
    const sections = {};
    const sectionMatches = [...body.matchAll(/^### (対象者|変わること|設定・ファイルへの影響|必要な操作|互換性上の注意)$/gm)];
    for (let sectionIndex = 0; sectionIndex < sectionMatches.length; sectionIndex += 1) {
      const sectionStart = sectionMatches[sectionIndex].index + sectionMatches[sectionIndex][0].length;
      const sectionEnd = sectionIndex + 1 < sectionMatches.length ? sectionMatches[sectionIndex + 1].index : body.length;
      const bullets = body.slice(sectionStart, sectionEnd).split("\n")
        .map((line) => line.match(/^\s*-\s+(.+)$/)?.[1]?.trim())
        .filter(Boolean);
      sections[sectionMatches[sectionIndex][1]] = bullets;
    }
    if (releases.has(matches[index][1])) duplicates.add(matches[index][1]);
    releases.set(matches[index][1], sections);
  }
  return { releases, duplicates };
}

function currentVersion(pluginRoot) {
  try {
    const manifest = readJson(join(pluginRoot, ".claude-plugin", "plugin.json"));
    return semver(manifest.version) ? manifest.version : null;
  } catch {
    return null;
  }
}

async function latestRelease(args) {
  let manifest;
  let changelog;
  let source;
  const manifestPath = args.values.get("--latest-manifest");
  const changelogPath = args.values.get("--changelog");
  if (manifestPath || changelogPath) {
    if (!manifestPath || !changelogPath) return { version: null, reason: "最新版のversionとCHANGELOGを一組で確認できませんでした。" };
    try {
      manifest = readJson(resolve(manifestPath));
      changelog = readFileSync(resolve(changelogPath), "utf8");
      source = "指定された配布情報";
    } catch {
      return { version: null, reason: "指定された最新版情報を読み取れませんでした。" };
    }
  } else if (args.flags.has("--no-network")) {
    return { version: null, reason: "ネットワーク確認を行わない指定のため、最新版は未確認です。" };
  } else {
    try {
      const [manifestResponse, changelogResponse] = await Promise.all([
        fetch(DEFAULT_MARKETPLACE_URL, { signal: AbortSignal.timeout(8000) }),
        fetch(DEFAULT_CHANGELOG_URL, { signal: AbortSignal.timeout(8000) }),
      ]);
      if (!manifestResponse.ok || !changelogResponse.ok) throw new Error("distribution fetch failed");
      manifest = await manifestResponse.json();
      changelog = await changelogResponse.text();
      source = "public配布repo";
    } catch {
      return { version: null, reason: "public配布repoへ接続できず、最新版を確認できませんでした。" };
    }
  }
  const version = marketplaceVersion(manifest);
  const parsed = parseChangelog(changelog);
  if (!version || !parsed.releases.has(version) || parsed.duplicates.has(version) || !completeRelease(parsed.releases.get(version))) {
    return { version: null, reason: "配布versionとCHANGELOGの対応を確認できないため、最新版とは判断しません。" };
  }
  return { version, sections: parsed.releases.get(version), source };
}

function sha256(path) {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

function safeLedgerFile(workspace, rel) {
  if (!isManagedPath(rel) || rel.startsWith("/") || rel.split(/[\\/]/).some((part) => !part || part === "." || part === "..")) return null;
  const target = resolve(workspace, rel);
  const relToRoot = relative(workspace, target);
  if (!relToRoot || relToRoot === ".." || relToRoot.startsWith(`..${sep}`)) return null;
  let cursor = workspace;
  for (const part of rel.split("/")) {
    cursor = join(cursor, part);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) return null;
  }
  return target;
}

function validateRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return false;
  if (Object.keys(record).some((key) => !ALLOWED_RECORD_FIELDS.has(key))) return false;
  if (Object.keys(record).length !== ALLOWED_RECORD_FIELDS.size) return false;
  if (!isManagedPath(record.path) || !semver(record.installedVersion)) return false;
  if (!/^sha256:[a-f0-9]{64}$/.test(record.baselineHash)) return false;
  if (!record.templateVariables || typeof record.templateVariables !== "object" || Array.isArray(record.templateVariables)) return false;
  for (const [name, value] of Object.entries(record.templateVariables)) {
    if (!ALLOWED_VARIABLES.has(name) || typeof value !== "string" || !value || /[\r\n]/.test(value)) return false;
    if (!VARIABLE_FORMATS[name].test(value)) return false;
    if (/(?:password|api[_-]?key|token|secret|credential)\s*[:=]/i.test(value)) return false;
  }
  return true;
}

function workspaceState(workspace) {
  const ledgerPath = resolve(workspace, LEDGER_PATH);
  const ledgerDirectory = dirname(ledgerPath);
  if (existsSync(ledgerDirectory) && lstatSync(ledgerDirectory).isSymbolicLink()) {
    return { status: "unknown-baseline", counts: { clean: 0, customized: 0, unknownBaseline: 1 }, files: [], note: "台帳directoryがsymlinkのため読み取らず、上書きしない側で扱います。" };
  }
  if (!existsSync(ledgerPath)) {
    return { status: "ledgerless", counts: { clean: 0, customized: 0, unknownBaseline: 0 }, files: [], note: "台帳がないため、未変更とは判断しません。" };
  }
  if (lstatSync(ledgerPath).isSymbolicLink()) {
    return { status: "unknown-baseline", counts: { clean: 0, customized: 0, unknownBaseline: 1 }, files: [], note: "台帳がsymlinkのため読み取らず、上書きしない側で扱います。" };
  }
  let records;
  try { records = readJson(ledgerPath); } catch {
    return { status: "unknown-baseline", counts: { clean: 0, customized: 0, unknownBaseline: 1 }, files: [], note: "台帳を安全に読み取れません。上書きしない側で扱います。" };
  }
  if (!Array.isArray(records) || records.length === 0 || records.some((record) => !validateRecord(record))) {
    return { status: "unknown-baseline", counts: { clean: 0, customized: 0, unknownBaseline: 1 }, files: [], note: "台帳の形式または項目が不明です。上書きしない側で扱います。" };
  }
  const files = records.map((record) => {
    const target = safeLedgerFile(workspace, record.path);
    if (!target) return { path: record.path, status: "unknown-baseline" };
    if (!existsSync(target) || !lstatSync(target).isFile()) return { path: record.path, status: "customized" };
    return { path: record.path, status: sha256(target) === record.baselineHash ? "clean" : "customized" };
  });
  const counts = {
    clean: files.filter((item) => item.status === "clean").length,
    customized: files.filter((item) => item.status === "customized").length,
    unknownBaseline: files.filter((item) => item.status === "unknown-baseline").length,
  };
  const status = counts.unknownBaseline ? "unknown-baseline" : counts.customized ? "customized" : "clean";
  return { status, counts, files, note: status === "clean" ? "配布時の基準hashと一致しています。" : "変更済みまたは判定不能なファイルは、将来の更新でも現状維持を既定にします。" };
}

function list(section) {
  return section?.length ? section.join(" / ") : "公開された説明を確認できませんでした。";
}

function resultStatus(current, latest) {
  if (!current) return "current-unknown";
  if (!latest.version) return "latest-unverified";
  const comparison = compareVersions(current, latest.version);
  if (comparison === 0) return "same";
  if (comparison < 0) return "update-available";
  return "latest-unverified";
}

function renderText(result) {
  const latestLabel = result.latestVersion ?? "確認できませんでした（latest-unverified）";
  const changes = result.latest?.sections ? list(result.latest.sections["変わること"]) : "最新版を確認できないため、推測では案内しません。";
  const impact = result.latest?.sections ? list(result.latest.sections["設定・ファイルへの影響"]) : "影響範囲は未確認です。";
  const action = result.latest?.sections ? list(result.latest.sections["必要な操作"]) : "ネットワークを確認して、もう一度診断してください。";
  const audience = result.latest?.sections ? list(result.latest.sections["対象者"]) : "対象者は未確認です。";
  const compatibility = result.latest?.sections ? list(result.latest.sections["互換性上の注意"]) : "互換性上の注意は未確認です。";
  return [
    "更新の確認（読み取り専用）",
    `現在版: ${result.currentVersion ?? "確認できませんでした（current-unknown）"}`,
    `最新版: ${latestLabel}`,
    `判定: ${result.status}`,
    `対象者: ${audience}`,
    `主な変更: ${changes}`,
    `設定・ファイルへの影響: ${impact}`,
    `必要な操作: ${action}`,
    `互換性上の注意: ${compatibility}`,
    `カスタマイズ衝突可能性: ${result.workspace.status}（clean=${result.workspace.counts.clean} / customized=${result.workspace.counts.customized} / unknown=${result.workspace.counts.unknownBaseline}）。${result.workspace.note}`,
    `選択結果: ${result.selectedOutcome}`,
    "選べること: 今回は確認だけ / 今回は見送る / 中止 / 実更新へ進む",
    "実更新へ進む場合: Sprint 018で対応予定です。現在の版ではplugin更新、workspace変更、migration、commit、push、reload／restartを実行せず、ここで止まります。",
    "自動更新: Claude Codeの /plugin → Marketplaces → yasashii-secretary から利用者自身で有効化できます。第三者marketplaceは既定で無効です。診断では設定を変更しません。",
    "注意: pluginが自動更新されても、workspaceへコピー済みのファイルは別管理のため自動では置き換わりません。",
  ].join("\n");
}

async function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); } catch (error) {
    process.stderr.write(`使い方エラー: ${error.message}\n`);
    process.exit(2);
  }
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const pluginRootValue = args.values.get("--plugin-root") ?? resolve(scriptDir, "..");
  const workspaceValue = args.values.get("--workspace") ?? ".";
  let pluginRoot;
  let workspace;
  try {
    pluginRoot = realpathSync(resolve(pluginRootValue));
    workspace = realpathSync(resolve(workspaceValue));
  } catch {
    process.stderr.write("pluginまたはworkspaceを読み取れないため、診断を開始できませんでした。変更は行っていません。\n");
    process.exit(3);
  }
  const current = currentVersion(pluginRoot);
  const selectedChoice = args.values.get("--choice") ?? "check-only";
  if (!SAFE_CHOICES.has(selectedChoice)) {
    process.stderr.write("--choice は check-only / decline / cancel / proceed-update から選んでください。変更は行っていません。\n");
    process.exit(2);
  }
  const latest = await latestRelease(args);
  const workspaceResult = workspaceState(workspace);
  const result = {
    mode: "diagnosis-read-only",
    selectedOutcome: selectedChoice === "proceed-update"
      ? "実更新は未実装のため停止"
      : selectedChoice === "decline"
        ? "今回は見送り"
        : selectedChoice === "cancel"
          ? "中止"
          : "今回は確認だけ",
    status: resultStatus(current, latest),
    currentVersion: current,
    latestVersion: latest.version,
    latest: latest.version ? { source: latest.source, sections: latest.sections } : { reason: latest.reason },
    workspace: workspaceResult,
    sideEffects: {
      pluginUpdate: 0,
      workspaceWrite: 0,
      migration: 0,
      commit: 0,
      push: 0,
      settingsChange: 0,
      reloadOrRestart: 0,
    },
    choices: [
      { id: "check-only", label: "今回は確認だけ", available: true },
      { id: "proceed-update", label: "実更新へ進む", available: false, reason: "Sprint 018で対応予定。この診断では実行しません。" },
    ],
  };
  process.stdout.write(args.flags.has("--json") ? `${JSON.stringify(result, null, 2)}\n` : `${renderText(result)}\n`);
}

await main();
