#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const candidatePlugin = join(root, "plugins/secretary");
const candidateManifest = join(root, ".claude-plugin/marketplace.json");
const candidateChangelog = join(candidatePlugin, "CHANGELOG.md");
const legacyChangelog = join(root, "plugins/yasashii-secretary/CHANGELOG.md");
const guardCli = join(candidatePlugin, "scripts/edition-guard.mjs");
const ledgerCli = join(candidatePlugin, "scripts/update-ledger.mjs");
const diagnoseCli = join(candidatePlugin, "scripts/update-diagnose.mjs");
const applyCli = join(candidatePlugin, "scripts/update-apply.mjs");
const safeTemporaryBase = existsSync("/private/tmp") ? "/private/tmp" : tmpdir();
const temporaryRoot = mkdtempSync(join(safeTemporaryBase, "sprint032-release-"));
let pass = 0;
let fail = 0;

function check(label, condition, detail = "") {
  if (condition) {
    pass += 1;
    process.stdout.write(`PASS ${label}\n`);
  } else {
    fail += 1;
    process.stderr.write(`FAIL ${label}${detail ? ` (${detail})` : ""}\n`);
  }
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

function hashBytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

function treeDigest(directory, { excludeGit = true } = {}) {
  const entries = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = join(current, entry.name);
      const rel = relative(directory, absolute).split("\\").join("/");
      if (excludeGit && (rel === ".git" || rel.startsWith(".git/"))) continue;
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) entries.push(`${hashBytes(readFileSync(absolute))}  ${rel}`);
      else entries.push(`non-file  ${rel}`);
    }
  };
  walk(directory);
  return hashBytes(entries.join("\n"));
}

function workspaceSnapshot(workspace) {
  return {
    files: treeDigest(workspace),
    head: git(workspace, ["rev-parse", "HEAD"]),
    index: git(workspace, ["ls-files", "-s"]),
    status: git(workspace, ["status", "--porcelain=v1", "--untracked-files=all"]),
  };
}

function manifestVersion(pluginRoot) {
  return JSON.parse(readFileSync(join(pluginRoot, ".claude-plugin/plugin.json"), "utf8")).version;
}

function parse(result) {
  try { return JSON.parse(result.stdout); } catch { return {}; }
}

function initializeGit(workspace, message) {
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: workspace });
  git(workspace, ["config", "user.name", "Sprint 032 fixture"]);
  git(workspace, ["config", "user.email", "sprint032@example.invalid"]);
  git(workspace, ["add", "."]);
  git(workspace, ["commit", "--allow-empty", "-qm", message]);
}

function findPublished070Revision() {
  const revisions = git(root, ["rev-list", "HEAD"]).split("\n").filter(Boolean);
  for (const revision of revisions) {
    const shown = run("git", ["show", `${revision}:plugins/yasashii-secretary/.claude-plugin/plugin.json`], root);
    if (shown.status !== 0) continue;
    try {
      if (JSON.parse(shown.stdout).version === "0.7.0") return revision;
    } catch { /* continue */ }
  }
  throw new Error("公開0.7.0 pluginをGit履歴から確認できません。");
}

function extractPublished070() {
  const revision = findPublished070Revision();
  const archive = join(temporaryRoot, "published-070.tar");
  execFileSync("git", ["archive", "--format=tar", `--output=${archive}`, revision, "plugins/yasashii-secretary"], { cwd: root });
  const checkout = join(temporaryRoot, "published-070");
  mkdirSync(checkout);
  execFileSync("tar", ["-xf", archive, "-C", checkout]);
  const pluginRoot = join(checkout, "plugins/yasashii-secretary");
  if (manifestVersion(pluginRoot) !== "0.7.0") throw new Error("Git履歴のpluginが0.7.0ではありません。");
  return { revision, pluginRoot };
}

function releaseSection(text, version) {
  const start = text.indexOf(`## [${version}]`);
  if (start < 0) return null;
  const next = text.indexOf("\n## [", start + 4);
  return text.slice(start, next < 0 ? undefined : next).trimEnd();
}

function createFresh080Workspace() {
  const workspace = join(temporaryRoot, "fresh-080");
  mkdirSync(workspace);
  initializeGit(workspace, "empty workspace");

  const prepared = run(process.execPath, [
    guardCli,
    "--workspace", workspace,
    "--plugin-root", candidatePlugin,
    "--entry", "onboarding",
    "--prepare-new",
    "--json",
  ], workspace);

  mkdirSync(join(workspace, "secretary/memory/decisions"), { recursive: true });
  mkdirSync(join(workspace, ".github/workflows"), { recursive: true });
  mkdirSync(join(workspace, "chatwork/scripts"), { recursive: true });
  cpSync(join(candidatePlugin, "templates/AGENTS.md"), join(workspace, "secretary/AGENTS.md"));
  cpSync(join(candidatePlugin, "templates/CLAUDE.md"), join(workspace, "secretary/CLAUDE.md"));
  cpSync(join(candidatePlugin, "templates/memory/MEMORY.md"), join(workspace, "secretary/memory/MEMORY.md"));
  cpSync(join(candidatePlugin, "templates/memory/preferences.md"), join(workspace, "secretary/memory/preferences.md"));
  cpSync(join(candidatePlugin, "templates/memory/decisions/_first-decision.md"), join(workspace, "secretary/memory/decisions/2026-07-20-decisions.md"));
  cpSync(join(candidatePlugin, "workspace-templates/.github/workflows/chatwork-sync.yml"), join(workspace, ".github/workflows/chatwork-sync.yml"));
  cpSync(join(candidatePlugin, "workspace-templates/chatwork/config.json"), join(workspace, "chatwork/config.json"));
  cpSync(join(candidatePlugin, "workspace-templates/chatwork/rooms.json"), join(workspace, "chatwork/rooms.json"));
  cpSync(join(candidatePlugin, "workspace-templates/chatwork/scripts/chatwork-sync.mjs"), join(workspace, "chatwork/scripts/chatwork-sync.mjs"));

  const managed = [
    "secretary/AGENTS.md",
    "secretary/CLAUDE.md",
    "secretary/memory/MEMORY.md",
    "secretary/memory/preferences.md",
    "secretary/memory/decisions/2026-07-20-decisions.md",
    ".github/workflows/chatwork-sync.yml",
    "chatwork/config.json",
    "chatwork/rooms.json",
    "chatwork/scripts/chatwork-sync.mjs",
  ];
  const ledger = run(process.execPath, [
    ledgerCli,
    "init",
    "--workspace", workspace,
    "--plugin-root", candidatePlugin,
    ...managed.flatMap((path) => ["--managed-path", path]),
    "--template-variable", "CREATED_DATE=2026-07-20",
    "--template-variable", "CREATED_AT=2026-07-20 12:00",
    "--template-variable", "REPORT_DETAIL=みじかく",
    "--new-install",
    "--confirm",
  ], workspace);
  git(workspace, ["add", "."]);
  git(workspace, ["commit", "-qm", "fresh 0.8.0 install"]);
  return { workspace, prepared, ledger, managed };
}

function fixtureClaude() {
  const path = join(temporaryRoot, "claude-fixture");
  writeFileSync(path, "#!/bin/sh\nexit 0\n");
  chmodSync(path, 0o700);
  return path;
}

function createPublished070BlockerWorkspace(oldPlugin) {
  const workspace = join(temporaryRoot, "published-070-blocker");
  mkdirSync(join(workspace, "secretary/memory"), { recursive: true });
  mkdirSync(join(workspace, "google-chat/scripts"), { recursive: true });
  cpSync(join(oldPlugin, "templates/AGENTS.md"), join(workspace, "secretary/AGENTS.md"));
  cpSync(join(oldPlugin, "templates/CLAUDE.md"), join(workspace, "secretary/CLAUDE.md"));
  cpSync(join(oldPlugin, "skills/google-chat/scripts/continuous-sync.mjs"), join(workspace, "google-chat/scripts/continuous-sync.mjs"));
  cpSync(join(oldPlugin, "skills/google-chat/scripts/refresh-token.mjs"), join(workspace, "google-chat/scripts/refresh-token.mjs"));
  json(join(workspace, ".yasashii-secretary/update-ledger.json"), [
    {
      path: "secretary/AGENTS.md",
      installedVersion: "0.7.0",
      baselineHash: `sha256:${hashBytes(readFileSync(join(workspace, "secretary/AGENTS.md")))}`,
      templateVariables: {},
    },
    {
      path: "secretary/CLAUDE.md",
      installedVersion: "0.7.0",
      baselineHash: `sha256:${hashBytes(readFileSync(join(workspace, "secretary/CLAUDE.md")))}`,
      templateVariables: {},
    },
  ]);
  initializeGit(workspace, "published 0.7.0 standard Google Chat workspace");
  return workspace;
}

try {
  const published = extractPublished070();
  const market = JSON.parse(readFileSync(candidateManifest, "utf8"));
  const pluginManifest = JSON.parse(readFileSync(join(candidatePlugin, ".claude-plugin/plugin.json"), "utf8"));
  const edition = JSON.parse(readFileSync(join(candidatePlugin, "edition.json"), "utf8"));

  check("公開0.7.0 implementationをGit履歴から分離取得", published.revision.length === 40 && manifestVersion(published.pluginRoot) === "0.7.0");
  check("marketplace/pluginは0.8.0で一致", market.plugins?.[0]?.version === "0.8.0" && pluginManifest.version === "0.8.0");
  check("canonical/legacy CHANGELOGは0.8.0先頭かつbyte一致", readFileSync(candidateChangelog).equals(readFileSync(legacyChangelog)) && readFileSync(candidateChangelog, "utf8").startsWith("# 変更履歴\n\n## [0.8.0]"));
  check("editionのcandidate/latest参照は0.8.0配布面と整合", edition.edition === "yasashii-secretary" && edition.distribution.marketplaceUrl.includes("yasashii-secretary") && edition.distribution.changelogUrl.endsWith("/plugins/yasashii-secretary/CHANGELOG.md"));

  const oldChangelog = readFileSync(join(published.pluginRoot, "CHANGELOG.md"), "utf8");
  const oldMigration = readFileSync(join(published.pluginRoot, "migrations/0.6.0-to-0.7.0.json"));
  check("0.7.0 CHANGELOG entryは公開履歴から不変", releaseSection(readFileSync(candidateChangelog, "utf8"), "0.7.0") === releaseSection(oldChangelog, "0.7.0"));
  check("0.6.0→0.7.0 migration fixtureは公開履歴から不変", oldMigration.equals(readFileSync(join(candidatePlugin, "migrations/0.6.0-to-0.7.0.json"))));

  const migration080 = JSON.parse(readFileSync(join(candidatePlugin, "migrations/0.7.0-to-0.8.0.json"), "utf8"));
  check("0.8.0 migration metadataはversion整合しbootstrapを持たない", migration080.fromVersion === "0.7.0" && migration080.toVersion === "0.8.0" && Array.isArray(migration080.operations) && migration080.operations.length === 0);

  const fresh = createFresh080Workspace();
  const marker = JSON.parse(readFileSync(join(fresh.workspace, ".secretary/workspace-edition.json"), "utf8"));
  const ledgerPath = join(fresh.workspace, ".secretary/update-ledger.json");
  const ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, "utf8")) : {};
  check("新規0.8.0 onboardingはneutral markerを作る", fresh.prepared.status === 0 && marker.schemaVersion === 1 && marker.edition === "yasashii-secretary", fresh.prepared.stderr);
  check("新規0.8.0導入はedition付きledgerを作る", fresh.ledger.status === 0 && ledger.schemaVersion === 2 && ledger.edition === "yasashii-secretary" && ledger.records?.length === fresh.managed.length && ledger.records.every((record) => record.installedVersion === "0.8.0"), `${fresh.ledger.stderr}${fresh.ledger.stdout}`);
  check("新規0.8.0配布物は主要skillと両wizardを含む", [
    "skills/secretary/SKILL.md",
    "skills/onboarding/SKILL.md",
    "skills/update/SKILL.md",
    "skills/chatwork/assets/wizard/index.html",
    "skills/google-chat/assets/wizard/app.js",
  ].every((path) => existsSync(join(candidatePlugin, path))));

  const sameBefore = workspaceSnapshot(fresh.workspace);
  const same = run(process.execPath, [diagnoseCli, "--workspace", fresh.workspace, "--plugin-root", candidatePlugin, "--latest-manifest", candidateManifest, "--changelog", legacyChangelog, "--choice", "check-only", "--json"], fresh.workspace);
  const sameStart = run(process.execPath, [applyCli, "start", "--workspace", fresh.workspace, "--current-plugin-root", candidatePlugin, "--latest-manifest", candidateManifest, "--changelog", legacyChangelog, "--consent", "update-approved", "--json"], fresh.workspace, { YASASHII_UPDATE_TEST_MODE: "fixture" });
  check("0.8.0→0.8.0はCTAなし・副作用0", same.status === 0 && parse(same).status === "same" && parse(same).choices?.find((item) => item.id === "proceed-update")?.available === false && sameStart.status === 0 && JSON.stringify(workspaceSnapshot(fresh.workspace)) === JSON.stringify(sameBefore), `${same.stderr}${same.stdout}${sameStart.stderr}${sameStart.stdout}`);

  const downgradeManifest = join(temporaryRoot, "downgrade-marketplace.json");
  const oldMarket = structuredClone(market);
  oldMarket.plugins[0].version = "0.7.0";
  json(downgradeManifest, oldMarket);
  const downgradeBefore = workspaceSnapshot(fresh.workspace);
  const downgrade = run(process.execPath, [diagnoseCli, "--workspace", fresh.workspace, "--plugin-root", candidatePlugin, "--latest-manifest", downgradeManifest, "--changelog", legacyChangelog, "--choice", "check-only", "--json"], fresh.workspace);
  const downgradeStart = run(process.execPath, [applyCli, "start", "--workspace", fresh.workspace, "--current-plugin-root", candidatePlugin, "--latest-manifest", downgradeManifest, "--changelog", legacyChangelog, "--consent", "update-approved", "--json"], fresh.workspace, { YASASHII_UPDATE_TEST_MODE: "fixture" });
  check("0.8.0→0.7.0はdowngrade-blocked・副作用0", downgrade.status === 0 && parse(downgrade).status === "downgrade-blocked" && parse(downgrade).choices?.find((item) => item.id === "proceed-update")?.available === false && downgradeStart.status === 0 && JSON.stringify(workspaceSnapshot(fresh.workspace)) === JSON.stringify(downgradeBefore), `${downgrade.stderr}${downgrade.stdout}${downgradeStart.stderr}${downgradeStart.stdout}`);

  const blockerWorkspace = createPublished070BlockerWorkspace(published.pluginRoot);
  const installed070 = join(temporaryRoot, "installed-070-plugin");
  cpSync(published.pluginRoot, installed070, { recursive: true });
  const blockerBefore = workspaceSnapshot(blockerWorkspace);
  const blocked = run(process.execPath, [
    join(published.pluginRoot, "scripts/update-apply.mjs"),
    "start",
    "--workspace", blockerWorkspace,
    "--current-plugin-root", installed070,
    "--latest-manifest", candidateManifest,
    "--changelog", legacyChangelog,
    "--consent", "update-approved",
    "--scope", "user",
    "--claude-binary", fixtureClaude(),
    "--json",
  ], blockerWorkspace, { YASASHII_UPDATE_TEST_MODE: "fixture" });
  check("公開0.7.0の旧scanner blockerを未解消として再現", blocked.status === 3 && manifestVersion(installed070) === "0.7.0");
  check("旧blocker停止はworkspace・Git・sessionへ副作用0", JSON.stringify(workspaceSnapshot(blockerWorkspace)) === JSON.stringify(blockerBefore) && !existsSync(join(blockerWorkspace, ".git/yasashii-secretary-update")));
  check("旧blockerを回避する既知path除外やexternal bootstrapは追加しない", !/continuous-sync|refresh-token/.test(readFileSync(join(candidatePlugin, "scripts/lib/safe-git.mjs"), "utf8")) && !existsSync(join(candidatePlugin, "migrations/0.7.0-to-0.7.0.json")));
} catch (error) {
  check("Sprint 032 test harness", false, error.stack || error.message);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

process.stdout.write(`SPRINT032_RELEASE_PASS=${pass} SPRINT032_RELEASE_FAIL=${fail}\n`);
process.exit(fail ? 1 : 0);
