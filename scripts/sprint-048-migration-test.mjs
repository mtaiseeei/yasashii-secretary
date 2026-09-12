#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, cpSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const option = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};
const sourcePlugin = resolve(option("--plugin-root") || join(root, "plugins/secretary"));
const cli = join(sourcePlugin, "scripts/update-apply.mjs");
const fixtureRoot = realpathSync(mkdtempSync(join(process.env.TMPDIR || tmpdir(), "sprint048-migration-")));
const config = JSON.parse(readFileSync(join(sourcePlugin, "edition.json"), "utf8"));
const migrationRoot = join(sourcePlugin, "migrations");
const migration = JSON.parse(readFileSync(join(migrationRoot, "0.13.1-to-0.13.2.json"), "utf8"));
let pass = 0;
let fail = 0;

function check(label, condition, detail = "") {
  if (condition) { pass += 1; process.stdout.write(`PASS ${label}\n`); }
  else { fail += 1; process.stderr.write(`FAIL ${label}${detail ? ` (${detail})` : ""}\n`); }
}
function json(path, value) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`); }
function shaBytes(value) { return `sha256:${createHash("sha256").update(value).digest("hex")}`; }
function shaText(value) { return createHash("sha256").update(value.replace(/\r\n?/gu, "\n").trimEnd()).digest("hex"); }
function fileSha(path) { return shaBytes(readFileSync(path)); }
function git(cwd, args) { return execFileSync("git", args, { cwd, encoding: "utf8" }).trim(); }
function released(path) { return execFileSync("git", ["show", `v0.13.1:${path}`], { cwd: root, encoding: "utf8" }); }
// Git blobs use LF while Windows checkouts may use CRLF. Normalize only
// template/asset comparisons; workspace byte-preservation assertions stay raw.
function normalizedText(body) { return body.replace(/\r\n?/gu, "\n"); }
function count(body, needle) { return body.split(needle).length - 1; }
function onlyCrlf(body) { return body.includes("\r\n") && !body.replace(/\r\n/gu, "").includes("\n"); }

function inspectTree(pluginRoot) {
  const entries = [];
  const walk = (directory, prefix = "") => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = join(directory, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(absolute, rel);
      else entries.push({ rel, mode: lstatSync(absolute).mode & 0o777, hash: fileSha(absolute) });
    }
  };
  walk(pluginRoot);
  return { treeHash: shaBytes(JSON.stringify(entries)), fileCount: entries.length };
}

function configurePlugin(name) {
  const target = join(fixtureRoot, name);
  cpSync(sourcePlugin, target, { recursive: true });
  return target;
}

function makeWorkspace(name, pluginRoot, { crlf = false, customizeAgents = false, unknownAgents = false, secretInAgents = false } = {}) {
  const workspace = join(fixtureRoot, name);
  mkdirSync(join(workspace, "secretary/memory"), { recursive: true });
  let agentsTemplate = released("plugins/secretary/templates/AGENTS.md");
  if (customizeAgents) agentsTemplate = agentsTemplate.replace("秘書は作業のたびに、まずここを読みます。", "秘書は利用者の指定したタイミングで読みます。");
  let agents = `利用者の自由記述（前）\n${agentsTemplate}利用者の自由記述（後）${secretInAgents ? "\npassword = supersecret123" : ""}\n`;
  let claude = `利用者の自由記述（前）\n${released("plugins/secretary/templates/CLAUDE.md")}利用者の自由記述（後）\n`;
  let preferences = "# 好み・環境（preferences.md v2）\n\n## 基本\n\n- 呼び方: たいせい\n- お仕事・役割: 開発者\n\n## 言葉遣い\n\n- 口調: 利用者独自\n- 報告の詳しさ: くわしく\n\n## 秘書のメモ\n\n- この自由記述は更新しない\n";
  if (crlf) {
    agents = agents.replace(/\n/gu, "\r\n");
    claude = claude.replace(/\n/gu, "\r\n");
    preferences = preferences.replace(/\n/gu, "\r\n");
  }
  writeFileSync(join(workspace, "secretary/AGENTS.md"), agents);
  writeFileSync(join(workspace, "secretary/CLAUDE.md"), claude);
  writeFileSync(join(workspace, "secretary/memory/preferences.md"), preferences);
  writeFileSync(join(workspace, "unrelated.txt"), "利用者の管理対象外データ\n");
  chmodSync(join(workspace, "secretary/AGENTS.md"), 0o640);
  chmodSync(join(workspace, "secretary/CLAUDE.md"), 0o600);
  chmodSync(join(workspace, "secretary/memory/preferences.md"), 0o640);
  json(join(workspace, config.workspaceProtection.canonicalMarker), { schemaVersion: config.workspaceProtection.markerSchemaVersion, edition: config.edition });
  const ledgerPaths = ["secretary/AGENTS.md", "secretary/CLAUDE.md", "secretary/memory/preferences.md"];
  json(join(workspace, config.update.ledgerPath), {
    schemaVersion: 2,
    edition: config.edition,
    records: ledgerPaths.map((path) => ({ path, installedVersion: "0.13.1", baselineHash: fileSha(join(workspace, path)), templateVariables: {} })),
  });
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: workspace });
  git(workspace, ["config", "core.autocrlf", "false"]);
  git(workspace, ["config", "user.name", "Migration Fixture"]);
  git(workspace, ["config", "user.email", "migration@example.invalid"]);
  git(workspace, ["add", "."]);
  git(workspace, ["commit", "-qm", "initial"]);
  git(workspace, ["commit", "--allow-empty", "-qm", "protection 0.13.1->0.13.2"]);
  const protectionCommit = git(workspace, ["rev-parse", "HEAD"]);
  const commitCount = git(workspace, ["rev-list", "--count", "HEAD"]);
  const sessionDirectory = join(workspace, ".git", config.update.sessionDirectory);
  const backupRoot = join(sessionDirectory, "plugin-backup");
  mkdirSync(sessionDirectory, { recursive: true });
  cpSync(sourcePlugin, backupRoot, { recursive: true });
  const backupManifestPath = join(backupRoot, ".claude-plugin/plugin.json");
  const backupManifest = JSON.parse(readFileSync(backupManifestPath, "utf8"));
  backupManifest.version = "0.13.1";
  json(backupManifestPath, backupManifest);
  const backup = inspectTree(backupRoot);
  const session = {
    schemaVersion: 1,
    edition: config.edition,
    pluginId: config.distribution.pluginId,
    phase: "awaiting-reload",
    fromVersion: "0.13.1",
    toVersion: "0.13.2",
    protectionCommit,
    scope: "project",
    workspaceEditionBefore: "same-edition",
    managed: ["secretary/AGENTS.md", "secretary/CLAUDE.md"].map((path) => ({
      path,
      status: path === "secretary/AGENTS.md" && unknownAgents ? "unknown-baseline" : "clean",
      currentHash: fileSha(join(workspace, path)),
    })),
    selections: { "secretary/AGENTS.md": "replace", "secretary/CLAUDE.md": "replace" },
    pluginBackup: { directory: "plugin-backup", version: "0.13.1", scope: "project", ...backup, requiredSkills: ["secretary", "update"] },
    plugin: { updated: true, requiresReload: true },
    migration: { changedPaths: [], appliedHashes: {}, appliedOperationIds: [], contentWriteCount: 0, ledgerChanged: false, ledgerHash: null, markerChanged: false, markerHash: null },
  };
  if (unknownAgents) delete session.selections["secretary/AGENTS.md"];
  const sessionPath = join(sessionDirectory, "session.json");
  json(sessionPath, session);
  return {
    workspace, pluginRoot, sessionPath, protectionCommit, commitCount,
    before: {
      agents: readFileSync(join(workspace, "secretary/AGENTS.md")),
      claude: readFileSync(join(workspace, "secretary/CLAUDE.md")),
      preferences: readFileSync(join(workspace, "secretary/memory/preferences.md")),
      unrelated: readFileSync(join(workspace, "unrelated.txt")),
      ledger: readFileSync(join(workspace, config.update.ledgerPath)),
      marker: readFileSync(join(workspace, config.workspaceProtection.canonicalMarker)),
      modes: ledgerPaths.map((path) => lstatSync(join(workspace, path)).mode & 0o777),
    },
  };
}

function invoke(command, fixture, extra = []) {
  return spawnSync(process.execPath, [cli, command, "--host", "claude-code", "--workspace", fixture.workspace, "--plugin-root", fixture.pluginRoot, "--json", ...extra], {
    cwd: fixture.workspace,
    encoding: "utf8",
    env: { ...process.env, YASASHII_UPDATE_TEST_MODE: "fixture" },
  });
}
function parsed(result) { try { return JSON.parse(result.stdout); } catch { return {}; } }

try {
  const pluginManifest = JSON.parse(readFileSync(join(sourcePlugin, ".claude-plugin/plugin.json"), "utf8"));
  const supported = JSON.parse(readFileSync(join(migrationRoot, "supported.json"), "utf8"));
  check("migration is a nonempty 0.13.1->0.13.2 content hop", pluginManifest.version === "0.13.2" && migration.fromVersion === "0.13.1" && migration.toVersion === "0.13.2" && migration.contentChanged === true && migration.operations.length === 4);
  check("0.13.1 is a declared supported source", supported.supportedFrom.includes("0.13.1"));

  const oldTemplates = {
    "secretary/AGENTS.md": released("plugins/secretary/templates/AGENTS.md"),
    "secretary/CLAUDE.md": released("plugins/secretary/templates/CLAUDE.md"),
  };
  const currentTemplates = {
    "secretary/AGENTS.md": normalizedText(readFileSync(join(sourcePlugin, "templates/AGENTS.md"), "utf8")),
    "secretary/CLAUDE.md": normalizedText(readFileSync(join(sourcePlugin, "templates/CLAUDE.md"), "utf8")),
  };
  check("declared template fingerprints come from the published 0.13.1 tag", migration.operations.every((operation) => operation.templateFingerprint === shaText(oldTemplates[operation.path])));
  check("immutable old assets and current assets are exact unique template sections", migration.operations.every((operation) => {
    const oldAsset = normalizedText(readFileSync(join(migrationRoot, operation.oldAsset), "utf8")).trimEnd();
    const newAsset = normalizedText(readFileSync(join(migrationRoot, operation.asset), "utf8")).trimEnd();
    return operation.oldAssetSha256 === shaText(oldAsset)
      && count(oldTemplates[operation.path], oldAsset) === 1
      && count(currentTemplates[operation.path], newAsset) === 1
      && !oldAsset.includes("{{") && !newAsset.includes("{{");
  }));
  const migratedTemplates = { ...oldTemplates };
  for (const operation of migration.operations) {
    const oldAsset = normalizedText(readFileSync(join(migrationRoot, operation.oldAsset), "utf8")).trimEnd();
    const newAsset = normalizedText(readFileSync(join(migrationRoot, operation.asset), "utf8")).trimEnd();
    migratedTemplates[operation.path] = migratedTemplates[operation.path].replace(oldAsset, newAsset);
  }
  check("the four operations reproduce the full current AGENTS and CLAUDE templates", Object.keys(currentTemplates).every((path) => migratedTemplates[path] === currentTemplates[path]));

  const edges = readdirSync(migrationRoot).map((file) => file.match(/^(\d+\.\d+\.\d+)-to-(\d+\.\d+\.\d+)\.json$/u)).filter(Boolean).map((match) => [match[1], match[2]]);
  const reachesCurrent = (source) => {
    const seen = new Set([source]);
    const queue = [source];
    while (queue.length) {
      const from = queue.shift();
      if (from === "0.13.2") return true;
      for (const [edgeFrom, edgeTo] of edges) if (edgeFrom === from && !seen.has(edgeTo)) { seen.add(edgeTo); queue.push(edgeTo); }
    }
    return false;
  };
  check("every declared published source has a finite graph path to 0.13.2", supported.supportedFrom.every(reachesCurrent));

  for (const crlf of [false, true]) {
    const fixture = makeWorkspace(`apply-${crlf ? "crlf" : "lf"}`, configurePlugin(`plugin-${crlf ? "crlf" : "lf"}`), { crlf });
    const dry = invoke("resume", fixture);
    const plan = parsed(dry).plan;
    check(`${crlf ? "CRLF" : "LF"} preview is deterministic and writes no workspace content`, dry.status === 0 && plan?.versionPath?.join("->") === "0.13.1->0.13.2" && plan?.contentWriteCount === 4 && readFileSync(join(fixture.workspace, "secretary/AGENTS.md")).equals(fixture.before.agents) && readFileSync(join(fixture.workspace, "secretary/CLAUDE.md")).equals(fixture.before.claude) && git(fixture.workspace, ["status", "--porcelain"]) === "");
    const applied = invoke("resume", fixture, ["--apply", "--plan-hash", plan?.planHash ?? "missing"]);
    const appliedData = parsed(applied);
    const afterAgents = readFileSync(join(fixture.workspace, "secretary/AGENTS.md"), "utf8");
    const afterClaude = readFileSync(join(fixture.workspace, "secretary/CLAUDE.md"), "utf8");
    const oldClaudeProgress = readFileSync(join(migrationRoot, "assets/claude-progress-report-v1.md"), "utf8").trimEnd().replace(/\n/gu, crlf ? "\r\n" : "\n");
    check(`${crlf ? "CRLF" : "LF"} apply changes exactly four known sections`, applied.status === 0 && appliedData.contentWriteCount === 4 && afterAgents.includes("新しいsessionまたは作業対象が変わったときに読み") && afterAgents.includes("複数のsource・toolを使う長いread-only作業") && afterAgents.includes("個人設定を反映する応答または設定変更時だけ") && afterClaude.includes("長いread-only作業では節目の進捗を示します") && !afterAgents.includes("毎セッション、作業前に") && !afterClaude.includes(oldClaudeProgress));
    const changedPaths = git(fixture.workspace, ["diff", "--name-only"]).split("\n").filter(Boolean).sort();
    const expectedChangedPaths = [config.update.ledgerPath, "secretary/AGENTS.md", "secretary/CLAUDE.md"].sort();
    check(`${crlf ? "CRLF" : "LF"} freeform, preferences, unrelated data, and modes are preserved`, afterAgents.startsWith(crlf ? "利用者の自由記述（前）\r\n" : "利用者の自由記述（前）\n") && afterAgents.endsWith(crlf ? "利用者の自由記述（後）\r\n" : "利用者の自由記述（後）\n") && readFileSync(join(fixture.workspace, "secretary/memory/preferences.md")).equals(fixture.before.preferences) && readFileSync(join(fixture.workspace, "unrelated.txt")).equals(fixture.before.unrelated) && JSON.stringify(changedPaths) === JSON.stringify(expectedChangedPaths) && (process.platform === "win32" || fixture.before.modes.every((mode, index) => mode === (lstatSync(join(fixture.workspace, ["secretary/AGENTS.md", "secretary/CLAUDE.md", "secretary/memory/preferences.md"][index])).mode & 0o777))));
    check(`${crlf ? "CRLF" : "LF"} line endings stay uniform`, crlf ? onlyCrlf(afterAgents) && onlyCrlf(afterClaude) : !afterAgents.includes("\r") && !afterClaude.includes("\r"));
    const beforeRerun = [readFileSync(join(fixture.workspace, "secretary/AGENTS.md")), readFileSync(join(fixture.workspace, "secretary/CLAUDE.md")), git(fixture.workspace, ["rev-list", "--count", "HEAD"])];
    const rerun = invoke("resume", fixture);
    check(`${crlf ? "CRLF" : "LF"} rerun adds no content write, duplicate section, or checkpoint`, rerun.status === 0 && parsed(rerun).migrationCount === 0 && readFileSync(join(fixture.workspace, "secretary/AGENTS.md")).equals(beforeRerun[0]) && readFileSync(join(fixture.workspace, "secretary/CLAUDE.md")).equals(beforeRerun[1]) && git(fixture.workspace, ["rev-list", "--count", "HEAD"]) === beforeRerun[2] && count(afterAgents, "新しいsessionまたは作業対象が変わったときに読み") === 1);
    const rolled = invoke("rollback", fixture);
    const rolledData = parsed(rolled);
    check(`${crlf ? "CRLF" : "LF"} rollback restores managed files and ledger without touching preferences`, rolled.status === 0 && rolledData.workspaceRestored === true && rolledData.pluginRestored === true && readFileSync(join(fixture.workspace, "secretary/AGENTS.md")).equals(fixture.before.agents) && readFileSync(join(fixture.workspace, "secretary/CLAUDE.md")).equals(fixture.before.claude) && readFileSync(join(fixture.workspace, "secretary/memory/preferences.md")).equals(fixture.before.preferences) && readFileSync(join(fixture.workspace, config.update.ledgerPath)).equals(fixture.before.ledger) && readFileSync(join(fixture.workspace, config.workspaceProtection.canonicalMarker)).equals(fixture.before.marker) && git(fixture.workspace, ["rev-list", "--count", "HEAD"]) === fixture.commitCount);
  }

  const partial = makeWorkspace("partial", configurePlugin("plugin-partial"));
  const partialPlan = parsed(invoke("resume", partial)).plan;
  const interrupted = invoke("resume", partial, ["--apply", "--plan-hash", partialPlan.planHash, "--test-fail-after", "workspace-write"]);
  const interruptedSession = JSON.parse(readFileSync(partial.sessionPath, "utf8"));
  const resumed = invoke("resume", partial, ["--apply", "--plan-hash", partialPlan.planHash]);
  const resumedSession = JSON.parse(readFileSync(partial.sessionPath, "utf8"));
  check("partial apply resumes from its recorded operation without duplicate writes", interrupted.status === 4 && interruptedSession.migration.contentWriteCount === 1 && resumed.status === 0 && resumedSession.migration.contentWriteCount === 4 && count(readFileSync(join(partial.workspace, "secretary/AGENTS.md"), "utf8"), "新しいsessionまたは作業対象が変わったときに読み") === 1);
  const partialRollback = invoke("rollback", partial);
  check("partial retry retains complete rollback ownership", partialRollback.status === 0 && readFileSync(join(partial.workspace, "secretary/AGENTS.md")).equals(partial.before.agents) && readFileSync(join(partial.workspace, "secretary/CLAUDE.md")).equals(partial.before.claude) && readFileSync(join(partial.workspace, "secretary/memory/preferences.md")).equals(partial.before.preferences));

  const customized = makeWorkspace("customized", configurePlugin("plugin-customized"), { customizeAgents: true });
  const customizedBefore = readFileSync(join(customized.workspace, "secretary/AGENTS.md"));
  const customizedPlan = parsed(invoke("resume", customized)).plan;
  const customizedApply = invoke("resume", customized, ["--apply", "--plan-hash", customizedPlan.planHash]);
  check("one customized old section keeps the whole AGENTS path while independent CLAUDE migration proceeds", customizedApply.status === 0 && customizedPlan.items.filter((item) => item.path === "secretary/AGENTS.md").every((item) => item.action === "keep") && readFileSync(join(customized.workspace, "secretary/AGENTS.md")).equals(customizedBefore) && readFileSync(join(customized.workspace, "secretary/CLAUDE.md"), "utf8").includes("長いread-only作業では節目の進捗を示します"));

  const unknown = makeWorkspace("unknown", configurePlugin("plugin-unknown"), { unknownAgents: true });
  const unknownBefore = readFileSync(join(unknown.workspace, "secretary/AGENTS.md"));
  const unknownPlan = parsed(invoke("resume", unknown)).plan;
  const unknownApply = invoke("resume", unknown, ["--apply", "--plan-hash", unknownPlan.planHash]);
  check("unknown-baseline defaults to keep with no AGENTS write", unknownApply.status === 0 && unknownPlan.items.filter((item) => item.path === "secretary/AGENTS.md").every((item) => item.action === "keep") && readFileSync(join(unknown.workspace, "secretary/AGENTS.md")).equals(unknownBefore));

  const stale = makeWorkspace("stale", configurePlugin("plugin-stale"));
  const stalePlan = parsed(invoke("resume", stale)).plan;
  writeFileSync(join(stale.workspace, "secretary/AGENTS.md"), `${readFileSync(join(stale.workspace, "secretary/AGENTS.md"), "utf8")}dry-run後の利用者編集\n`);
  const staleExpected = readFileSync(join(stale.workspace, "secretary/AGENTS.md"));
  const staleApply = invoke("resume", stale, ["--apply", "--plan-hash", stalePlan.planHash]);
  check("stale plan refuses before a migration write", staleApply.status === 3 && readFileSync(join(stale.workspace, "secretary/AGENTS.md")).equals(staleExpected) && readFileSync(join(stale.workspace, "secretary/CLAUDE.md")).equals(stale.before.claude));

  const wrongEdition = makeWorkspace("wrong-edition", configurePlugin("plugin-wrong-edition"));
  json(join(wrongEdition.workspace, config.workspaceProtection.canonicalMarker), { schemaVersion: config.workspaceProtection.markerSchemaVersion, edition: "other-edition" });
  const wrongEditionResult = invoke("resume", wrongEdition);
  check("wrong edition refuses with zero managed or preference writes", wrongEditionResult.status === 3 && readFileSync(join(wrongEdition.workspace, "secretary/AGENTS.md")).equals(wrongEdition.before.agents) && readFileSync(join(wrongEdition.workspace, "secretary/CLAUDE.md")).equals(wrongEdition.before.claude) && readFileSync(join(wrongEdition.workspace, "secretary/memory/preferences.md")).equals(wrongEdition.before.preferences));

  const secret = makeWorkspace("secret", configurePlugin("plugin-secret"), { secretInAgents: true });
  const secretPlan = parsed(invoke("resume", secret)).plan;
  const secretApply = invoke("resume", secret, ["--apply", "--plan-hash", secretPlan.planHash]);
  check("Secret-like managed content is preserved and refused before writes", secretApply.status === 3 && readFileSync(join(secret.workspace, "secretary/AGENTS.md")).equals(secret.before.agents) && readFileSync(join(secret.workspace, "secretary/CLAUDE.md")).equals(secret.before.claude) && !secretApply.stderr.includes("supersecret123"));
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

process.stdout.write(`SPRINT048_MIGRATION_PASS=${pass} SPRINT048_MIGRATION_FAIL=${fail}\n`);
process.exitCode = fail ? 1 : 0;
