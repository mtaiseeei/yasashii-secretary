#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePlugin = join(repo, "plugins/secretary");
const applyCli = join(sourcePlugin, "scripts/update-apply.mjs");
const temporaryRoot = mkdtempSync(join(process.env.TMPDIR || tmpdir(), "sprint030-update-config-"));
const configValues = {
  pluginId: "fixture-secretary@fixture-marketplace",
  marketplaceId: "fixture-marketplace",
  ledgerPath: ".fixture-ledger/update.json",
  legacyLedgerPath: ".fixture-legacy/update.json",
  sessionDirectory: "fixture-update-session",
  protectionPrefix: "[fixture-secretary]",
};
let pass = 0;
let fail = 0;

function check(label, condition, detail = "") {
  if (condition) { pass += 1; process.stdout.write(`PASS ${label}\n`); }
  else { fail += 1; process.stderr.write(`FAIL ${label}${detail ? ` (${detail})` : ""}\n`); }
}

function run(binary, args, cwd, env = {}) {
  return spawnSync(binary, args, { cwd, encoding: "utf8", env: { ...process.env, ...env } });
}

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function json(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function digest(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function configurePlugin(target, version) {
  cpSync(sourcePlugin, target, { recursive: true, errorOnExist: true });
  const editionPath = join(target, "edition.json");
  const edition = JSON.parse(readFileSync(editionPath, "utf8"));
  edition.distribution.pluginId = configValues.pluginId;
  edition.distribution.marketplaceId = configValues.marketplaceId;
  edition.update.ledgerPath = configValues.ledgerPath;
  edition.update.legacyLedgerPaths = [configValues.legacyLedgerPath];
  edition.update.sessionDirectory = configValues.sessionDirectory;
  edition.update.protectionCommitPrefix = configValues.protectionPrefix;
  json(editionPath, edition);
  const manifestPath = join(target, ".claude-plugin/plugin.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.name = configValues.pluginId.split("@")[0];
  manifest.version = version;
  json(manifestPath, manifest);
}

function workspace(name, { ledger = true } = {}) {
  const root = join(temporaryRoot, name);
  mkdirSync(join(root, "secretary/memory"), { recursive: true });
  writeFileSync(join(root, "secretary/AGENTS.md"), "# fixture AGENTS\n");
  writeFileSync(join(root, "secretary/CLAUDE.md"), "@AGENTS.md\n");
  writeFileSync(join(root, "secretary/memory/MEMORY.md"), "# memory\n");
  writeFileSync(join(root, "secretary/memory/preferences.md"), "# preferences\n");
  json(join(root, ".secretary/workspace-edition.json"), { schemaVersion: 1, edition: "yasashii-secretary" });
  if (ledger) {
    const records = ["secretary/AGENTS.md", "secretary/CLAUDE.md"].map((path) => ({
      path,
      installedVersion: "0.6.0",
      baselineHash: `sha256:${digest(join(root, path))}`,
      templateVariables: {},
    }));
    json(join(root, configValues.ledgerPath), { schemaVersion: 2, edition: "yasashii-secretary", records });
  }
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: root });
  git(root, ["config", "user.name", "Sprint 030 config fixture"]);
  git(root, ["config", "user.email", "sprint030-config@example.invalid"]);
  git(root, ["add", "."]);
  git(root, ["commit", "-qm", "fixture initial"]);
  return root;
}

function apply(command, cwd, pluginRoot, extra = [], env = {}) {
  const args = [applyCli, command, "--workspace", cwd, "--json"];
  if (command === "start") {
    args.push("--current-plugin-root", pluginRoot, "--latest-manifest", latestManifest, "--changelog", join(sourcePlugin, "CHANGELOG.md"), "--claude-binary", mock);
  } else {
    args.push("--plugin-root", pluginRoot);
    if (command === "retry-plugin") args.push("--claude-binary", mock);
  }
  args.push(...extra);
  return run(process.execPath, args, cwd, {
    YASASHII_UPDATE_TEST_MODE: "fixture",
    CLAUDE_FIXTURE_LOG: commandLog,
    ...env,
  });
}

const currentPlugin = join(temporaryRoot, "plugin-0.6.0");
const targetPlugin = join(temporaryRoot, "plugin-0.7.0");
configurePlugin(currentPlugin, "0.6.0");
configurePlugin(targetPlugin, "0.7.0");
const latestManifest = join(temporaryRoot, "marketplace.json");
json(latestManifest, { plugins: [{ name: configValues.marketplaceId, version: "0.7.0" }] });
const commandLog = join(temporaryRoot, "claude.log");
const mock = join(temporaryRoot, "claude-fixture");
writeFileSync(mock, `#!/bin/sh\nprintf '%s\\n' "$*" >> "$CLAUDE_FIXTURE_LOG"\ncase "$*" in *"$CLAUDE_FIXTURE_FAIL"*) [ -n "$CLAUDE_FIXTURE_FAIL" ] && exit 9;; esac\nexit 0\n`);
chmodSync(mock, 0o700);

try {
  const failedWorkspace = workspace("retry");
  const failedStart = apply("start", failedWorkspace, currentPlugin, ["--consent", "update-approved"], { CLAUDE_FIXTURE_FAIL: "plugin update" });
  const canonicalSession = join(failedWorkspace, ".git", configValues.sessionDirectory, "session.json");
  check("startは宣言session directoryだけへ保存", failedStart.status === 4 && existsSync(canonicalSession) && !existsSync(join(failedWorkspace, ".git/secretary-update")) && !existsSync(join(failedWorkspace, ".git/yasashii-secretary-update")), failedStart.stderr);
  check("startは宣言保護commit prefixを使用", git(failedWorkspace, ["log", "-1", "--format=%s"]).startsWith(configValues.protectionPrefix));
  const retry = apply("retry-plugin", failedWorkspace, currentPlugin);
  check("canonical-only sessionからretry-plugin", retry.status === 0 && JSON.parse(readFileSync(canonicalSession, "utf8")).phase === "awaiting-reload", retry.stderr);

  const updateWorkspace = workspace("resume-rollback");
  const started = apply("start", updateWorkspace, currentPlugin, ["--consent", "update-approved"]);
  const dry = apply("resume", updateWorkspace, targetPlugin);
  const planHash = JSON.parse(dry.stdout).plan.planHash;
  const applied = apply("resume", updateWorkspace, targetPlugin, ["--apply", "--plan-hash", planHash]);
  const ledgerPath = join(updateWorkspace, configValues.ledgerPath);
  const ledgerValue = JSON.parse(readFileSync(ledgerPath, "utf8"));
  check("canonical-only sessionからresume", started.status === 0 && dry.status === 0 && applied.status === 0, `${started.stderr}${dry.stderr}${applied.stderr}`);
  check("schema2 canonical ledgerを更新・検証", ledgerValue.schemaVersion === 2 && ledgerValue.edition === "yasashii-secretary" && ledgerValue.records.every((record) => record.installedVersion === "0.7.0") && JSON.parse(applied.stdout).verification?.checks?.ledger === true);
  check("legacy ledger pathへの新規書込み0件", !existsSync(join(updateWorkspace, configValues.legacyLedgerPath)) && !existsSync(join(updateWorkspace, ".yasashii-secretary/update-ledger.json")));
  const rolledBack = apply("rollback", updateWorkspace, targetPlugin);
  const restoredLedger = JSON.parse(readFileSync(ledgerPath, "utf8"));
  check("canonical-only sessionからrollback", rolledBack.status === 0 && JSON.parse(rolledBack.stdout).workspaceRestored === true && JSON.parse(rolledBack.stdout).pluginRestored === true && restoredLedger.records.every((record) => record.installedVersion === "0.6.0"), rolledBack.stderr);

  const commands = readFileSync(commandLog, "utf8").trim().split("\n");
  check("fixture固有distribution IDを全plugin commandへ反映", commands.some((line) => line === `plugin marketplace update ${configValues.marketplaceId}`) && commands.some((line) => line === `plugin update ${configValues.pluginId} --scope user`));

  const unsafeLedger = workspace("unsafe-ledger", { ledger: false });
  json(join(unsafeLedger, configValues.ledgerPath), { schemaVersion: 9, edition: "yasashii-secretary", records: [] });
  json(join(unsafeLedger, configValues.legacyLedgerPath), []);
  git(unsafeLedger, ["add", "."]); git(unsafeLedger, ["commit", "-qm", "unsafe ledgers"]);
  const unsafeBefore = `${digest(join(unsafeLedger, configValues.ledgerPath))}:${digest(join(unsafeLedger, configValues.legacyLedgerPath))}:${git(unsafeLedger, ["rev-parse", "HEAD"])}`;
  const refusedLedger = apply("start", unsafeLedger, currentPlugin, ["--no-network"]);
  const unsafeAfter = `${digest(join(unsafeLedger, configValues.ledgerPath))}:${digest(join(unsafeLedger, configValues.legacyLedgerPath))}:${git(unsafeLedger, ["rev-parse", "HEAD"])}`;
  check("canonical/legacy不整合はbyte不変で停止", refusedLedger.status === 3 && unsafeBefore === unsafeAfter);

  const unsafeSession = workspace("unsafe-session");
  const outside = join(temporaryRoot, "outside-session");
  mkdirSync(outside);
  symlinkSync(outside, join(unsafeSession, ".git", configValues.sessionDirectory));
  const outsideBefore = existsSync(join(outside, "session.json"));
  const refusedSession = apply("resume", unsafeSession, currentPlugin);
  check("宣言session directory symlinkは外部byte不変で停止", refusedSession.status === 3 && outsideBefore === existsSync(join(outside, "session.json")) && lstatSync(join(unsafeSession, ".git", configValues.sessionDirectory)).isSymbolicLink());
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

process.stdout.write(`SPRINT030_UPDATE_CONFIG_PASS=${pass} SPRINT030_UPDATE_CONFIG_FAIL=${fail}\n`);
process.exit(fail ? 1 : 0);
